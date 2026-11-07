/**
 * Rules Engine & Launch Readiness Evaluator
 *
 * Implements Stage 11: Converts raw detector outputs into final findings,
 * evaluates jurisdiction-aware applicability, validates evidence integrity,
 * computes the 0–100 launch readiness score, calculates exposure,
 * and prioritises findings.
 *
 * Evaluator order (from AGENTS.md):
 * 1. Not applicable if applicability fails.
 * 2. Unable to verify if required evidence is missing/blocked/unresolvable.
 * 3. Validate detector output & evidence IDs.
 * 4. Issue found only when evidence-supported; otherwise passed.
 * 5. Calculate readiness score (only applicable issue_found deducts).
 * 6. Attach reviewed exposure models (non-additive statutory caps).
 * 7. Prioritise findings for free/paid presentation.
 * 8. Persist immutable ruleset versioning metadata.
 */

import { randomUUID } from "node:crypto";
import type {
  DetectorOutput,
  EvidenceRecord,
  FindingRecord,
  Jurisdiction,
  SiteSnapshot,
  ExposureSummary,
  Severity,
} from "@vibe/contracts";
import {
  calculateExposureSummary,
  getFindingExposureDetails,
} from "@vibe/exposure";

import { CheckRegistry, WAVE_1_REGISTRY, type CheckRegistryEntry } from "./registry";
import {
  ApplicabilityEvaluator,
  extractApplicabilityContext,
  type ApplicabilityContext,
} from "./applicability";
import { EvidenceValidator } from "./evidence-validator";
import { ScoreCalculator, type ScoreBreakdown } from "./score";
import { FindingPrioritiser, type PrioritisedFinding } from "./prioritisation";
import { RULESET_VERSION, type RulesetMetadata } from "./versioning";
import { meetsConfidenceThreshold } from "./confidence";

export interface RulesEngineConfig {
  /** Check registry to use (defaults to Wave 1 registry) */
  registry?: CheckRegistry;
  /** Applicability evaluator instance */
  applicabilityEvaluator?: ApplicabilityEvaluator;
  /** Evidence validator instance */
  evidenceValidator?: EvidenceValidator;
  /** Score calculator instance */
  scoreCalculator?: ScoreCalculator;
  /** Finding prioritiser instance */
  prioritiser?: FindingPrioritiser;
  /** Active ruleset version override (defaults to RULESET_VERSION) */
  rulesetVersion?: string;
}

export interface EvaluationInput {
  /** UUID of the scan */
  scanId: string;
  /** Detector outputs from the scanning phase */
  detectorOutputs: DetectorOutput[];
  /** Evidence records collected during capture and detection */
  evidenceRecords: EvidenceRecord[];
  /**
   * Customer-confirmed jurisdictions for legal applicability.
   * INVARIANT: Never infer from IP or hosting location.
   */
  confirmedJurisdictions: Jurisdiction[];
  /** Optional SiteSnapshot for contextual applicability evaluation */
  snapshot?: SiteSnapshot;
  /** Scanner version string */
  scannerVersion?: string;
  /** Optional custom applicability context override */
  customApplicabilityContext?: Partial<ApplicabilityContext>;
}

export interface EvaluationResult {
  /** Scan UUID */
  readonly scanId: string;
  /** Readiness score (0–100) */
  readonly score: number;
  /** Detailed score breakdown */
  readonly scoreBreakdown: ScoreBreakdown;
  /** All evaluated and prioritised findings */
  readonly findings: PrioritisedFinding[];
  /** Top preview findings (for free tier, max 10) */
  readonly topFindings: PrioritisedFinding[];
  /** Aggregate source-backed exposure summary */
  readonly exposureSummary: ExposureSummary;
  /** Status distribution counts */
  readonly statusCounts: {
    passed: number;
    issue_found: number;
    not_applicable: number;
    unable_to_verify: number;
  };
  /** Severity distribution counts (for issue_found only) */
  readonly severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  /** Immutable ruleset metadata for auditing */
  readonly metadata: RulesetMetadata;
}

export class RulesEngine {
  private registry: CheckRegistry;
  private applicabilityEvaluator: ApplicabilityEvaluator;
  private evidenceValidator: EvidenceValidator;
  private scoreCalculator: ScoreCalculator;
  private prioritiser: FindingPrioritiser;
  private rulesetVersion: string;

  constructor(config: RulesEngineConfig = {}) {
    if (config.registry) {
      this.registry = config.registry;
    } else {
      this.registry = new CheckRegistry();
      this.registry.registerAll(WAVE_1_REGISTRY);
    }

    this.applicabilityEvaluator =
      config.applicabilityEvaluator ?? new ApplicabilityEvaluator();
    this.evidenceValidator = config.evidenceValidator ?? new EvidenceValidator();
    this.scoreCalculator = config.scoreCalculator ?? new ScoreCalculator();
    this.prioritiser = config.prioritiser ?? new FindingPrioritiser(this.registry);
    this.rulesetVersion = config.rulesetVersion ?? RULESET_VERSION;
  }

  /**
   * Evaluates detector outputs and produces final findings and score.
   */
  public evaluate(input: EvaluationInput): EvaluationResult {
    const {
      scanId,
      detectorOutputs,
      evidenceRecords,
      confirmedJurisdictions,
      snapshot,
      scannerVersion = "1.0.0",
    } = input;

    // Step 1: Establish applicability context
    const baseAppContext: ApplicabilityContext = snapshot
      ? extractApplicabilityContext(snapshot, confirmedJurisdictions)
      : {
          confirmedJurisdictions,
          hasEcommerceSignals: false,
          collectsPersonalData: false,
          hasConsentMechanism: false,
        };

    const appContext: ApplicabilityContext = {
      ...baseAppContext,
      ...(input.customApplicabilityContext ?? {}),
      // Invariant: confirmedJurisdictions is always strictly customer-confirmed
      confirmedJurisdictions,
    };

    // Index detector outputs by checkId
    const outputMap = new Map<string, DetectorOutput>();
    for (const out of detectorOutputs) {
      outputMap.set(out.checkId, out);
    }

    // Evidence resolution map
    const evidenceValidationMap = this.evidenceValidator.validateBatch(
      detectorOutputs,
      evidenceRecords
    );

    const rawFindings: FindingRecord[] = [];
    const statusCounts = {
      passed: 0,
      issue_found: 0,
      not_applicable: 0,
      unable_to_verify: 0,
    };
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    const evaluatedCheckIds = new Set<string>();

    // Process all registered checks (or those present in detector outputs)
    const allChecksToProcess: CheckRegistryEntry[] = [];
    for (const entry of this.registry.getEnabled()) {
      allChecksToProcess.push(entry);
      evaluatedCheckIds.add(entry.id);
    }

    // Also include any detector outputs that might not be in the default registry
    for (const out of detectorOutputs) {
      if (!evaluatedCheckIds.has(out.checkId)) {
        allChecksToProcess.push({
          id: out.checkId,
          version: out.checkVersion,
          title: `Check ${out.checkId}`,
          description: out.summary,
          module: "quality",
          wave: "W1",
          priority: 50,
          defaultSeverity: out.severity ?? "medium",
          jurisdictions: [],
          legalReferences: [],
          exposureModelIds: [],
          reviewDate: new Date().toISOString().split("T")[0]!,
          enabled: true,
        });
        evaluatedCheckIds.add(out.checkId);
      }
    }

    for (const check of allChecksToProcess) {
      const output = outputMap.get(check.id);

      // --- STAGE 1: Check Applicability ---
      const appResult = this.applicabilityEvaluator.evaluate(check, appContext);
      if (!appResult.applicable) {
        statusCounts.not_applicable++;
        rawFindings.push({
          id: randomUUID(),
          scanId,
          checkId: check.id,
          status: "not_applicable",
          severity: null,
          confidence: 1.0,
          reasonCode: appResult.reasonCode,
          title: check.title,
          summary: appResult.reason,
          evidenceIds: [],
          requiresHumanReview: false,
          createdAt: new Date().toISOString(),
        });
        continue;
      }

      // If no detector output exists for an applicable check, it is unable_to_verify
      if (!output) {
        statusCounts.unable_to_verify++;
        rawFindings.push({
          id: randomUUID(),
          scanId,
          checkId: check.id,
          status: "unable_to_verify",
          severity: null,
          confidence: 0,
          reasonCode: "NO_DETECTOR_OUTPUT",
          title: check.title,
          summary: `Check "${check.title}" was scheduled but no detector output was recorded.`,
          evidenceIds: [],
          requiresHumanReview: true,
          createdAt: new Date().toISOString(),
        });
        continue;
      }

      // --- STAGE 2: Handle unable_to_verify from detector ---
      // Invariant: unable_to_verify must NEVER be presented as passed
      if (output.status === "unable_to_verify") {
        statusCounts.unable_to_verify++;
        rawFindings.push({
          id: randomUUID(),
          scanId,
          checkId: check.id,
          status: "unable_to_verify",
          severity: null,
          confidence: output.confidence,
          reasonCode: output.reasonCode,
          title: check.title,
          summary: output.summary,
          evidenceIds: output.evidenceIds,
          requiresHumanReview: true,
          createdAt: new Date().toISOString(),
        });
        continue;
      }

      // --- STAGE 3: Handle not_applicable from detector ---
      if (output.status === "not_applicable") {
        statusCounts.not_applicable++;
        rawFindings.push({
          id: randomUUID(),
          scanId,
          checkId: check.id,
          status: "not_applicable",
          severity: null,
          confidence: output.confidence,
          reasonCode: output.reasonCode,
          title: check.title,
          summary: output.summary,
          evidenceIds: [],
          requiresHumanReview: false,
          createdAt: new Date().toISOString(),
        });
        continue;
      }

      // --- STAGE 4: Handle passed ---
      if (output.status === "passed") {
        statusCounts.passed++;
        rawFindings.push({
          id: randomUUID(),
          scanId,
          checkId: check.id,
          status: "passed",
          severity: null,
          confidence: output.confidence,
          reasonCode: output.reasonCode,
          title: check.title,
          summary: output.summary,
          evidenceIds: output.evidenceIds,
          requiresHumanReview: false,
          createdAt: new Date().toISOString(),
        });
        continue;
      }

      // --- STAGE 5: Handle issue_found with Evidence Validation ---
      if (output.status === "issue_found") {
        const valResult = evidenceValidationMap.get(check.id);

        // Invariant: Missing evidence must never be interpreted as compliance or pass.
        // If evidence is missing/unresolvable, demote to unable_to_verify.
        if (!valResult || !valResult.valid) {
          statusCounts.unable_to_verify++;
          rawFindings.push({
            id: randomUUID(),
            scanId,
            checkId: check.id,
            status: "unable_to_verify",
            severity: null,
            confidence: 0.3,
            reasonCode: "UNRESOLVED_EVIDENCE_REFERENCE",
            title: check.title,
            summary: `Issue was detected but referenced evidence could not be verified in the scan record: ${valResult?.message ?? "Evidence records missing."}`,
            evidenceIds: valResult?.resolvedIds ?? [],
            requiresHumanReview: true,
            createdAt: new Date().toISOString(),
          });
          continue;
        }

        // Valid issue found
        statusCounts.issue_found++;
        const severity: Severity = output.severity ?? check.defaultSeverity;
        severityCounts[severity]++;

        // Exposure details for this finding
        const exposureDetails = getFindingExposureDetails(
          check.id,
          confirmedJurisdictions
        );

        const requiresHumanReview =
          output.requiresHumanReview ||
          !meetsConfidenceThreshold(output.confidence);

        rawFindings.push({
          id: randomUUID(),
          scanId,
          checkId: check.id,
          status: "issue_found",
          severity,
          confidence: output.confidence,
          reasonCode: output.reasonCode,
          title: check.title,
          summary: output.summary,
          evidenceIds: output.evidenceIds,
          remediation: output.remediationTemplateId ?? check.remediationTemplateId,
          exposureDetails: exposureDetails
            ? {
                statutoryMaxInr: exposureDetails.statutoryMaxInr,
                plausibleDirectCostMinInr: exposureDetails.plausibleDirectCostMinInr,
                plausibleDirectCostMaxInr: exposureDetails.plausibleDirectCostMaxInr,
                statutoryBasis: exposureDetails.statutoryBasis,
              }
            : undefined,
          requiresHumanReview,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Step 6: Launch Readiness Score Calculation
    // Invariant: Only applicable issue_found checks reduce the score.
    const scoreInputs = rawFindings.map((f) => ({
      checkId: f.checkId,
      status: f.status,
      severity: f.severity,
      confidence: f.confidence,
    }));
    const scoreBreakdown = this.scoreCalculator.calculate(scoreInputs);

    // Step 7: Exposure Summary Calculation
    // Invariants:
    // - Source-backed models only.
    // - Non-additive statutory caps.
    // - No invented enforcement probabilities.
    const exposureSummary = calculateExposureSummary(
      rawFindings,
      confirmedJurisdictions
    );

    // Step 8: Finding Prioritisation
    const prioritisedFindings = this.prioritiser.prioritise(rawFindings);
    const topFindings = this.prioritiser.getTopFindings(rawFindings, 10);

    // Step 9: Ruleset Metadata
    const metadata: RulesetMetadata = {
      rulesetVersion: this.rulesetVersion,
      scannerVersion,
      evaluatedAt: new Date().toISOString(),
      totalRegisteredChecks: this.registry.size,
      checksEvaluated: allChecksToProcess.length,
      snapshotSchemaVersion: snapshot?.schemaVersion ?? "1.0.0",
    };

    return {
      scanId,
      score: scoreBreakdown.score,
      scoreBreakdown,
      findings: prioritisedFindings,
      topFindings,
      exposureSummary,
      statusCounts,
      severityCounts,
      metadata,
    };
  }
}

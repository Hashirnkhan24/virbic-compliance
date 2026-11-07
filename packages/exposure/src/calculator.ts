import type { ExposureSummary, FindingRecord, Jurisdiction } from "@vibe/contracts";
import { getExposureModelsForCheck, type ExposureModelDefinition } from "./models";

export interface FindingExposureDetails {
  statutoryMaxInr?: number;
  plausibleDirectCostMinInr?: number;
  plausibleDirectCostMaxInr?: number;
  statutoryBasis?: string;
  remediationCostEstimateInr?: number;
}

/**
 * Calculates exposure details for an individual finding based on confirmed jurisdictions.
 */
export function getFindingExposureDetails(
  checkId: string,
  confirmedJurisdictions: Jurisdiction[] = ["india"]
): FindingExposureDetails | undefined {
  const models = getExposureModelsForCheck(checkId, confirmedJurisdictions);
  if (models.length === 0) {
    return undefined;
  }

  // Use primary matching model for finding-level attribution
  const primary = models[0];
  if (!primary) {
    return undefined;
  }

  return {
    statutoryMaxInr: primary.statutoryMaxInr,
    plausibleDirectCostMinInr: primary.plausibleDirectCostMinInr,
    plausibleDirectCostMaxInr: primary.plausibleDirectCostMaxInr,
    remediationCostEstimateInr: primary.remediationCostEstimateInr,
    statutoryBasis: primary.statutoryBasis,
  };
}

/**
 * Aggregates exposure across all confirmed findings.
 *
 * INVARIANTS:
 * 1. Never sum overlapping statutory maximum caps together (e.g. DPDP ₹250 Cr + GDPR ₹180 Cr).
 *    The statutory cap represents the single highest applicable regulatory ceiling.
 * 2. Plausible direct costs aggregate defense/inquiry costs across distinct regulatory models.
 * 3. No arbitrary enforcement probabilities.
 */
export function calculateExposureSummary(
  findings: FindingRecord[],
  confirmedJurisdictions: Jurisdiction[] = ["india"]
): ExposureSummary {
  const issueFindings = findings.filter((f) => f.status === "issue_found");

  if (issueFindings.length === 0) {
    return {
      hasExposure: false,
      minDirectCostInr: 0,
      maxDirectCostInr: 0,
      statutoryMaxInr: 0,
      applicableRegimes: [],
    };
  }

  const triggeredModels = new Map<string, ExposureModelDefinition>();

  for (const finding of issueFindings) {
    const models = getExposureModelsForCheck(finding.checkId, confirmedJurisdictions);
    for (const m of models) {
      if (!triggeredModels.has(m.id)) {
        triggeredModels.set(m.id, m);
      }
    }
  }

  if (triggeredModels.size === 0) {
    return {
      hasExposure: false,
      minDirectCostInr: 0,
      maxDirectCostInr: 0,
      statutoryMaxInr: 0,
      applicableRegimes: [],
    };
  }

  const modelList = Array.from(triggeredModels.values());

  // Invariant: Non-additive statutory maximum ceiling
  const statutoryMaxInr = Math.max(...modelList.map((m) => m.statutoryMaxInr));

  // Direct costs sum across distinct models (e.g. DPDP legal response + CCPA notice response)
  const minDirectCostInr = modelList.reduce((sum, m) => sum + m.plausibleDirectCostMinInr, 0);
  const maxDirectCostInr = modelList.reduce((sum, m) => sum + m.plausibleDirectCostMaxInr, 0);

  const applicableRegimes = modelList.map((m) => `${m.name} (${m.jurisdiction.toUpperCase()})`);

  return {
    hasExposure: true,
    minDirectCostInr,
    maxDirectCostInr,
    statutoryMaxInr,
    applicableRegimes,
  };
}

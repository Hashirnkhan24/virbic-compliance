import { DetectorOutputSchema, type SiteSnapshot } from "@vibe/contracts";
import type {
  CheckDefinition,
  CheckExecutionResult,
  DetectionContext,
  DetectionSuiteResult,
} from "./types";
import { EvidenceCollector } from "./evidence-collector";

export interface DetectionEngineConfig {
  scannerVersion?: string;
  rulesetVersion?: string;
  logger?: (level: "info" | "warn" | "error", message: string, meta?: any) => void;
}

/**
 * Checks if the snapshot contains the required evidence types.
 * Invariant: Missing evidence must NEVER be treated as pass.
 */
function hasRequiredEvidence(
  snapshot: SiteSnapshot,
  required: CheckDefinition["requiredEvidence"]
): { hasEvidence: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const type of required) {
    switch (type) {
      case "dom_element":
      case "page_text":
        if (!snapshot.pages || snapshot.pages.length === 0) {
          missing.push(type);
        }
        break;
      case "cookie":
        // At least one page must have been captured or consent runs recorded
        if (!snapshot.pages || snapshot.pages.length === 0) {
          missing.push(type);
        }
        break;
      case "header":
        if (!snapshot.responseHeaders || snapshot.responseHeaders.length === 0) {
          missing.push(type);
        }
        break;
      case "network_request":
        if (!snapshot.networkRequests || snapshot.networkRequests.length === 0) {
          missing.push(type);
        }
        break;
      case "dns_record":
        if (!snapshot.dns || !snapshot.dns.records || snapshot.dns.records.length === 0) {
          missing.push(type);
        }
        break;
      case "tls_cert":
        if (!snapshot.tls) {
          missing.push(type);
        }
        break;
      case "script_token":
        // Assets or script inventory
        if (!snapshot.assets && (!snapshot.pages || snapshot.pages.length === 0)) {
          missing.push(type);
        }
        break;
      case "axe_node":
        // Accessibility violations or scan results
        if (!snapshot.accessibilityViolations) {
          missing.push(type);
        }
        break;
    }
  }

  return {
    hasEvidence: missing.length === 0,
    missing,
  };
}

/**
 * Modular Detection Engine executing deterministic checks against an immutable SiteSnapshot.
 * Enforces execution isolation, evidence validation, timing metrics, and error containment.
 */
export class DetectionEngine {
  private checks = new Map<string, CheckDefinition>();
  private scannerVersion: string;
  private rulesetVersion: string;
  private logger?: (level: "info" | "warn" | "error", message: string, meta?: any) => void;

  constructor(config: DetectionEngineConfig = {}) {
    this.scannerVersion = config.scannerVersion ?? "1.0.0";
    this.rulesetVersion = config.rulesetVersion ?? "1.0.0";
    this.logger = config.logger;
  }

  /**
   * Registers a check definition. Replaces duplicate IDs with latest version.
   */
  public register(check: CheckDefinition): void {
    this.checks.set(check.id, check);
  }

  /**
   * Registers an array of check definitions.
   */
  public registerAll(checks: CheckDefinition[]): void {
    for (const check of checks) {
      this.register(check);
    }
  }

  public getCheck(id: string): CheckDefinition | undefined {
    return this.checks.get(id);
  }

  public getAllChecks(): CheckDefinition[] {
    return Array.from(this.checks.values());
  }

  /**
   * Executes a single check against a SiteSnapshot with strict isolation.
   */
  public async executeCheck(
    checkId: string,
    snapshot: SiteSnapshot,
    context: DetectionContext
  ): Promise<CheckExecutionResult> {
    const check = this.checks.get(checkId);
    const executedAt = new Date().toISOString();
    const startTime = Date.now();

    if (!check) {
      return {
        checkId,
        version: "unknown",
        output: {
          checkId,
          checkVersion: "unknown",
          status: "unable_to_verify",
          severity: null,
          confidence: 0,
          reasonCode: "CHECK_NOT_FOUND",
          summary: `Check definition "${checkId}" is not registered in the detection engine.`,
          evidenceIds: [],
          requiresHumanReview: true,
        },
        executionDurationMs: 0,
        executedAt,
      };
    }

    // Step 1: Evaluate Applicability
    if (check.applicability) {
      try {
        const isApplicable = check.applicability(snapshot, context);
        if (!isApplicable) {
          return {
            checkId: check.id,
            version: check.version,
            output: {
              checkId: check.id,
              checkVersion: check.version,
              status: "not_applicable",
              severity: null,
              confidence: 1.0,
              reasonCode: "NOT_APPLICABLE",
              summary: `Check "${check.title}" is not applicable to this website configuration.`,
              evidenceIds: [],
              requiresHumanReview: false,
            },
            executionDurationMs: Date.now() - startTime,
            executedAt,
          };
        }
      } catch (appErr: any) {
        this.logger?.("warn", `Applicability evaluation error for ${check.id}: ${appErr.message}`);
      }
    }

    // Step 2: Validate Required Evidence
    const evidenceCheck = hasRequiredEvidence(snapshot, check.requiredEvidence);
    if (!evidenceCheck.hasEvidence) {
      return {
        checkId: check.id,
        version: check.version,
        output: {
          checkId: check.id,
          checkVersion: check.version,
          status: "unable_to_verify",
          severity: null,
          confidence: 0.5,
          reasonCode: "REQUIRED_EVIDENCE_MISSING",
          summary: `Cannot verify "${check.title}" because required evidence types (${evidenceCheck.missing.join(", ")}) were missing or blocked during capture.`,
          evidenceIds: [],
          requiresHumanReview: true,
        },
        executionDurationMs: Date.now() - startTime,
        executedAt,
      };
    }

    // Step 3: Execute Detector in Isolated Sandbox
    try {
      const rawOutput = await Promise.resolve(check.run(snapshot, context));
      const durationMs = Date.now() - startTime;

      // Step 4: Validate output with Zod contract
      const validated = DetectorOutputSchema.safeParse(rawOutput);
      if (!validated.success) {
        this.logger?.(
          "error",
          `Detector ${check.id} output failed Zod schema validation:`,
          validated.error.format()
        );

        // Fail safe to unable_to_verify
        return {
          checkId: check.id,
          version: check.version,
          output: {
            checkId: check.id,
            checkVersion: check.version,
            status: "unable_to_verify",
            severity: null,
            confidence: 0,
            reasonCode: "DETECTOR_CONTRACT_VIOLATION",
            summary: `Detector output violated schema: ${validated.error.issues[0]?.message}`,
            evidenceIds: [],
            requiresHumanReview: true,
          },
          executionDurationMs: durationMs,
          executedAt,
        };
      }

      return {
        checkId: check.id,
        version: check.version,
        output: validated.data,
        executionDurationMs: durationMs,
        executedAt,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      this.logger?.("error", `Detector ${check.id} threw uncaught exception: ${err.message}`, err);

      // Invariant 8: Check execution is isolated so one failed detector does NOT crash the entire scan
      return {
        checkId: check.id,
        version: check.version,
        output: {
          checkId: check.id,
          checkVersion: check.version,
          status: "unable_to_verify",
          severity: null,
          confidence: 0,
          reasonCode: "DETECTOR_EXECUTION_ERROR",
          summary: `Detector encountered an unexpected execution error: ${err.message}`,
          evidenceIds: [],
          requiresHumanReview: true,
        },
        executionDurationMs: durationMs,
        executedAt,
      };
    }
  }

  /**
   * Executes all registered checks (or filtered checks) against a snapshot.
   */
  public async executeAll(
    snapshot: SiteSnapshot,
    options: {
      jurisdictions?: DetectionContext["jurisdictions"];
      waveFilter?: ("W1" | "W2" | "W3" | "W4")[];
      moduleFilter?: string[];
    } = {}
  ): Promise<DetectionSuiteResult> {
    const suiteStartTime = Date.now();
    const collector = new EvidenceCollector(snapshot.scanId);
    const context: DetectionContext = {
      scanId: snapshot.scanId,
      jurisdictions: options.jurisdictions,
      evidenceCollector: collector,
      logger: this.logger,
    };

    const results: Record<string, CheckExecutionResult> = {};
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

    // Filter checks by wave and module if specified
    const checksToRun = Array.from(this.checks.values()).filter((check) => {
      if (options.waveFilter && !options.waveFilter.includes(check.wave)) {
        return false;
      }
      if (options.moduleFilter && !options.moduleFilter.includes(check.module)) {
        return false;
      }
      return true;
    });

    for (const check of checksToRun) {
      const result = await this.executeCheck(check.id, snapshot, context);
      results[check.id] = result;

      // Aggregate counts
      statusCounts[result.output.status]++;
      if (result.output.status === "issue_found" && result.output.severity) {
        severityCounts[result.output.severity]++;
      }
    }

    return {
      scanId: snapshot.scanId,
      scannerVersion: this.scannerVersion,
      rulesetVersion: this.rulesetVersion,
      totalChecksEvaluated: checksToRun.length,
      statusCounts,
      severityCounts,
      results,
      collectedEvidence: collector.getEvidenceRecords(),
      totalDurationMs: Date.now() - suiteStartTime,
    };
  }
}

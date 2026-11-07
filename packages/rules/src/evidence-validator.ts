/**
 * Evidence Validator
 *
 * Validates that every evidence ID referenced in a detector output
 * resolves to an actual evidence record. Findings without valid
 * evidence references cannot be accepted.
 *
 * INVARIANTS:
 * - Every finding must reference evidence. No evidence = no finding.
 * - Missing evidence must never be interpreted as compliance.
 * - Evidence references in findings must resolve to actual evidence records.
 */

import type { DetectorOutput, EvidenceRecord } from "@vibe/contracts";

/** Result of evidence validation for a single detector output. */
export interface EvidenceValidationResult {
  /** Whether all evidence references are valid */
  readonly valid: boolean;
  /** Evidence IDs that could not be resolved */
  readonly unresolvedIds: string[];
  /** Evidence IDs that were successfully resolved */
  readonly resolvedIds: string[];
  /** Human-readable validation message */
  readonly message: string;
}

/**
 * Validates evidence references in detector outputs.
 */
export class EvidenceValidator {
  /**
   * Validate that all evidence IDs in a detector output resolve to actual records.
   *
   * @param output - The detector output to validate
   * @param evidenceRecords - The evidence records collected during the scan
   * @returns Validation result with resolved/unresolved ID lists
   */
  public validate(
    output: DetectorOutput,
    evidenceRecords: EvidenceRecord[]
  ): EvidenceValidationResult {
    const evidenceMap = new Map(evidenceRecords.map((r) => [r.id, r]));
    const resolvedIds: string[] = [];
    const unresolvedIds: string[] = [];

    for (const id of output.evidenceIds) {
      if (evidenceMap.has(id)) {
        resolvedIds.push(id);
      } else {
        unresolvedIds.push(id);
      }
    }

    // Special case: issue_found with no evidence IDs is always invalid
    // (the Zod schema also enforces this, but we double-check)
    if (output.status === "issue_found" && output.evidenceIds.length === 0) {
      return {
        valid: false,
        unresolvedIds: [],
        resolvedIds: [],
        message: `Check ${output.checkId}: issue_found status must reference at least one evidence record. Missing evidence cannot indicate compliance.`,
      };
    }

    if (unresolvedIds.length > 0) {
      return {
        valid: false,
        unresolvedIds,
        resolvedIds,
        message: `Check ${output.checkId}: ${unresolvedIds.length} evidence ID(s) could not be resolved: [${unresolvedIds.join(", ")}]. Findings with unresolvable evidence are demoted to unable_to_verify.`,
      };
    }

    return {
      valid: true,
      unresolvedIds: [],
      resolvedIds,
      message: `Check ${output.checkId}: All ${resolvedIds.length} evidence reference(s) validated successfully.`,
    };
  }

  /**
   * Validates a batch of detector outputs against collected evidence.
   * Returns a map of checkId → validation result.
   */
  public validateBatch(
    outputs: DetectorOutput[],
    evidenceRecords: EvidenceRecord[]
  ): Map<string, EvidenceValidationResult> {
    const results = new Map<string, EvidenceValidationResult>();
    for (const output of outputs) {
      results.set(output.checkId, this.validate(output, evidenceRecords));
    }
    return results;
  }
}

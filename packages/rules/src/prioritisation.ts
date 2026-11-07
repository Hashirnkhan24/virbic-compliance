/**
 * Finding Prioritiser
 *
 * Orders findings to surface the highest-risk issues first.
 *
 * Prioritisation ranking logic:
 * 1. Status: issue_found first, then unable_to_verify (potential hidden risk),
 *    then passed, then not_applicable.
 * 2. Severity rank (critical > high > medium > low > info).
 * 3. Confidence (higher confidence first as tiebreaker for same severity).
 * 4. Check registry priority (lower numerical value = higher priority).
 * 5. Check ID alphabetically for determinism.
 */

import type { FindingRecord } from "@vibe/contracts";
import { getSeverityWeight } from "./severity";
import type { CheckRegistry } from "./registry";

export interface PrioritisedFinding extends FindingRecord {
  /** Rank in the prioritised list (1-indexed) */
  readonly rank: number;
  /** Composite priority score used for sorting */
  readonly priorityScore: number;
}

const STATUS_RANK: Record<FindingRecord["status"], number> = {
  issue_found: 4,
  unable_to_verify: 3,
  passed: 2,
  not_applicable: 1,
};

export class FindingPrioritiser {
  private registry?: CheckRegistry;

  constructor(registry?: CheckRegistry) {
    this.registry = registry;
  }

  /**
   * Computes a numerical priority score for sorting findings.
   * Higher composite score appears earlier in the list.
   */
  public computePriorityScore(finding: FindingRecord): number {
    const statusWeight = (STATUS_RANK[finding.status] ?? 0) * 10000;
    const severityWeight = getSeverityWeight(finding.severity) * 1000;
    const confidenceWeight = Math.round(finding.confidence * 100);

    // Registry priority (inverted: priority 1 gives 50, priority 50 gives 1)
    let checkPriorityBonus = 0;
    if (this.registry) {
      const entry = this.registry.get(finding.checkId);
      if (entry) {
        checkPriorityBonus = Math.max(0, 50 - entry.priority);
      }
    }

    return statusWeight + severityWeight + confidenceWeight + checkPriorityBonus;
  }

  /**
   * Sorts findings deterministically in descending priority order.
   *
   * @param findings - Array of finding records to sort
   * @returns New array of findings with rank and priority score attached
   */
  public prioritise(findings: FindingRecord[]): PrioritisedFinding[] {
    const scored = findings.map((finding) => ({
      finding,
      score: this.computePriorityScore(finding),
    }));

    scored.sort((a, b) => {
      // Primary: priority score descending
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      // Tiebreaker 1: Severity weight descending
      const sevA = getSeverityWeight(a.finding.severity);
      const sevB = getSeverityWeight(b.finding.severity);
      if (sevB !== sevA) {
        return sevB - sevA;
      }

      // Tiebreaker 2: Confidence descending
      if (b.finding.confidence !== a.finding.confidence) {
        return b.finding.confidence - a.finding.confidence;
      }

      // Tiebreaker 3: Deterministic checkId ascending
      return a.finding.checkId.localeCompare(b.finding.checkId);
    });

    return scored.map((item, index) => ({
      ...item.finding,
      rank: index + 1,
      priorityScore: item.score,
    }));
  }

  /**
   * Extracts the top N findings (typically top 5 to 10 for free preview).
   *
   * @param findings - All findings
   * @param limit - Maximum number of findings to return (default 10)
   * @param filterStatus - Optional filter, defaults to ["issue_found", "unable_to_verify"]
   */
  public getTopFindings(
    findings: FindingRecord[],
    limit: number = 10,
    filterStatus: FindingRecord["status"][] = ["issue_found", "unable_to_verify"]
  ): PrioritisedFinding[] {
    const prioritised = this.prioritise(findings);
    const filtered = prioritised.filter((f) => filterStatus.includes(f.status));
    return filtered.slice(0, limit);
  }
}

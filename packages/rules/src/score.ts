/**
 * Score Calculator
 *
 * Computes the 0–100 Launch Readiness Score from evaluated findings.
 *
 * ═══════════════════════════════════════════════════════════════════
 * SCORING FORMULA
 * ═══════════════════════════════════════════════════════════════════
 *
 * The readiness score starts at 100 and is reduced by issue findings:
 *
 *   score = max(0, 100 − Σ deduction_i)
 *
 * Where for each applicable finding with status === "issue_found":
 *
 *   deduction_i = SEVERITY_DEDUCTION[severity_i] × confidence_i
 *
 * Severity deduction table (base points):
 *   critical  →  8 points
 *   high      →  5 points
 *   medium    →  3 points
 *   low       →  1.5 points
 *   info      →  0 points (never deducted)
 *
 * ═══════════════════════════════════════════════════════════════════
 * SCORING RULES
 * ═══════════════════════════════════════════════════════════════════
 *
 * 1. ONLY "issue_found" results reduce the score.
 * 2. "not_applicable" checks are excluded from the scoring denominator
 *    entirely — they do not reduce or inflate the score.
 * 3. "unable_to_verify" checks are NOT presented as "passed" and
 *    do NOT reduce the score, but they are tracked separately
 *    as risk indicators in the breakdown.
 * 4. "passed" checks contribute positively by not deducting.
 * 5. Missing evidence → unable_to_verify → no score deduction,
 *    but also NOT treated as compliance.
 * 6. Info-severity findings are recorded but never deduct points.
 *
 * ═══════════════════════════════════════════════════════════════════
 * LIMITATIONS & CAVEATS
 * ═══════════════════════════════════════════════════════════════════
 *
 * - The score is an indicative readiness metric, NOT a compliance
 *   certificate, legal guarantee, or security certification.
 * - The scoring weights are heuristic and reviewed periodically.
 *   They do not represent legal risk magnitude.
 * - A score of 100 does NOT mean the site is fully compliant —
 *   it means no issues were detected by the enabled checks.
 * - Checks marked unable_to_verify represent unknown risk that
 *   the score cannot account for.
 * - The score does not account for issues outside the scanner's
 *   detection capabilities (e.g., server-side logic, internal
 *   processes, contractual obligations).
 * - Exposure calculations are separate from the readiness score.
 *   The score measures issue density; exposure measures potential
 *   financial/regulatory impact.
 */

import type { Severity } from "@vibe/contracts";
import { getSeverityDeduction } from "./severity";
import { applyConfidenceAdjustment } from "./confidence";

/** Individual finding contribution to the score. */
export interface ScoredFinding {
  /** Check ID */
  readonly checkId: string;
  /** Severity of the finding */
  readonly severity: Severity;
  /** Confidence of the finding (0–1) */
  readonly confidence: number;
  /** Base deduction before confidence adjustment */
  readonly baseDeduction: number;
  /** Actual deduction after confidence adjustment */
  readonly adjustedDeduction: number;
}

/** Full breakdown of the score calculation. */
export interface ScoreBreakdown {
  /** Final readiness score (0–100, integer) */
  readonly score: number;
  /** Raw score before clamping to 0 */
  readonly rawScore: number;
  /** Total deductions across all issue findings */
  readonly totalDeductions: number;
  /** Number of applicable checks considered */
  readonly applicableChecks: number;
  /** Number of checks that passed */
  readonly passedChecks: number;
  /** Number of checks with issues found */
  readonly issueChecks: number;
  /** Number of checks that were not applicable */
  readonly notApplicableChecks: number;
  /** Number of checks unable to verify */
  readonly unableToVerifyChecks: number;
  /** Per-finding deduction breakdown (only for issue_found) */
  readonly scoredFindings: ScoredFinding[];
  /**
   * Risk indicator: proportion of checks that could not be verified.
   * High values suggest the score may be unreliable due to missing data.
   * Range: 0.0 (all verified) to 1.0 (none verified).
   */
  readonly unverifiedRatio: number;
}

/**
 * Input to the score calculator: a processed check result.
 */
export interface CheckScoreInput {
  readonly checkId: string;
  readonly status: "passed" | "issue_found" | "not_applicable" | "unable_to_verify";
  readonly severity: Severity | null | undefined;
  readonly confidence: number;
}

export class ScoreCalculator {
  /**
   * Calculate the launch readiness score.
   *
   * @param inputs - Processed check results to score
   * @returns Full score breakdown with per-finding details
   */
  public calculate(inputs: CheckScoreInput[]): ScoreBreakdown {
    let passedChecks = 0;
    let issueChecks = 0;
    let notApplicableChecks = 0;
    let unableToVerifyChecks = 0;
    const scoredFindings: ScoredFinding[] = [];

    for (const input of inputs) {
      switch (input.status) {
        case "passed":
          passedChecks++;
          break;

        case "issue_found": {
          issueChecks++;
          if (input.severity && input.severity !== "info") {
            const baseDeduction = getSeverityDeduction(input.severity);
            const adjustedDeduction = applyConfidenceAdjustment(
              baseDeduction,
              input.confidence
            );
            scoredFindings.push({
              checkId: input.checkId,
              severity: input.severity,
              confidence: input.confidence,
              baseDeduction,
              adjustedDeduction,
            });
          }
          break;
        }

        case "not_applicable":
          // NOT included in scoring — does not reduce or inflate
          notApplicableChecks++;
          break;

        case "unable_to_verify":
          // NOT deducted, NOT treated as passed
          unableToVerifyChecks++;
          break;
      }
    }

    const totalDeductions = scoredFindings.reduce(
      (sum, f) => sum + f.adjustedDeduction,
      0
    );

    const rawScore = 100 - totalDeductions;
    const score = Math.round(Math.max(0, Math.min(100, rawScore)));

    // Applicable = everything except not_applicable
    const applicableChecks = passedChecks + issueChecks + unableToVerifyChecks;

    // Unverified ratio: what fraction of applicable checks couldn't be verified
    const unverifiedRatio =
      applicableChecks > 0
        ? unableToVerifyChecks / applicableChecks
        : 0;

    return {
      score,
      rawScore,
      totalDeductions,
      applicableChecks,
      passedChecks,
      issueChecks,
      notApplicableChecks,
      unableToVerifyChecks,
      scoredFindings,
      unverifiedRatio,
    };
  }
}

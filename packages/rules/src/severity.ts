/**
 * Severity Mapping
 *
 * Maps severity levels to numerical weights used in score calculation.
 * Severity and confidence are DISTINCT concerns:
 *   - Severity: How bad is the issue if confirmed? (categorical)
 *   - Confidence: How sure are we the issue exists? (0–1 continuous)
 *
 * The score deduction per finding is: DEDUCTION[severity] × confidence
 *
 * Severity weights are ordinal rankings for sorting/prioritisation.
 * Severity deductions are the point reduction per finding in the 0–100 score.
 */

import type { Severity } from "@vibe/contracts";

/**
 * Ordinal weights for severity levels.
 * Used for sorting and prioritisation (higher = more severe).
 */
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
} as const;

/**
 * Score deduction per finding by severity level.
 *
 * These are the base point deductions from a 100-point score.
 * The actual deduction is: DEDUCTION × confidence.
 *
 * Rationale for deduction values:
 * - critical (8pts): Issues that could cause immediate regulatory action,
 *   data breach, or complete functionality failure.
 * - high (5pts): Issues with significant legal, security, or user impact
 *   that should be fixed before launch.
 * - medium (3pts): Issues that represent notable risk or poor practice
 *   but may not prevent launch.
 * - low (1.5pts): Minor issues or best-practice recommendations.
 * - info (0pts): Informational observations that do not indicate risk.
 *   Info-level findings never reduce the score.
 *
 * Note: These values are calibrated so that a site with typical Wave 1
 * issues (e.g., missing privacy policy, no HTTPS, no consent banner)
 * scores roughly 40–60, while a site with only minor issues scores 80–95.
 */
export const SEVERITY_DEDUCTION_MAP: Record<Severity, number> = {
  critical: 8,
  high: 5,
  medium: 3,
  low: 1.5,
  info: 0,
} as const;

/**
 * Get the ordinal weight for a severity level.
 * Returns 0 for null/undefined severity (non-issue statuses).
 */
export function getSeverityWeight(severity: Severity | null | undefined): number {
  if (!severity) return 0;
  return SEVERITY_WEIGHTS[severity] ?? 0;
}

/**
 * Get the base score deduction for a severity level.
 * Returns 0 for null/undefined severity (non-issue statuses).
 */
export function getSeverityDeduction(severity: Severity | null | undefined): number {
  if (!severity) return 0;
  return SEVERITY_DEDUCTION_MAP[severity] ?? 0;
}

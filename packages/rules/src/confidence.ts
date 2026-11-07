/**
 * Confidence Handling
 *
 * Confidence (0.0–1.0) represents how certain the detector is about its finding.
 * It is DISTINCT from severity:
 *   - Severity: categorical measure of impact (critical/high/medium/low/info)
 *   - Confidence: continuous measure of certainty (0.0 = uncertain, 1.0 = certain)
 *
 * Confidence affects:
 * 1. Score deduction: deduction = SEVERITY_DEDUCTION × confidence
 * 2. Finding visibility: findings below the threshold get human-review flags
 * 3. Prioritisation: used as a tiebreaker within same severity
 *
 * INVARIANT: Low confidence does NOT change status.
 * A low-confidence issue_found is still issue_found — it just deducts less
 * from the score and is flagged for human review.
 */

/**
 * Confidence thresholds.
 *
 * - HIGH: ≥ 0.8 — Strong evidence, full weight in scoring
 * - MODERATE: ≥ 0.5 — Reasonable evidence, partial weight
 * - LOW: < 0.5 — Weak evidence, minimal weight, flagged for review
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Minimum confidence for full-weight scoring */
  HIGH: 0.8,
  /** Minimum confidence for moderate-weight scoring */
  MODERATE: 0.5,
  /** Below this, findings are flagged for human review */
  REVIEW_THRESHOLD: 0.5,
} as const;

/**
 * Apply confidence adjustment to a base severity deduction.
 *
 * Formula: adjustedDeduction = baseDeduction × confidence
 *
 * This ensures:
 * - High-confidence findings get near-full deduction
 * - Low-confidence findings get proportionally less deduction
 * - Zero-confidence findings get no deduction (but remain as findings)
 *
 * @param baseDeduction - The base severity deduction (from SEVERITY_DEDUCTION_MAP)
 * @param confidence - Confidence value 0.0–1.0
 * @returns Adjusted deduction value
 */
export function applyConfidenceAdjustment(
  baseDeduction: number,
  confidence: number
): number {
  // Clamp confidence to valid range
  const clampedConfidence = Math.max(0, Math.min(1, confidence));
  return baseDeduction * clampedConfidence;
}

/**
 * Check if a confidence value meets the human-review threshold.
 * Findings below the threshold should be flagged for manual verification.
 *
 * @param confidence - Confidence value 0.0–1.0
 * @returns true if the confidence is high enough to not require review
 */
export function meetsConfidenceThreshold(confidence: number): boolean {
  return confidence >= CONFIDENCE_THRESHOLDS.REVIEW_THRESHOLD;
}

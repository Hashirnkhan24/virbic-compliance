import { describe, it, expect } from "vitest";
import {
  SEVERITY_WEIGHTS,
  SEVERITY_DEDUCTION_MAP,
  getSeverityWeight,
  getSeverityDeduction,
} from "../severity";
import {
  CONFIDENCE_THRESHOLDS,
  applyConfidenceAdjustment,
  meetsConfidenceThreshold,
} from "../confidence";

describe("Severity Mapping & Confidence Handling", () => {
  it("maintains distinct concepts for severity and confidence", () => {
    // Severity is ordinal/categorical impact
    expect(SEVERITY_WEIGHTS.critical).toBeGreaterThan(SEVERITY_WEIGHTS.high);
    expect(SEVERITY_WEIGHTS.high).toBeGreaterThan(SEVERITY_WEIGHTS.medium);
    expect(SEVERITY_WEIGHTS.medium).toBeGreaterThan(SEVERITY_WEIGHTS.low);
    expect(SEVERITY_WEIGHTS.low).toBeGreaterThan(SEVERITY_WEIGHTS.info);

    // Confidence is continuous 0.0 - 1.0 certainty
    expect(CONFIDENCE_THRESHOLDS.HIGH).toBe(0.8);
    expect(CONFIDENCE_THRESHOLDS.MODERATE).toBe(0.5);
    expect(CONFIDENCE_THRESHOLDS.REVIEW_THRESHOLD).toBe(0.5);
  });

  it("applies calibrated deductions per severity level", () => {
    expect(getSeverityDeduction("critical")).toBe(8);
    expect(getSeverityDeduction("high")).toBe(5);
    expect(getSeverityDeduction("medium")).toBe(3);
    expect(getSeverityDeduction("low")).toBe(1.5);
    expect(getSeverityDeduction("info")).toBe(0); // Info never deducts
    expect(getSeverityDeduction(null)).toBe(0);
    expect(getSeverityDeduction(undefined)).toBe(0);
  });

  it("scales deductions proportionally with confidence", () => {
    const baseDeduction = SEVERITY_DEDUCTION_MAP.high; // 5

    // Full confidence (1.0) => 5 points
    expect(applyConfidenceAdjustment(baseDeduction, 1.0)).toBe(5);

    // Half confidence (0.5) => 2.5 points
    expect(applyConfidenceAdjustment(baseDeduction, 0.5)).toBe(2.5);

    // Zero confidence (0.0) => 0 points
    expect(applyConfidenceAdjustment(baseDeduction, 0.0)).toBe(0);

    // Clamping: confidence > 1.0 clamped to 1.0
    expect(applyConfidenceAdjustment(baseDeduction, 1.5)).toBe(5);

    // Clamping: confidence < 0.0 clamped to 0.0
    expect(applyConfidenceAdjustment(baseDeduction, -0.2)).toBe(0);
  });

  it("flags findings below review threshold (< 0.5) for human review", () => {
    expect(meetsConfidenceThreshold(1.0)).toBe(true);
    expect(meetsConfidenceThreshold(0.8)).toBe(true);
    expect(meetsConfidenceThreshold(0.5)).toBe(true);
    expect(meetsConfidenceThreshold(0.49)).toBe(false);
    expect(meetsConfidenceThreshold(0.2)).toBe(false);
  });

  it("retrieves ordinal weights for prioritisation", () => {
    expect(getSeverityWeight("critical")).toBe(5);
    expect(getSeverityWeight("high")).toBe(4);
    expect(getSeverityWeight("medium")).toBe(3);
    expect(getSeverityWeight("low")).toBe(2);
    expect(getSeverityWeight("info")).toBe(1);
    expect(getSeverityWeight(null)).toBe(0);
  });
});

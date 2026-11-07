import { describe, it, expect } from "vitest";
import { ScoreCalculator, type CheckScoreInput } from "../score";

describe("ScoreCalculator", () => {
  const calculator = new ScoreCalculator();

  it("calculates perfect score (100) when all applicable checks pass", () => {
    const inputs: CheckScoreInput[] = [
      { checkId: "A1", status: "passed", severity: null, confidence: 1.0 },
      { checkId: "D5", status: "passed", severity: null, confidence: 1.0 },
      { checkId: "B1", status: "passed", severity: null, confidence: 1.0 },
    ];

    const result = calculator.calculate(inputs);
    expect(result.score).toBe(100);
    expect(result.totalDeductions).toBe(0);
    expect(result.passedChecks).toBe(3);
    expect(result.issueChecks).toBe(0);
  });

  it("RULE 1: Not applicable checks must NOT reduce the score", () => {
    const inputs: CheckScoreInput[] = [
      { checkId: "A1", status: "passed", severity: null, confidence: 1.0 },
      { checkId: "A10", status: "not_applicable", severity: null, confidence: 1.0 },
      { checkId: "E2", status: "not_applicable", severity: null, confidence: 1.0 },
    ];

    const result = calculator.calculate(inputs);
    // Score remains 100 despite non-applicable checks
    expect(result.score).toBe(100);
    expect(result.notApplicableChecks).toBe(2);
    expect(result.passedChecks).toBe(1);
    expect(result.totalDeductions).toBe(0);
  });

  it("RULE 2: Unable to verify checks must NOT be presented as Passed and must NOT reduce the score", () => {
    const inputs: CheckScoreInput[] = [
      { checkId: "A1", status: "passed", severity: null, confidence: 1.0 },
      { checkId: "D1", status: "unable_to_verify", severity: null, confidence: 0.5 },
    ];

    const result = calculator.calculate(inputs);
    // Score does not deduct for unable_to_verify
    expect(result.score).toBe(100);
    expect(result.unableToVerifyChecks).toBe(1);
    expect(result.passedChecks).toBe(1);
    // Unverified ratio is tracked as risk metric
    expect(result.unverifiedRatio).toBe(0.5); // 1 out of 2 applicable
  });

  it("RULE 3: Only applicable Issue found results directly contribute to score deduction", () => {
    const inputs: CheckScoreInput[] = [
      // Critical issue with full confidence: 8 points
      { checkId: "D1", status: "issue_found", severity: "critical", confidence: 1.0 },
      // High issue with full confidence: 5 points
      { checkId: "A1", status: "issue_found", severity: "high", confidence: 1.0 },
      // Medium issue with 0.5 confidence: 3 * 0.5 = 1.5 points
      { checkId: "C1", status: "issue_found", severity: "medium", confidence: 0.5 },
      // Passed: 0 points
      { checkId: "D5", status: "passed", severity: null, confidence: 1.0 },
      // Not applicable: 0 points
      { checkId: "A10", status: "not_applicable", severity: null, confidence: 1.0 },
      // Unable to verify: 0 points
      { checkId: "D9", status: "unable_to_verify", severity: null, confidence: 0.5 },
    ];

    const result = calculator.calculate(inputs);
    // Total deductions = 8 + 5 + 1.5 = 14.5
    // Score = round(100 - 14.5) = round(85.5) = 86
    expect(result.totalDeductions).toBe(14.5);
    expect(result.score).toBe(86);
    expect(result.issueChecks).toBe(3);
    expect(result.passedChecks).toBe(1);
    expect(result.notApplicableChecks).toBe(1);
    expect(result.unableToVerifyChecks).toBe(1);
  });

  it("info-level findings do NOT deduct points", () => {
    const inputs: CheckScoreInput[] = [
      { checkId: "I1", status: "issue_found", severity: "info", confidence: 1.0 },
      { checkId: "D5", status: "passed", severity: null, confidence: 1.0 },
    ];

    const result = calculator.calculate(inputs);
    expect(result.score).toBe(100);
    expect(result.totalDeductions).toBe(0);
    expect(result.scoredFindings).toHaveLength(0);
  });

  it("clamps score to 0 when deductions exceed 100", () => {
    const inputs: CheckScoreInput[] = Array.from({ length: 20 }, (_, i) => ({
      checkId: `ISSUE_${i}`,
      status: "issue_found",
      severity: "critical", // 20 * 8 = 160 deductions
      confidence: 1.0,
    }));

    const result = calculator.calculate(inputs);
    expect(result.totalDeductions).toBe(160);
    expect(result.rawScore).toBe(-60);
    expect(result.score).toBe(0); // Clamped at 0
  });
});

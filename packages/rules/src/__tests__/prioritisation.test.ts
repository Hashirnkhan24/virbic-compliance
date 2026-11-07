import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { FindingRecord } from "@vibe/contracts";
import { FindingPrioritiser } from "../prioritisation";
import { CheckRegistry, WAVE_1_REGISTRY } from "../registry";

function createTestFinding(overrides: Partial<FindingRecord> = {}): FindingRecord {
  return {
    id: randomUUID(),
    scanId: randomUUID(),
    checkId: overrides.checkId ?? "A1",
    status: overrides.status ?? "issue_found",
    severity: overrides.severity !== undefined ? overrides.severity : "medium",
    confidence: overrides.confidence ?? 1.0,
    reasonCode: overrides.reasonCode ?? "TEST_REASON",
    title: overrides.title ?? "Test Title",
    summary: overrides.summary ?? "Test Summary",
    evidenceIds: overrides.evidenceIds ?? [],
    requiresHumanReview: overrides.requiresHumanReview ?? false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("FindingPrioritiser", () => {
  const registry = new CheckRegistry();
  registry.registerAll(WAVE_1_REGISTRY);
  const prioritiser = new FindingPrioritiser(registry);

  it("prioritises issue_found above unable_to_verify and passed", () => {
    const passedFinding = createTestFinding({
      checkId: "D5",
      status: "passed",
      severity: null,
    });
    const unableFinding = createTestFinding({
      checkId: "D1",
      status: "unable_to_verify",
      severity: null,
    });
    const issueFinding = createTestFinding({
      checkId: "A1",
      status: "issue_found",
      severity: "medium",
    });

    const prioritised = prioritiser.prioritise([passedFinding, unableFinding, issueFinding]);

    expect(prioritised[0]?.checkId).toBe("A1"); // issue_found first
    expect(prioritised[1]?.checkId).toBe("D1"); // unable_to_verify second
    expect(prioritised[2]?.checkId).toBe("D5"); // passed last
  });

  it("orders issues by severity (critical > high > medium > low > info)", () => {
    const lowIssue = createTestFinding({ checkId: "C10", severity: "low" });
    const criticalIssue = createTestFinding({ checkId: "D1", severity: "critical" });
    const mediumIssue = createTestFinding({ checkId: "C1", severity: "medium" });
    const highIssue = createTestFinding({ checkId: "A1", severity: "high" });

    const prioritised = prioritiser.prioritise([lowIssue, criticalIssue, mediumIssue, highIssue]);

    expect(prioritised[0]?.severity).toBe("critical");
    expect(prioritised[1]?.severity).toBe("high");
    expect(prioritised[2]?.severity).toBe("medium");
    expect(prioritised[3]?.severity).toBe("low");
  });

  it("uses confidence as tiebreaker for issues with same severity", () => {
    const lowConfHigh = createTestFinding({
      checkId: "A5",
      severity: "high",
      confidence: 0.5,
    });
    const highConfHigh = createTestFinding({
      checkId: "A1",
      severity: "high",
      confidence: 1.0,
    });

    const prioritised = prioritiser.prioritise([lowConfHigh, highConfHigh]);
    expect(prioritised[0]?.confidence).toBe(1.0);
    expect(prioritised[1]?.confidence).toBe(0.5);
  });

  it("extracts top N findings for free preview", () => {
    const findings: FindingRecord[] = Array.from({ length: 15 }, (_, i) =>
      createTestFinding({
        checkId: `ISSUE_${i}`,
        severity: i === 0 ? "critical" : "medium",
      })
    );

    const top5 = prioritiser.getTopFindings(findings, 5);
    expect(top5).toHaveLength(5);
    expect(top5[0]?.severity).toBe("critical");

    const top10 = prioritiser.getTopFindings(findings, 10);
    expect(top10).toHaveLength(10);
  });
});

import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { DetectorOutput } from "@vibe/contracts";
import { RulesEngine } from "../engine";
import { RULESET_VERSION } from "../versioning";
import {
  createMockDetectorOutput,
  createMockEvidenceRecord,
  createMockSnapshot,
} from "./test-helpers";

describe("RulesEngine (Full Evaluator Integration)", () => {
  it("orchestrates complete evaluation with score, exposure, findings, and metadata", () => {
    const engine = new RulesEngine();
    const scanId = randomUUID();

    // 1. Evidence records
    const privacyEv = createMockEvidenceRecord({ scanId });
    const tlsEv = createMockEvidenceRecord({ scanId });

    // 2. Detector outputs
    const detectorOutputs: DetectorOutput[] = [
      // High issue (missing privacy policy) with valid evidence: 5pt deduction
      createMockDetectorOutput({
        checkId: "A1",
        status: "issue_found",
        severity: "high",
        confidence: 1.0,
        evidenceIds: [privacyEv.id],
      }),
      // Passed security check: 0pt deduction
      createMockDetectorOutput({
        checkId: "D5",
        status: "passed",
        severity: null,
        confidence: 1.0,
        evidenceIds: [tlsEv.id],
      }),
    ];

    const snapshot = createMockSnapshot({ scanId });

    const result = engine.evaluate({
      scanId,
      detectorOutputs,
      evidenceRecords: [privacyEv, tlsEv],
      confirmedJurisdictions: ["india"],
      snapshot,
      scannerVersion: "1.2.3",
    });

    // 1. Score verification: 100 - 5 = 95
    expect(result.score).toBe(95);
    expect(result.scoreBreakdown.issueChecks).toBe(1);

    // 2. Metadata verification
    expect(result.metadata.rulesetVersion).toBe(RULESET_VERSION);
    expect(result.metadata.scannerVersion).toBe("1.2.3");
    expect(result.metadata.totalRegisteredChecks).toBeGreaterThanOrEqual(30);

    // 3. Status counts
    expect(result.statusCounts.issue_found).toBe(1);
    expect(result.statusCounts.passed).toBe(1);
    expect(result.severityCounts.high).toBe(1);

    // 4. Exposure summary (DPDP model applies to A1 in India)
    expect(result.exposureSummary.hasExposure).toBe(true);
    expect(result.exposureSummary.statutoryMaxInr).toBe(2500000000); // ₹250 Cr under DPDP
    expect(result.exposureSummary.applicableRegimes.some((r) => r.includes("DPDP"))).toBe(true);

    // 5. Findings prioritisation
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.topFindings[0]?.checkId).toBe("A1");
  });

  it("INVARIANT: Demotes issue to unable_to_verify when evidence is missing or unresolvable", () => {
    const engine = new RulesEngine();
    const scanId = randomUUID();

    // Detector claims issue found, but referenced evidence was NEVER saved
    const bogusEvidenceId = randomUUID();
    const detectorOutputs: DetectorOutput[] = [
      createMockDetectorOutput({
        checkId: "D1",
        status: "issue_found",
        severity: "critical",
        confidence: 1.0,
        evidenceIds: [bogusEvidenceId], // Not in evidenceRecords
      }),
    ];

    const result = engine.evaluate({
      scanId,
      detectorOutputs,
      evidenceRecords: [], // Empty!
      confirmedJurisdictions: ["india"],
    });

    const d1Finding = result.findings.find((f) => f.checkId === "D1");
    // Demoted to unable_to_verify, NEVER passed and NEVER deducted
    expect(d1Finding?.status).toBe("unable_to_verify");
    expect(d1Finding?.reasonCode).toBe("UNRESOLVED_EVIDENCE_REFERENCE");
    expect(d1Finding?.requiresHumanReview).toBe(true);

    // Score remains 100 because unverified issue does not deduct
    expect(result.score).toBe(100);
    expect(result.statusCounts.unable_to_verify).toBeGreaterThanOrEqual(1);
  });

  it("INVARIANT: Never sum overlapping statutory maximum caps across regimes", () => {
    const engine = new RulesEngine();
    const scanId = randomUUID();

    const ev = createMockEvidenceRecord({ scanId });

    // A1 triggers DPDP (₹250 Cr) and GDPR (~₹180 Cr) when both jurisdictions confirmed
    const detectorOutputs: DetectorOutput[] = [
      createMockDetectorOutput({
        checkId: "A1",
        status: "issue_found",
        severity: "high",
        evidenceIds: [ev.id],
      }),
    ];

    const result = engine.evaluate({
      scanId,
      detectorOutputs,
      evidenceRecords: [ev],
      confirmedJurisdictions: ["india", "eu"],
    });

    // Statutory max must be highest ceiling (₹250 Cr = 2.5B), NOT sum (₹250 Cr + ₹180 Cr = ₹430 Cr = 4.3B)
    expect(result.exposureSummary.statutoryMaxInr).toBe(2500000000);
    expect(result.exposureSummary.applicableRegimes).toHaveLength(2);
  });

  it("filters findings by user-confirmed jurisdiction strictly", () => {
    const engine = new RulesEngine();
    const scanId = randomUUID();
    const ev = createMockEvidenceRecord({ scanId });

    // A10 is California CCPA only
    const detectorOutputs: DetectorOutput[] = [
      createMockDetectorOutput({
        checkId: "A10",
        status: "issue_found",
        severity: "medium",
        evidenceIds: [ev.id],
      }),
    ];

    // Case 1: India confirmed only -> A10 marked not_applicable
    const indiaResult = engine.evaluate({
      scanId,
      detectorOutputs,
      evidenceRecords: [ev],
      confirmedJurisdictions: ["india"],
    });
    const a10IndiaFinding = indiaResult.findings.find((f) => f.checkId === "A10");
    expect(a10IndiaFinding?.status).toBe("not_applicable");
    expect(indiaResult.score).toBe(100); // Not applicable does not reduce score

    // Case 2: US confirmed -> A10 marked issue_found
    const usResult = engine.evaluate({
      scanId,
      detectorOutputs,
      evidenceRecords: [ev],
      confirmedJurisdictions: ["us"],
    });
    const a10UsFinding = usResult.findings.find((f) => f.checkId === "A10");
    expect(a10UsFinding?.status).toBe("issue_found");
    expect(usResult.score).toBeLessThan(100); // Deducted
  });
});

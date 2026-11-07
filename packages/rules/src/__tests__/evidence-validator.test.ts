import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { EvidenceValidator } from "../evidence-validator";
import { createMockDetectorOutput, createMockEvidenceRecord } from "./test-helpers";

describe("EvidenceValidator", () => {
  const validator = new EvidenceValidator();

  it("validates when all referenced evidence IDs exist in collected records", () => {
    const evidence1 = createMockEvidenceRecord();
    const evidence2 = createMockEvidenceRecord();

    const output = createMockDetectorOutput({
      status: "issue_found",
      severity: "high",
      evidenceIds: [evidence1.id, evidence2.id],
    });

    const result = validator.validate(output, [evidence1, evidence2]);
    expect(result.valid).toBe(true);
    expect(result.resolvedIds).toEqual([evidence1.id, evidence2.id]);
    expect(result.unresolvedIds).toHaveLength(0);
  });

  it("INVARIANT: Missing evidence cannot indicate compliance or pass", () => {
    const outputWithoutEvidence = createMockDetectorOutput({
      status: "issue_found",
      severity: "high",
      evidenceIds: [],
    });

    const result = validator.validate(outputWithoutEvidence, []);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("must reference at least one evidence record");
  });

  it("identifies unresolved evidence IDs when detector references non-existent records", () => {
    const validEvidence = createMockEvidenceRecord();
    const missingEvidenceId = randomUUID();

    const output = createMockDetectorOutput({
      status: "issue_found",
      severity: "medium",
      evidenceIds: [validEvidence.id, missingEvidenceId],
    });

    const result = validator.validate(output, [validEvidence]);
    expect(result.valid).toBe(false);
    expect(result.resolvedIds).toEqual([validEvidence.id]);
    expect(result.unresolvedIds).toEqual([missingEvidenceId]);
    expect(result.message).toContain("could not be resolved");
  });

  it("allows passed status with no evidence IDs", () => {
    const passedOutput = createMockDetectorOutput({
      status: "passed",
      severity: null,
      evidenceIds: [],
    });

    const result = validator.validate(passedOutput, []);
    expect(result.valid).toBe(true);
    expect(result.resolvedIds).toHaveLength(0);
    expect(result.unresolvedIds).toHaveLength(0);
  });

  it("validates a batch of detector outputs", () => {
    const ev1 = createMockEvidenceRecord();
    const out1 = createMockDetectorOutput({
      checkId: "A1",
      status: "issue_found",
      evidenceIds: [ev1.id],
    });
    const out2 = createMockDetectorOutput({
      checkId: "D5",
      status: "passed",
      evidenceIds: [],
    });
    const out3 = createMockDetectorOutput({
      checkId: "B2",
      status: "issue_found",
      evidenceIds: [randomUUID()], // Unresolvable
    });

    const batchResults = validator.validateBatch([out1, out2, out3], [ev1]);
    expect(batchResults.get("A1")?.valid).toBe(true);
    expect(batchResults.get("D5")?.valid).toBe(true);
    expect(batchResults.get("B2")?.valid).toBe(false);
  });
});

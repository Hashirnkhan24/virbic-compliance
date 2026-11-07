import { describe, it, expect } from "vitest";
import {
  CheckStatusSchema,
  ScanRequestSchema,
  SiteSnapshotSchema,
  DetectorOutputSchema,
  FreeScanPreviewSchema,
  FullScanReportSchema,
  EvidenceRecordSchema,
} from "../index";
import {
  fixtureSnapshot,
  fixtureEvidenceRecord,
  fixtureFreePreview,
  fixtureFullReport,
  sampleEvidenceId1,
} from "../fixtures/sample-data";

describe("Contracts & Zod Boundary Schemas", () => {
  describe("1. CheckStatusSchema", () => {
    it("accepts only the four approved statuses", () => {
      expect(CheckStatusSchema.safeParse("passed").success).toBe(true);
      expect(CheckStatusSchema.safeParse("issue_found").success).toBe(true);
      expect(CheckStatusSchema.safeParse("not_applicable").success).toBe(true);
      expect(CheckStatusSchema.safeParse("unable_to_verify").success).toBe(true);
    });

    it("rejects unauthorized statuses like 'failed', 'warning', 'unknown'", () => {
      expect(CheckStatusSchema.safeParse("failed").success).toBe(false);
      expect(CheckStatusSchema.safeParse("warning").success).toBe(false);
      expect(CheckStatusSchema.safeParse("unknown").success).toBe(false);
    });
  });

  describe("2. ScanRequestSchema", () => {
    it("validates a valid scan request with authorisation acknowledged", () => {
      const valid = {
        url: "https://mywebsite.com",
        authorisationAcknowledged: true,
      };
      const result = ScanRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects when authorisation acknowledgement is false or missing", () => {
      const invalid = {
        url: "https://mywebsite.com",
        authorisationAcknowledged: false,
      };
      const result = ScanRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects malformed URLs", () => {
      const invalid = {
        url: "not-a-valid-url",
        authorisationAcknowledged: true,
      };
      const result = ScanRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("3. DetectorOutputSchema & Invariants", () => {
    it("validates a valid passed detector output with empty evidenceIds", () => {
      const passedOutput = {
        checkId: "D5",
        checkVersion: "1.0.0",
        status: "passed",
        reasonCode: "HTTPS_ENFORCED",
        summary: "HTTPS is strictly enforced across the domain.",
        evidenceIds: [],
        confidence: 1.0,
        requiresHumanReview: false,
      };
      expect(DetectorOutputSchema.safeParse(passedOutput).success).toBe(true);
    });

    it("INVARIANT: rejects 'issue_found' if evidenceIds array is empty (no evidence = no issue)", () => {
      const invalidIssue = {
        checkId: "B2",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "high",
        reasonCode: "PRE_CONSENT_TRACKER",
        summary: "Tracker fired without consent",
        evidenceIds: [], // VIOLATION
        confidence: 1.0,
      };
      const result = DetectorOutputSchema.safeParse(invalidIssue);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain(
          "An issue_found status must reference at least one evidenceId"
        );
      }
    });

    it("INVARIANT: rejects 'issue_found' if severity is missing", () => {
      const missingSeverity = {
        checkId: "B2",
        checkVersion: "1.0.0",
        status: "issue_found",
        reasonCode: "PRE_CONSENT_TRACKER",
        summary: "Tracker fired without consent",
        evidenceIds: [sampleEvidenceId1],
        confidence: 1.0,
      };
      const result = DetectorOutputSchema.safeParse(missingSeverity);
      expect(result.success).toBe(false);
    });

    it("accepts 'unable_to_verify' without requiring an issue severity", () => {
      const unableToVerify = {
        checkId: "C1",
        checkVersion: "1.0.0",
        status: "unable_to_verify",
        reasonCode: "DOM_CAPTURE_TIMEOUT",
        summary: "Could not evaluate contrast because page timed out.",
        evidenceIds: [],
        confidence: 0.5,
        requiresHumanReview: true,
      };
      expect(DetectorOutputSchema.safeParse(unableToVerify).success).toBe(true);
    });
  });

  describe("4. SiteSnapshotSchema & Versioning", () => {
    it("validates a full capture fixture snapshot", () => {
      const result = SiteSnapshotSchema.safeParse(fixtureSnapshot);
      expect(result.success).toBe(true);
    });

    it("enforces schemaVersion on snapshots", () => {
      const missingVersion = { ...fixtureSnapshot, schemaVersion: undefined };
      const parsed = SiteSnapshotSchema.parse(missingVersion);
      expect(parsed.schemaVersion).toBe("1.0.0");
    });
  });

  describe("5. EvidenceRecordSchema Separation", () => {
    it("validates an evidence record independently of findings", () => {
      const result = EvidenceRecordSchema.safeParse(fixtureEvidenceRecord);
      expect(result.success).toBe(true);
    });
  });

  describe("6. Free Preview DTO vs Paid Full Report", () => {
    it("validates free scan preview structure and verifies isPaid is false", () => {
      const result = FreeScanPreviewSchema.safeParse(fixtureFreePreview);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isPaid).toBe(false);
        expect(result.data.topFindings.length).toBeLessThanOrEqual(10);
      }
    });

    it("validates full paid report and confirms isPaid is true", () => {
      const result = FullScanReportSchema.safeParse(fixtureFullReport);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isPaid).toBe(true);
        expect(result.data.evidenceList.length).toBeGreaterThan(0);
      }
    });
  });
});

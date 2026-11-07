import { describe, it, expect } from "vitest";
import { ReportGenerator } from "../generator";
import { createMockEvaluationResult } from "./test-helpers";

describe("Report Engine Blueprint Invariants", () => {
  const generator = new ReportGenerator();

  it("INVARIANT 1: Both templates use the exact same underlying scan results & score", () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();

    const founderReport = generator.generateStructuredReport(snapshot, evaluation, evidenceRecords, {
      presentationType: "founder_launch",
    });

    const agencyReport = generator.generateStructuredReport(snapshot, evaluation, evidenceRecords, {
      presentationType: "agency_handover",
    });

    // Score and mathematical deductions are identical
    expect(founderReport.score).toBe(agencyReport.score);
    expect(founderReport.checkSummary).toEqual(agencyReport.checkSummary);

    // Finding counts and IDs are identical
    expect(founderReport.allFindings.length).toBe(agencyReport.allFindings.length);
    expect(founderReport.allFindings.map((f) => f.checkId)).toEqual(
      agencyReport.allFindings.map((f) => f.checkId)
    );

    // Financial exposure calculations are identical
    expect(founderReport.exposureSummary).toEqual(agencyReport.exposureSummary);
  });

  it("INVARIANT 2: Reports NEVER claim legal certification, compliance guarantees, or 100% compliance", () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();

    const founderHtml = generator.generateHtmlReport(snapshot, evaluation, evidenceRecords, {
      presentationType: "founder_launch",
    });
    const agencyHtml = generator.generateHtmlReport(snapshot, evaluation, evidenceRecords, {
      presentationType: "agency_handover",
    });

    for (const html of [founderHtml, agencyHtml]) {
      // Forbidden marketing claims
      const lower = html.toLowerCase();
      expect(lower.includes("100% compliant")).toBe(false);
      expect(lower.includes("certified compliant")).toBe(false);
      expect(lower.includes("compliance guarantee")).toBe(false);
      expect(lower.includes("full penetration test")).toBe(false);
      expect(lower.includes("legally safe")).toBe(false);

      // Mandatory disclaimers must be present
      expect(html).toContain("IMPORTANT LEGAL DISCLAIMER");
      expect(html).toContain("does NOT constitute legal advice");
    }
  });

  it("INVARIANT 3: Every issue finding references actual evidence records", () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();
    const structured = generator.generateStructuredReport(snapshot, evaluation, evidenceRecords);

    const issueFindings = structured.allFindings.filter((f) => f.status === "issue_found");
    expect(issueFindings.length).toBeGreaterThan(0);

    for (const finding of issueFindings) {
      expect(finding.evidenceList.length).toBeGreaterThan(0);
      for (const ev of finding.evidenceList) {
        expect(ev.contentHash).toBeDefined();
        expect(ev.contentHash.length).toBe(64); // SHA-256
      }
    }
  });

  it("INVARIANT 4: Exposure models use non-additive statutory maximums", () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();
    const structured = generator.generateStructuredReport(snapshot, evaluation, evidenceRecords);

    if (structured.exposureSummary.hasExposure) {
      // DPDP statutory max is ₹250 Cr (2,500,000,000)
      expect(structured.exposureSummary.statutoryMaxInr).toBe(2500000000);
      expect(structured.exposureSummary.statutoryMaxFormattedInr).toBe("₹250 Cr");
    }
  });

  it("INVARIANT 5: Customer-confirmed jurisdictions strictly govern applicability notes", () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();
    const structured = generator.generateStructuredReport(snapshot, evaluation, evidenceRecords);

    expect(structured.jurisdictionNotes.confirmedJurisdictions).toEqual(["india"]);
    expect(structured.jurisdictionNotes.applicabilityNote).toContain("never inferred from server IP");
  });
});

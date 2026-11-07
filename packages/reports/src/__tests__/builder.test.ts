import { describe, it, expect } from "vitest";
import { ReportDataBuilder, formatInr } from "../builder";
import { StructuredReportSchema } from "../types";
import { createMockEvaluationResult } from "./test-helpers";

describe("ReportDataBuilder", () => {
  it("builds a Zod-validated StructuredReport from scan artifacts", () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();
    const builder = new ReportDataBuilder();

    const report = builder.build(snapshot, evaluation, evidenceRecords, {
      presentationType: "founder_launch",
      clientName: "Acme Founder",
    });

    // Validates against strict schema
    const parsed = StructuredReportSchema.safeParse(report);
    expect(parsed.success).toBe(true);

    // Basic metadata
    expect(report.scanId).toBe(snapshot.scanId);
    expect(report.websiteOverview.targetHost).toBe("acme-startup.com");
    expect(report.score).toBe(evaluation.score);
  });

  it("populates website overview including TLS, technologies, and pages crawled", () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();
    const builder = new ReportDataBuilder();

    const report = builder.build(snapshot, evaluation, evidenceRecords);
    const overview = report.websiteOverview;

    expect(overview.targetUrl).toBe("https://acme-startup.com");
    expect(overview.pagesCrawledCount).toBe(2);
    expect(overview.tlsSummary.valid).toBe(true);
    expect(overview.tlsSummary.enforcesHttps).toBe(true);
    expect(overview.tlsSummary.issuer).toContain("Let's Encrypt");
    expect(overview.detectedTechnologies).toContain("CDN / Cloudflare");
    expect(overview.hasEcommerce).toBe(true); // Pricing page present
    expect(overview.collectsPersonalData).toBe(true); // Contact form present
  });

  it("calculates correct check summary and unverified ratio", () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();
    const builder = new ReportDataBuilder();

    const report = builder.build(snapshot, evaluation, evidenceRecords);
    const summary = report.checkSummary;

    expect(summary.totalEvaluated).toBeGreaterThan(0);
    expect(summary.passed).toBeGreaterThanOrEqual(1);
    expect(summary.issueFound).toBeGreaterThanOrEqual(2); // A1 and D1
    expect(summary.severityCounts.critical).toBeGreaterThanOrEqual(1); // D1
    expect(summary.severityCounts.high).toBeGreaterThanOrEqual(1); // A1
  });

  it("attaches evidence with SHA-256 hashes to detailed findings", () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();
    const builder = new ReportDataBuilder();

    const report = builder.build(snapshot, evaluation, evidenceRecords);
    const d1Finding = report.allFindings.find((f) => f.checkId === "D1");

    expect(d1Finding).toBeDefined();
    expect(d1Finding?.evidenceList.length).toBeGreaterThan(0);
    expect(d1Finding?.evidenceList[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(d1Finding?.evidenceList[0]?.sourceLocator).toBe("main.js");
  });

  it("resolves remediation templates with actionable steps and estimates", () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();
    const builder = new ReportDataBuilder();

    const report = builder.build(snapshot, evaluation, evidenceRecords);
    const a1Finding = report.allFindings.find((f) => f.checkId === "A1");

    expect(a1Finding?.remediation).toBeDefined();
    expect(a1Finding?.remediation?.id).toBe("create_privacy_policy");
    expect(a1Finding?.remediation?.steps.length).toBeGreaterThan(0);
    expect(a1Finding?.remediation?.timeToFixEstimate).toBe("45 mins");
    expect(a1Finding?.remediation?.clientActionRequired).toBe(true);
  });

  it("includes 'Why This Matters' business & legal rationales", () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();
    const builder = new ReportDataBuilder();

    const report = builder.build(snapshot, evaluation, evidenceRecords);
    const a1 = report.allFindings.find((f) => f.checkId === "A1");
    const d1 = report.allFindings.find((f) => f.checkId === "D1");

    expect(a1?.whyItMatters).toContain("DPDP");
    expect(d1?.whyItMatters).toContain("compromise backend infrastructure");
  });

  it("formats Indian currency amounts properly", () => {
    expect(formatInr(2500000000)).toBe("₹250 Cr");
    expect(formatInr(5000000)).toBe("₹50 Lakh");
    expect(formatInr(25000)).toBe("₹25,000");
  });
});

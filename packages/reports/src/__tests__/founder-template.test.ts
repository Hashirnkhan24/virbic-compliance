import { describe, it, expect } from "vitest";
import { ReportGenerator } from "../generator";
import { createMockEvaluationResult } from "./test-helpers";

describe("SaaS Founder Launch Report Template", () => {
  const generator = new ReportGenerator();

  it("renders the SaaS Founder Launch Report HTML with founder-specific triage sections", () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();

    const html = generator.generateHtmlReport(snapshot, evaluation, evidenceRecords, {
      presentationType: "founder_launch",
      clientName: "Alex Founder",
    });

    // Presentation headings
    expect(html).toContain("SaaS Founder Pre-Launch Risk &amp; Readiness Assessment");
    expect(html).toContain("Founder Triage");
    expect(html).toContain("Founder Launch Triage Action Plan");

    // Host & target URL
    expect(html).toContain("acme-startup.com");
    expect(html).toContain("https://acme-startup.com");

    // Score and triage decision
    expect(html).toContain(`${evaluation.score}`);
    expect(html).toContain("Launch Readiness Status");

    // Findings and evidence
    expect(html).toContain("Highest-Priority Findings &amp; Action Items");
    expect(html).toContain("A1");
    expect(html).toContain("D1");
    expect(html).toContain("Supporting Evidence");
    expect(html).toContain("SHA-256:");

    // Print CSS
    expect(html).toContain("@media print");
    expect(html).toContain("page-break-before: always;");

    // Legal disclaimer
    expect(html).toContain("IMPORTANT LEGAL DISCLAIMER");
    expect(html).toContain("does NOT constitute legal advice");
  });
});

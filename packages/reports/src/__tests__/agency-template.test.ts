import { describe, it, expect } from "vitest";
import { ReportGenerator } from "../generator";
import { createMockEvaluationResult } from "./test-helpers";

describe("Agency Client Handover Report Template", () => {
  const generator = new ReportGenerator();

  it("renders the Agency Client Handover Report with QA sign-off block and client responsibility tags", () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();

    const html = generator.generateHtmlReport(snapshot, evaluation, evidenceRecords, {
      presentationType: "agency_handover",
      agencyName: "Apex Web Studio",
      clientName: "Enterprise Client Corp",
    });

    // Presentation headings
    expect(html).toContain("Agency Client Handover &amp; Compliance QA Sign-Off");
    expect(html).toContain("Handover Audit");
    expect(html).toContain("Agency Quality &amp; Handover Notice");

    // Client and agency mentions
    expect(html).toContain("Apex Web Studio");
    expect(html).toContain("Enterprise Client Corp");

    // Handover sign-off block with signature lines
    expect(html).toContain("Handover Acceptance &amp; Compliance Sign-Off");
    expect(html).toContain("Agency Delivery Representative");
    expect(html).toContain("Client Acceptance Representative");
    expect(html).toContain("signoff-line");

    // Client action required indicator on privacy policy
    expect(html).toContain("Client Action Required");

    // Print optimization
    expect(html).toContain("@media print");
    expect(html).toContain("break-inside: avoid;");

    // Invariant: Never claim legal certification
    expect(html.includes("certified legally safe")).toBe(false);
    expect(html.includes("100% compliant")).toBe(false);
    expect(html).toContain("IMPORTANT LEGAL DISCLAIMER");
  });
});

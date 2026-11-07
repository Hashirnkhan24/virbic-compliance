import { describe, it, expect } from "vitest";
import type { FindingRecord, EvidenceRecord } from "@vibe/contracts";
import { generateFixingPrompt, generateCombinedFixingKit } from "../prompt-generator";

describe("AI Fixing Kit Prompt Generator", () => {
  const mockFinding: FindingRecord = {
    id: "11111111-1111-1111-1111-111111111111",
    scanId: "22222222-2222-2222-2222-222222222222",
    checkId: "A1",
    status: "issue_found",
    severity: "critical",
    confidence: 1.0,
    reasonCode: "privacy_policy_missing",
    title: "Privacy policy is missing or inaccessible",
    summary: "No accessible privacy policy link was detected in the global navigation or footer.",
    evidenceIds: ["33333333-3333-3333-3333-333333333333"],
    remediation: "create_privacy_policy",
    requiresHumanReview: false,
    createdAt: new Date().toISOString(),
  };

  const mockEvidence: EvidenceRecord = {
    id: "33333333-3333-3333-3333-333333333333",
    scanId: "22222222-2222-2222-2222-222222222222",
    evidenceType: "dom_element",
    pageUrl: "https://example.com/",
    sourceLocator: "footer nav",
    structuredValue: { linksChecked: ["/about", "/terms", "/blog"] },
    contentHash: "hash123",
    observedAt: new Date().toISOString(),
  };

  it("generates a structured 10-point fixing prompt for an individual finding", () => {
    const prompt = generateFixingPrompt(mockFinding, [mockEvidence], {
      targetUrl: "https://example.com",
    });

    expect(prompt).toContain("Fix Task: [A1] Privacy policy is missing or inaccessible");
    expect(prompt).toContain("### 1. Issue Identified");
    expect(prompt).toContain("### 2. Why It Matters");
    expect(prompt).toContain("### 3. Exact Evidence Observed");
    expect(prompt).toContain("### 4. Relevant Location");
    expect(prompt).toContain("### 5. Desired Outcome");
    expect(prompt).toContain("### 6. Step-by-Step Instructions for Coding Agent");
    expect(prompt).toContain("### 7. Constraints to Prevent Regressions");
    expect(prompt).toContain("### 8. Acceptance Criteria");
    expect(prompt).toContain("### 9. How to Test and Verify");
    expect(prompt).toContain("### 10. Summary & Handoff");

    // Must cite the real evidence location
    expect(prompt).toContain("Page: https://example.com/ (Selector: `footer nav`)");
    // Must contain constraints against inventing policies
    expect(prompt).toContain("Do not invent legal entities");
  });

  it("generates a combined prompt when multiple findings exist", () => {
    const combined = generateCombinedFixingKit(
      [
        mockFinding,
        {
          ...mockFinding,
          id: "44444444-4444-4444-4444-444444444444",
          checkId: "C1",
          title: "Images missing descriptive alt text",
          summary: "Observed 3 images with missing alt attributes.",
        },
      ],
      [mockEvidence],
      { targetUrl: "https://example.com" }
    );

    expect(combined).toContain("# AI Fixing Kit: Website Launch Readiness Plan");
    expect(combined).toContain("Total Issues to Resolve: 2");
    expect(combined).toContain("## Issue #1 of 2: [A1]");
    expect(combined).toContain("## Issue #2 of 2: [C1]");
    expect(combined).toContain("## Final Verification Checklist");
  });
});

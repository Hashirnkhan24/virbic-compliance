import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type {
  DetectorOutput,
} from "@vibe/contracts";
import { RulesEngine } from "@vibe/rules";
import { ReportGenerator } from "../generator";
import { PdfGenerator } from "../pdf/pdf-generator";
import {
  createMockEvidenceRecord,
  createMockSnapshot,
  createMockEvaluationResult,
} from "./test-helpers";

describe("Stage 13: PDF Generation Engine", () => {
  const generator = new ReportGenerator();
  const pdfGenerator = new PdfGenerator();

  it("generates a valid binary PDF buffer starting with '%PDF-' via Chromium", async () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();
    const structuredReport = generator.generateStructuredReport(
      snapshot,
      evaluation,
      evidenceRecords,
      { presentationType: "founder_launch" }
    );

    const result = await pdfGenerator.generatePdf(structuredReport, {
      uploadToBlob: false, // Local buffer test
    });

    expect(result.pdfBuffer).toBeInstanceOf(Buffer);
    expect(result.sizeBytes).toBeGreaterThan(10000);
    expect(result.contentType).toBe("application/pdf");

    // PDF magic number header verification
    const magicHeader = result.pdfBuffer.subarray(0, 5).toString("ascii");
    expect(magicHeader).toBe("%PDF-");
  }, 30000);

  it("stores generated PDF in Vercel Blob with 30-day lifecycle expiry", async () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();
    const structuredReport = generator.generateStructuredReport(
      snapshot,
      evaluation,
      evidenceRecords,
      { presentationType: "agency_handover", agencyName: "Alpha Agency" }
    );

    const result = await pdfGenerator.generatePdf(structuredReport, {
      uploadToBlob: true,
      expiresInDays: 30,
    });

    expect(result.blobKey).toBeDefined();
    expect(result.blobKey).toContain("reports/");
    expect(result.blobKey).toContain(".pdf");
    expect(result.blobUrl).toBeDefined();
    expect(result.expiresAt).toBeDefined();

    // Verify 30-day expiration window
    const expiryDate = new Date(result.expiresAt!);
    const thirtyDaysFuture = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000);
    expect(expiryDate.getTime()).toBeGreaterThan(thirtyDaysFuture.getTime());
  }, 30000);

  it("TEST SCENARIO 1: Short website (1-2 pages, small scope)", async () => {
    const scanId = randomUUID();
    const shortSnapshot = createMockSnapshot({
      scanId,
      canonicalOrigin: "https://minimal-portfolio.dev",
      targetHost: "minimal-portfolio.dev",
      pages: [
        {
          url: "https://minimal-portfolio.dev/",
          finalUrl: "https://minimal-portfolio.dev/",
          httpStatus: 200,
          pageType: "home",
          title: "Minimal Developer Portfolio",
          hasLoginForm: false,
          hasPaymentForm: false,
          hasContactForm: false,
          loadDurationMs: 120,
          capturedAt: new Date().toISOString(),
        },
      ],
    });

    const ev = createMockEvidenceRecord({
      scanId,
      evidenceType: "header",
      sourceLocator: "X-Frame-Options",
    });

    const engine = new RulesEngine();
    const detectorOutputs: DetectorOutput[] = [
      {
        checkId: "D6",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "SECURITY_HEADERS_OK",
        summary: "Essential security headers present.",
        evidenceIds: [ev.id],
        requiresHumanReview: false,
      },
    ];

    const evaluation = engine.evaluate({
      scanId,
      detectorOutputs,
      evidenceRecords: [ev],
      confirmedJurisdictions: ["india"],
      snapshot: shortSnapshot,
    });

    const result = await generator.generatePdf({
      snapshot: shortSnapshot,
      evaluation,
      evidenceRecords: [ev],
      options: { presentationType: "founder_launch" },
    });

    expect(result.sizeBytes).toBeGreaterThan(5000);
    expect(result.pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  }, 30000);

  it("TEST SCENARIO 2: Long website (15+ pages, long URLs, large findings, multi-module)", async () => {
    const scanId = randomUUID();

    // Generate 15 distinct pages
    const pageTypes = [
      "home", "pricing", "checkout", "contact", "about",
      "privacy", "terms", "cookies", "refund", "shipping",
      "login", "signup", "general", "general", "general"
    ] as const;

    const pages = pageTypes.map((pageType, i) => ({
      url: `https://enterprise-saas.com/en-us/deep/nested/path/section-${i}/catalog/item-super-long-url-slug-designed-to-verify-word-wrapping-and-margin-containment-in-chromium-pdf?tracking_id=xyz-1234567890&session_id=abcdef-0987654321`,
      finalUrl: `https://enterprise-saas.com/en-us/deep/nested/path/section-${i}/catalog/item-super-long-url-slug-designed-to-verify-word-wrapping-and-margin-containment-in-chromium-pdf?tracking_id=xyz-1234567890&session_id=abcdef-0987654321`,
      httpStatus: 200,
      pageType,
      title: `Enterprise Page ${i} — Comprehensive Overview`,
      hasLoginForm: pageType === "login",
      hasPaymentForm: pageType === "checkout",
      hasContactForm: pageType === "contact",
      loadDurationMs: 400 + i * 20,
      capturedAt: new Date().toISOString(),
    }));

    const longSnapshot = createMockSnapshot({
      scanId,
      canonicalOrigin: "https://enterprise-saas.com",
      targetHost: "enterprise-saas.com",
      pages,
    });

    // Generate multi-module evidence and findings
    const ev1 = createMockEvidenceRecord({
      scanId,
      evidenceType: "dom_element",
      pageUrl: pages[0]!.url,
      sourceLocator: "div.super-deep-nested-container > form > input[type='text'].long-selector-name",
      structuredValue: {
        rawSnippet: "const token = 'api_token_mock_string_for_testing_purposes';",
        occurrences: 42,
      },
    });

    const ev2 = createMockEvidenceRecord({
      scanId,
      evidenceType: "cookie",
      pageUrl: pages[1]!.url,
      sourceLocator: "Cookie:_ga_session_tracking_token_enterprise",
      structuredValue: {
        cookieName: "_ga_session_tracking_token_enterprise",
        httpOnly: false,
        secure: false,
      },
    });

    const engine = new RulesEngine();
    const detectorOutputs: DetectorOutput[] = [
      {
        checkId: "D1",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "critical",
        confidence: 0.98,
        reasonCode: "EXPOSED_SECRET",
        summary: "Leaked credentials discovered in client JavaScript bundle.",
        evidenceIds: [ev1.id],
        remediationTemplateId: "revoke_and_rotate_exposed_secrets",
        requiresHumanReview: false,
      },
      {
        checkId: "D7",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "high",
        confidence: 1.0,
        reasonCode: "INSECURE_COOKIE_FLAGS",
        summary: "Authentication cookie lacks HttpOnly and Secure flags.",
        evidenceIds: [ev2.id],
        remediationTemplateId: "set_secure_cookie_flags",
        requiresHumanReview: false,
      },
      {
        checkId: "A1",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "high",
        confidence: 1.0,
        reasonCode: "PRIVACY_POLICY_MISSING",
        summary: "Privacy policy missing from footer.",
        evidenceIds: [ev1.id],
        remediationTemplateId: "create_privacy_policy",
        requiresHumanReview: false,
      },
    ];

    const evaluation = engine.evaluate({
      scanId,
      detectorOutputs,
      evidenceRecords: [ev1, ev2],
      confirmedJurisdictions: ["india", "eu"],
      snapshot: longSnapshot,
    });

    const result = await generator.generatePdf({
      snapshot: longSnapshot,
      evaluation,
      evidenceRecords: [ev1, ev2],
      options: { presentationType: "agency_handover", clientName: "Enterprise Global Corp", agencyName: "Mega Digital Agency" },
    });

    // Multi-page PDF generated cleanly
    expect(result.sizeBytes).toBeGreaterThan(25000);
    expect(result.pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  }, 35000);

  it("TEST SCENARIO 3: Partial scan results (unverified checks, stage errors, warnings)", async () => {
    const scanId = randomUUID();

    const partialSnapshot = createMockSnapshot({
      scanId,
      incompleteStages: ["browser_capture", "accessibility_audit"],
      collectionWarnings: [
        "Network timeout while crawling /checkout subpage after 15,000ms.",
        "Axe accessibility scan was partially interrupted by client-side navigation.",
      ],
    });

    const engine = new RulesEngine();
    // Simulate detector outputs with unable_to_verify checks
    const detectorOutputs: DetectorOutput[] = [
      {
        checkId: "C1",
        checkVersion: "1.0.0",
        status: "unable_to_verify",
        severity: null,
        confidence: 0,
        reasonCode: "STAGE_TIMEOUT",
        summary: "Accessibility audit timed out before all images could be inspected.",
        evidenceIds: [],
        requiresHumanReview: true,
      },
      {
        checkId: "D5",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "TLS_VALID",
        summary: "TLS verified successfully.",
        evidenceIds: [],
        requiresHumanReview: false,
      },
    ];

    const evaluation = engine.evaluate({
      scanId,
      detectorOutputs,
      evidenceRecords: [],
      confirmedJurisdictions: ["india"],
      snapshot: partialSnapshot,
    });

    expect(evaluation.scoreBreakdown.unverifiedRatio).toBeGreaterThan(0);

    const result = await generator.generatePdf({
      snapshot: partialSnapshot,
      evaluation,
      evidenceRecords: [],
      options: { presentationType: "founder_launch" },
    });

    expect(result.sizeBytes).toBeGreaterThan(5000);
    expect(result.pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  }, 30000);

  it("generates full report package (StructuredReport + HTML + PDF) in a single unified call", async () => {
    const { snapshot, evaluation, evidenceRecords } = createMockEvaluationResult();

    const fullPackage = await generator.generateFullPackage(
      snapshot,
      evaluation,
      evidenceRecords,
      { presentationType: "founder_launch" }
    );

    // 1. Structured data
    expect(fullPackage.structuredReport).toBeDefined();
    expect(fullPackage.structuredReport.score).toBe(evaluation.score);

    // 2. HTML
    expect(fullPackage.html).toContain("<!DOCTYPE html>");
    expect(fullPackage.html).toContain("acme-startup.com");

    // 3. PDF
    expect(fullPackage.pdf.sizeBytes).toBeGreaterThan(10000);
    expect(fullPackage.pdf.blobKey).toBeDefined();
    expect(fullPackage.pdf.blobUrl).toBeDefined();
  }, 30000);
});

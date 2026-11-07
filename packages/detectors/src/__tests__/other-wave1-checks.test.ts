import { describe, it, expect, beforeEach } from "vitest";
import {
  f7PaymentGatewaySignalsCheck,
  g6FontIconLicencesCheck,
  g9EmbeddedMediaCheck,
  h1BrokenLinksCheck,
  h3CorePagePresenceCheck,
  h4MobilePerformanceCheck,
  h5BrokenAssetsCheck,
  h7NavigationInteractionsCheck,
  i1ScriptInventoryCheck,
  i2PayloadLeakSignalsCheck,
  i3ScriptIntegrityCheck,
} from "../index";
import { DetectionEngine } from "../framework/detection-engine";
import { createMockSnapshot, createMockContext, createMockAsset } from "./test-helpers";

describe("Wave 1 Consumer, IP, Quality, and Third-Party Checks", () => {
  let engine: DetectionEngine;

  beforeEach(() => {
    engine = new DetectionEngine();
    engine.register(f7PaymentGatewaySignalsCheck);
    engine.register(g6FontIconLicencesCheck);
    engine.register(g9EmbeddedMediaCheck);
    engine.register(h1BrokenLinksCheck);
    engine.register(h3CorePagePresenceCheck);
    engine.register(h4MobilePerformanceCheck);
    engine.register(h5BrokenAssetsCheck);
    engine.register(h7NavigationInteractionsCheck);
    engine.register(i1ScriptInventoryCheck);
    engine.register(i2PayloadLeakSignalsCheck);
    engine.register(i3ScriptIntegrityCheck);
  });

  describe("F7: Payment gateway signals", () => {
    it("is not applicable if site has no payment capture", async () => {
      const snapshot = createMockSnapshot();
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("F7", snapshot, ctx);
      expect(res.status).toBe("not_applicable");
    });

    it("flags critical issue when credit card inputs are captured directly without gateway SDK", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/checkout",
            finalUrl: "https://example.com/checkout",
            httpStatus: 200,
            pageType: "checkout",
            title: "Checkout",
            hasPaymentForm: true,
            hasLoginForm: false,
            hasContactForm: false,
            domFacts: {
              formsData: [
                {
                  hasPaymentFields: true,
                  action: "/process-card-raw",
                },
              ],
            },
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("F7", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("critical");
      expect(res.reasonCode).toBe("RAW_CARD_CAPTURE_WITHOUT_GATEWAY_SDK");
    });

    it("passes when checkout uses a certified provider like Razorpay or Stripe", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/checkout",
            finalUrl: "https://example.com/checkout",
            httpStatus: 200,
            pageType: "checkout",
            title: "Checkout",
            hasPaymentForm: true,
            hasLoginForm: false,
            hasContactForm: false,
            domFacts: {
              formsData: [{ hasPaymentFields: true }],
            },
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
        networkRequests: [
          {
            id: "123e4567-e89b-12d3-a456-426614174000",
            url: "https://checkout.razorpay.com/v1/checkout.js",
            method: "GET",
            resourceType: "script",
            isThirdParty: true,
            requestHeaders: [],
            timestamp: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("F7", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("CERTIFIED_PAYMENT_GATEWAY_DETECTED");
    });
  });

  describe("G6: Font and icon licences", () => {
    it("flags advisory issue when proprietary font files are directly self-hosted", async () => {
      const snapshot = createMockSnapshot({
        networkRequests: [
          {
            id: "123e4567-e89b-12d3-a456-426614174001",
            url: "https://example.com/fonts/helvetica-neue.woff2",
            method: "GET",
            resourceType: "font",
            isThirdParty: false,
            requestHeaders: [],
            timestamp: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("G6", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("low");
      expect(res.reasonCode).toBe("UNVERIFIED_PROPRIETARY_FONT_ASSET");
    });
  });

  describe("G9: Third-party embedded media", () => {
    it("flags issue when YouTube embed uses standard tracking domain instead of youtube-nocookie", async () => {
      const snapshot = createMockSnapshot({
        networkRequests: [
          {
            id: "123e4567-e89b-12d3-a456-426614174002",
            url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            method: "GET",
            resourceType: "document",
            isThirdParty: true,
            requestHeaders: [],
            timestamp: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("G9", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("low");
      expect(res.reasonCode).toBe("MEDIA_EMBED_TRACKING_NOT_MINIMIZED");
    });
  });

  describe("H1: Broken links and 404s", () => {
    it("flags issue when internal page returns 404", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/broken-page",
            finalUrl: "https://example.com/broken-page",
            httpStatus: 404,
            pageType: "general",
            title: "404 Not Found",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 150,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("H1", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.reasonCode).toBe("BROKEN_INTERNAL_LINKS_DETECTED");
    });
  });

  describe("H3: Missing core pages", () => {
    it("flags issue when multiple foundational pages (About, Contact, Legal) are missing", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/",
            finalUrl: "https://example.com/",
            httpStatus: 200,
            pageType: "home",
            title: "Just Home",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("H3", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.reasonCode).toBe("MULTIPLE_CORE_PAGES_MISSING");
    });
  });

  describe("H4: Mobile and performance basics", () => {
    it("flags issue when page load duration exceeds 8,000ms", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/",
            finalUrl: "https://example.com/",
            httpStatus: 200,
            pageType: "home",
            title: "Slow Page",
            viewport: "width=device-width, initial-scale=1",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 9500,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("H4", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.reasonCode).toBe("SUBOPTIMAL_PAGE_PERFORMANCE_OR_VIEWPORT");
    });
  });

  describe("H5: Broken images/assets", () => {
    it("flags issue when asset returns HTTP 500 error", async () => {
      const snapshot = createMockSnapshot({
        assets: [
          createMockAsset({
            url: "https://example.com/logo.png",
            assetType: "image",
            httpStatus: 500,
            isBroken: true,
          }),
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("H5", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("low");
      expect(res.reasonCode).toBe("BROKEN_ASSETS_DETECTED");
    });
  });

  describe("H7: Buttons and navigation work", () => {
    it("flags issue when excessive dead void links are detected", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/",
            finalUrl: "https://example.com/",
            httpStatus: 200,
            pageType: "home",
            title: "Home",
            domFacts: {
              deadLinks: [
                { text: "Item 1", href: "javascript:void(0)" },
                { text: "Item 2", href: "#" },
                { text: "Item 3", href: "" },
              ],
            },
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("H7", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("low");
      expect(res.reasonCode).toBe("DEAD_OR_EMPTY_NAVIGATION_CONTROLS");
    });
  });

  describe("I1: Third-party script inventory", () => {
    it("flags issue when site loads scripts from over 10 distinct third-party domains", async () => {
      const externalRequests = Array.from({ length: 12 }, (_, i) => ({
        id: `123e4567-e89b-12d3-a456-4266141740${i.toString().padStart(2, "0")}`,
        url: `https://tracker${i}.external-ad-network.com/tag.js`,
        method: "GET" as const,
        resourceType: "script" as const,
        isThirdParty: true,
        requestHeaders: [],
        timestamp: new Date().toISOString(),
      }));

      const snapshot = createMockSnapshot({ networkRequests: externalRequests });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("I1", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.reasonCode).toBe("EXCESSIVE_THIRD_PARTY_SCRIPTS");
    });
  });

  describe("I2: Sensitive data sent to third parties", () => {
    it("flags critical issue when user email or password is sent in third-party query string", async () => {
      const snapshot = createMockSnapshot({
        networkRequests: [
          {
            id: "123e4567-e89b-12d3-a456-426614174099",
            url: "https://ad-network.example/collect?email=user@example.com&tracking_id=123",
            method: "GET",
            resourceType: "xhr",
            isThirdParty: true,
            requestHeaders: [],
            timestamp: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("I2", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("critical");
      expect(res.reasonCode).toBe("SENSITIVE_DATA_LEAKED_TO_THIRD_PARTY");

      // Verify email is redacted in evidence
      const evId = res.evidenceIds[0]!;
      const ev = ctx.evidenceCollector.getEvidenceById(evId);
      expect(JSON.stringify(ev?.structuredValue).includes("user@example.com")).toBe(false);
      expect(JSON.stringify(ev?.structuredValue).includes("[REDACTED]")).toBe(true);
    });
  });

  describe("I3: Third-party script integrity and risk", () => {
    it("flags issue when public CDN scripts lack SRI hash attributes", async () => {
      const snapshot = createMockSnapshot({
        assets: [
          createMockAsset({
            url: "https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js",
            assetType: "script",
            httpStatus: 200,
            isBroken: false,
            hasSri: false,
          }),
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("I3", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.reasonCode).toBe("MISSING_SUBRESOURCE_INTEGRITY");
    });
  });
});

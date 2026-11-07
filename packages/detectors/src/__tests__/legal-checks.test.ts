import { describe, it, expect, beforeEach } from "vitest";
import {
  e1TermsConditionsCheck,
  e2RefundShippingPolicyCheck,
  e4ContactChannelCheck,
  e5PlaceholderTextCheck,
} from "../index";
import { DetectionEngine } from "../framework/detection-engine";
import { createMockSnapshot, createMockContext } from "./test-helpers";

describe("Wave 1 Legal Checks (E1, E2, E4, E5)", () => {
  let engine: DetectionEngine;

  beforeEach(() => {
    engine = new DetectionEngine();
    engine.register(e1TermsConditionsCheck);
    engine.register(e2RefundShippingPolicyCheck);
    engine.register(e4ContactChannelCheck);
    engine.register(e5PlaceholderTextCheck);
  });

  describe("E1: Terms and Conditions exist", () => {
    it("passes when terms page is discovered", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/terms",
            finalUrl: "https://example.com/terms",
            httpStatus: 200,
            pageType: "terms",
            title: "Terms and Conditions",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("E1", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("TERMS_AND_CONDITIONS_FOUND");
    });

    it("flags issue when Terms of Service cannot be located", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/about",
            finalUrl: "https://example.com/about",
            httpStatus: 200,
            pageType: "about",
            title: "About",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("E1", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.reasonCode).toBe("TERMS_AND_CONDITIONS_MISSING");
      expect(res.remediationTemplateId).toBe("create_terms_conditions");
    });
  });

  describe("E2: Refund/cancellation/shipping policy", () => {
    it("is not applicable for non-commercial sites without payment/pricing forms", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/blog",
            finalUrl: "https://example.com/blog",
            httpStatus: 200,
            pageType: "general",
            title: "Blog",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("E2", snapshot, ctx);
      expect(res.status).toBe("not_applicable");
      expect(res.reasonCode).toBe("NOT_APPLICABLE");
    });

    it("flags high severity issue when store/checkout page exists without refund policy", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/checkout",
            finalUrl: "https://example.com/checkout",
            httpStatus: 200,
            pageType: "checkout",
            title: "Checkout",
            hasLoginForm: false,
            hasPaymentForm: true,
            hasContactForm: false,
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("E2", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("high");
      expect(res.reasonCode).toBe("REFUND_CANCELLATION_POLICY_MISSING");
    });

    it("passes when refund policy is present on commercial website", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/pricing",
            finalUrl: "https://example.com/pricing",
            httpStatus: 200,
            pageType: "pricing",
            title: "Pricing Plans",
            hasLoginForm: false,
            hasPaymentForm: true,
            hasContactForm: false,
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
          {
            url: "https://example.com/refund-policy",
            finalUrl: "https://example.com/refund-policy",
            httpStatus: 200,
            pageType: "refund",
            title: "Refund and Cancellation Policy",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("E2", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("REFUND_POLICY_DISCOVERED");
    });
  });

  describe("E4: Working contact channel", () => {
    it("passes when contact page or mailto link is discovered", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/contact",
            finalUrl: "https://example.com/contact",
            httpStatus: 200,
            pageType: "contact",
            title: "Contact Us",
            hasContactForm: true,
            hasLoginForm: false,
            hasPaymentForm: false,
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("E4", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("CONTACT_CHANNEL_FOUND");
    });
  });

  describe("E5: Placeholder/template text", () => {
    it("flags issue when 'Lorem ipsum' or '[Insert Company Name]' is present", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/terms",
            finalUrl: "https://example.com/terms",
            httpStatus: 200,
            pageType: "terms",
            title: "Terms",
            metaDescription: "Welcome to [Company Name]. Lorem ipsum dolor sit amet.",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("E5", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.reasonCode).toBe("PLACEHOLDER_TEXT_IN_LEGAL_DOCUMENTS");
    });

    it("passes when legal documents are finalized without placeholder tokens", async () => {
      const snapshot = createMockSnapshot();
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("E5", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("NO_PLACEHOLDER_TEXT_DETECTED");
    });
  });
});

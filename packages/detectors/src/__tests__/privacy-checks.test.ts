import { describe, it, expect, beforeEach } from "vitest";
import {
  a1PrivacyPolicyCheck,
  a5PolicyRealityCheck,
  a6FormConsentCheck,
  a10OptOutLinkCheck,
} from "../index";
import { DetectionEngine } from "../framework/detection-engine";
import { createMockSnapshot, createMockContext, createMockConsentRun } from "./test-helpers";

describe("Wave 1 Privacy Checks (A1, A5, A6, A10)", () => {
  let engine: DetectionEngine;

  beforeEach(() => {
    engine = new DetectionEngine();
    engine.register(a1PrivacyPolicyCheck);
    engine.register(a5PolicyRealityCheck);
    engine.register(a6FormConsentCheck);
    engine.register(a10OptOutLinkCheck);
  });

  describe("A1: Privacy policy exists and is linked", () => {
    it("passes when dedicated privacy policy page is discovered", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/privacy",
            finalUrl: "https://example.com/privacy",
            httpStatus: 200,
            pageType: "privacy",
            title: "Privacy Policy",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 300,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("A1", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("PRIVACY_POLICY_FOUND");
    });

    it("detects issue when privacy policy is missing across pages", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/about",
            finalUrl: "https://example.com/about",
            httpStatus: 200,
            pageType: "about",
            title: "About Us",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 250,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("A1", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("high");
      expect(res.evidenceIds.length).toBeGreaterThan(0);
      expect(res.remediationTemplateId).toBe("create_privacy_policy");
    });

    it("returns unable_to_verify when required dom_element evidence is missing", async () => {
      const snapshot = createMockSnapshot({ pages: [] });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("A1", snapshot, ctx);
      expect(res.status).toBe("unable_to_verify");
    });
  });

  describe("A5: Policy matches reality", () => {
    it("passes when no third-party trackers are fired", async () => {
      const snapshot = createMockSnapshot();
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("A5", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("NO_TRACKERS_TO_DISCLOSE");
    });

    it("passes when observed trackers are disclosed in privacy policy text", async () => {
      const snapshot = createMockSnapshot({
        consentRuns: {
          noChoice: createMockConsentRun({
            bannerDetected: true,
            trackersFired: ["https://www.google-analytics.com/analytics.js"],
            thirdPartyDomainsContacted: ["google-analytics.com"],
          }),
        },
        pages: [
          {
            url: "https://example.com/privacy",
            finalUrl: "https://example.com/privacy",
            httpStatus: 200,
            pageType: "privacy",
            title: "Privacy Policy",
            domFacts: { body: "We use third-party analytics and cookies to track site performance." },
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 300,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("A5", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("POLICY_TRACKER_DISCLOSURE_CONSISTENT");
    });

    it("flags issue when trackers fire but privacy policy omits tracker disclosures", async () => {
      const snapshot = createMockSnapshot({
        consentRuns: {
          noChoice: createMockConsentRun({
            bannerDetected: true,
            trackersFired: ["https://connect.facebook.net/en_US/fbevents.js"],
            thirdPartyDomainsContacted: ["connect.facebook.net"],
          }),
        },
        pages: [
          {
            url: "https://example.com/privacy",
            finalUrl: "https://example.com/privacy",
            httpStatus: 200,
            pageType: "privacy",
            title: "Privacy Policy",
            domFacts: { body: "This is a simple policy document for general information only." },
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 300,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("A5", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.evidenceIds.length).toBeGreaterThan(0);
    });

    it("returns unable_to_verify if trackers fire but privacy policy page was not discovered", async () => {
      const snapshot = createMockSnapshot({
        consentRuns: {
          noChoice: createMockConsentRun({
            bannerDetected: false,
            trackersFired: ["https://clarity.ms/s/0.7.0/clarity.js"],
            thirdPartyDomainsContacted: ["clarity.ms"],
          }),
        },
        pages: [
          {
            url: "https://example.com/",
            finalUrl: "https://example.com/",
            httpStatus: 200,
            pageType: "home",
            title: "Home",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 300,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("A5", snapshot, ctx);
      expect(res.status).toBe("unable_to_verify");
      expect(res.reasonCode).toBe("PRIVACY_POLICY_NOT_FOUND");
    });
  });

  describe("A6: Consent at data-collecting forms", () => {
    it("passes when data collection form includes consent checkbox", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/contact",
            finalUrl: "https://example.com/contact",
            httpStatus: 200,
            pageType: "contact",
            title: "Contact",
            hasContactForm: true,
            hasLoginForm: false,
            hasPaymentForm: false,
            domFacts: {
              formsData: [
                {
                  id: "contact-form",
                  hasEmailField: true,
                  hasConsentCheckbox: true,
                },
              ],
            },
            loadDurationMs: 300,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("A6", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("FORM_CONSENT_PRESENT");
    });

    it("flags issue when form captures email without consent notice or checkbox", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/newsletter",
            finalUrl: "https://example.com/newsletter",
            httpStatus: 200,
            pageType: "general",
            title: "Newsletter Signup",
            hasContactForm: true,
            hasLoginForm: false,
            hasPaymentForm: false,
            domFacts: {
              formsData: [
                {
                  id: "newsletter-form",
                  hasEmailField: true,
                  hasConsentCheckbox: false,
                },
              ],
            },
            loadDurationMs: 300,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("A6", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.remediationTemplateId).toBe("add_form_consent_checkbox");
    });
  });

  describe("A10: Do Not Sell/Share link", () => {
    it("passes when opt-out link is present", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/",
            finalUrl: "https://example.com/",
            httpStatus: 200,
            pageType: "home",
            title: "Home",
            metaDescription: "Check our Your Privacy Choices link in footer.",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 300,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("A10", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("OPT_OUT_LINK_FOUND");
    });

    it("flags issue when marketing trackers are present without an opt-out link", async () => {
      const snapshot = createMockSnapshot({
        cookies: [
          {
            name: "_fbp",
            domain: ".example.com",
            path: "/",
            httpOnly: false,
            secure: true,
            isThirdParty: true,
            observedScenario: "pre_consent",
            redactedValueHash: "abc",
          },
        ],
        pages: [
          {
            url: "https://example.com/",
            finalUrl: "https://example.com/",
            httpStatus: 200,
            pageType: "home",
            title: "Home",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 300,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("A10", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.remediationTemplateId).toBe("add_do_not_sell_link");
    });
  });
});

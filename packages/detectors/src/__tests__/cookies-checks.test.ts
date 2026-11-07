import { describe, it, expect, beforeEach } from "vitest";
import {
  b1CookieBannerCheck,
  b2PreconsentTrackersCheck,
  b3RejectProminenceCheck,
  b4RejectBlocksTrackersCheck,
  b5CookiePolicyCoverageCheck,
  b6InvasiveTrackingCheck,
  b7IpLeakResourcesCheck,
} from "../index";
import { DetectionEngine } from "../framework/detection-engine";
import { createMockSnapshot, createMockContext, createMockConsentRun } from "./test-helpers";

describe("Wave 1 Cookie & Consent Checks (B1, B2, B3, B4, B5, B6, B7)", () => {
  let engine: DetectionEngine;

  beforeEach(() => {
    engine = new DetectionEngine();
    engine.register(b1CookieBannerCheck);
    engine.register(b2PreconsentTrackersCheck);
    engine.register(b3RejectProminenceCheck);
    engine.register(b4RejectBlocksTrackersCheck);
    engine.register(b5CookiePolicyCoverageCheck);
    engine.register(b6InvasiveTrackingCheck);
    engine.register(b7IpLeakResourcesCheck);
  });

  describe("B1: Cookie banner present", () => {
    it("passes when banner is detected", async () => {
      const snapshot = createMockSnapshot({
        consentRuns: {
          noChoice: createMockConsentRun({
            bannerDetected: true,
          }),
        },
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("B1", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("COOKIE_BANNER_DETECTED");
    });

    it("flags issue when third party cookies exist but no banner is found", async () => {
      const snapshot = createMockSnapshot({
        cookies: [
          {
            name: "_ga",
            domain: ".example.com",
            path: "/",
            httpOnly: false,
            secure: true,
            isThirdParty: true,
            observedScenario: "pre_consent",
            redactedValueHash: "123",
          },
        ],
        consentRuns: {
          noChoice: createMockConsentRun({
            bannerDetected: false,
          }),
        },
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("B1", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("high");
    });
  });

  describe("B3: Reject as easy as Accept", () => {
    it("passes when both Accept and Reject buttons are available on banner", async () => {
      const snapshot = createMockSnapshot({
        consentRuns: {
          noChoice: createMockConsentRun({
            bannerDetected: true,
            availableButtons: [
              { text: "Accept All", type: "accept" },
              { text: "Reject All", type: "reject" },
            ],
          }),
        },
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("B3", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("REJECT_EQUALLY_PROMINENT");
    });

    it("flags issue when Accept button is present but Reject button is missing on first layer", async () => {
      const snapshot = createMockSnapshot({
        consentRuns: {
          noChoice: createMockConsentRun({
            bannerDetected: true,
            availableButtons: [
              { text: "Accept All Cookies", type: "accept" },
              { text: "Manage Preferences", type: "preferences" },
            ],
          }),
        },
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("B3", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.remediationTemplateId).toBe("provide_equal_reject_button");
    });
  });

  describe("B5: Cookie policy lists cookies", () => {
    it("passes when cookies are disclosed on cookie policy page", async () => {
      const snapshot = createMockSnapshot({
        cookies: [
          {
            name: "session_id",
            domain: "example.com",
            path: "/",
            httpOnly: true,
            secure: true,
            isThirdParty: false,
            observedScenario: "pre_consent",
            redactedValueHash: "abc",
          },
        ],
        pages: [
          {
            url: "https://example.com/cookie-policy",
            finalUrl: "https://example.com/cookie-policy",
            httpStatus: 200,
            pageType: "cookies",
            title: "Cookie Policy",
            domFacts: { content: "This table lists essential session cookies and purpose." },
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("B5", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("COOKIE_POLICY_COVERAGE_SATISFACTORY");
    });

    it("flags issue when cookies are set but no policy page exists", async () => {
      const snapshot = createMockSnapshot({
        cookies: [
          {
            name: "analytics_id",
            domain: "example.com",
            path: "/",
            httpOnly: false,
            secure: true,
            isThirdParty: false,
            observedScenario: "pre_consent",
            redactedValueHash: "xyz",
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
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("B5", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
    });
  });

  describe("B6: Session replay / invasive tracking", () => {
    it("flags high severity issue when Microsoft Clarity or Hotjar is detected", async () => {
      const snapshot = createMockSnapshot({
        networkRequests: [
          {
            id: "123e4567-e89b-12d3-a456-426614174000",
            url: "https://www.clarity.ms/tag/abc123",
            method: "GET",
            resourceType: "script",
            isThirdParty: true,
            requestHeaders: [],
            timestamp: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("B6", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("high");
      expect(res.reasonCode).toBe("SESSION_REPLAY_TOOL_DETECTED");
      expect(res.remediationTemplateId).toBe("disclose_or_remove_session_replay");
    });

    it("passes when no session replay tools are loaded", async () => {
      const snapshot = createMockSnapshot();
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("B6", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("NO_INVASIVE_SESSION_REPLAY_DETECTED");
    });
  });

  describe("B7: Third-party resources leaking IPs", () => {
    it("flags issue when Google Fonts are loaded externally without prior consent", async () => {
      const snapshot = createMockSnapshot({
        networkRequests: [
          {
            id: "123e4567-e89b-12d3-a456-426614174001",
            url: "https://fonts.googleapis.com/css2?family=Roboto",
            method: "GET",
            resourceType: "stylesheet",
            isThirdParty: true,
            requestHeaders: [],
            timestamp: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("B7", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("low");
      expect(res.reasonCode).toBe("UNCONSENTED_IP_TRANSMISSION_EXTERNAL_HOSTS");
    });

    it("passes when all fonts and assets are self-hosted", async () => {
      const snapshot = createMockSnapshot();
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("B7", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("STATIC_ASSETS_SELF_HOSTED");
    });
  });
});

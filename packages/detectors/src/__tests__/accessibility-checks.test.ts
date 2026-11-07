import { describe, it, expect, beforeEach } from "vitest";
import {
  c1ImageAltCheck,
  c2ColorContrastCheck,
  c4FormLabelsCheck,
  c5HeadingLandmarksCheck,
  c6PageLanguageCheck,
  c7AccessibleNamesCheck,
  c9MediaCaptionsCheck,
  c10TouchTargetsCheck,
} from "../index";
import { DetectionEngine } from "../framework/detection-engine";
import { createMockSnapshot, createMockContext } from "./test-helpers";

describe("Wave 1 Accessibility Checks (C1, C2, C4, C5, C6, C7, C9, C10)", () => {
  let engine: DetectionEngine;

  beforeEach(() => {
    engine = new DetectionEngine();
    engine.register(c1ImageAltCheck);
    engine.register(c2ColorContrastCheck);
    engine.register(c4FormLabelsCheck);
    engine.register(c5HeadingLandmarksCheck);
    engine.register(c6PageLanguageCheck);
    engine.register(c7AccessibleNamesCheck);
    engine.register(c9MediaCaptionsCheck);
    engine.register(c10TouchTargetsCheck);
  });

  describe("C1: Image alt text", () => {
    it("flags issue when axe image-alt violation is present", async () => {
      const snapshot = createMockSnapshot({
        accessibilityViolations: [
          {
            id: "image-alt",
            description: "Images must have alternate text",
            nodesCount: 3,
            selectorSample: "img.banner",
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("C1", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.evidenceIds.length).toBeGreaterThan(0);
    });

    it("passes when all images provide alt attributes", async () => {
      const snapshot = createMockSnapshot();
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("C1", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("IMAGE_ALT_SATISFIED");
    });
  });

  describe("C2: Colour contrast", () => {
    it("flags issue when contrast violation is reported by axe", async () => {
      const snapshot = createMockSnapshot({
        accessibilityViolations: [
          {
            id: "color-contrast",
            impact: "serious",
            description: "Elements must have sufficient color contrast",
            nodesCount: 4,
            selectorSample: "p.muted-text",
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("C2", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.reasonCode).toBe("COLOR_CONTRAST_DEFICIENT");
    });

    it("passes when color contrast conforms to WCAG AA", async () => {
      const snapshot = createMockSnapshot();
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("C2", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("COLOR_CONTRAST_COMPLIANT");
    });
  });

  describe("C4: Form labels", () => {
    it("flags issue when inputs lack accessible labels", async () => {
      const snapshot = createMockSnapshot({
        accessibilityViolations: [
          {
            id: "label",
            description: "Form elements must have labels",
            nodesCount: 2,
            selectorSample: "input#search",
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("C4", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.reasonCode).toBe("FORM_LABELS_MISSING");
    });
  });

  describe("C5: Heading and landmark structure", () => {
    it("flags issue when heading order is broken", async () => {
      const snapshot = createMockSnapshot({
        accessibilityViolations: [
          {
            id: "heading-order",
            description: "Heading levels should only increase by one",
            nodesCount: 1,
            selectorSample: "h4",
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("C5", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("low");
    });
  });

  describe("C6: Page language, title, zoom", () => {
    it("flags issue when html lang is missing or zoom is disabled", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/",
            finalUrl: "https://example.com/",
            httpStatus: 200,
            pageType: "home",
            title: "",
            language: "",
            viewport: "width=device-width, user-scalable=no",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("C6", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
      expect(res.reasonCode).toBe("LANGUAGE_TITLE_OR_ZOOM_DEFECT");
    });

    it("passes when lang, title, and resizable viewport are configured", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/",
            finalUrl: "https://example.com/",
            httpStatus: 200,
            pageType: "home",
            title: "Accessible Website Title",
            language: "en",
            viewport: "width=device-width, initial-scale=1",
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            loadDurationMs: 200,
            capturedAt: new Date().toISOString(),
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("C6", snapshot, ctx);
      expect(res.status).toBe("passed");
      expect(res.reasonCode).toBe("LANGUAGE_TITLE_AND_ZOOM_COMPLIANT");
    });
  });

  describe("C7: Buttons and links have names", () => {
    it("flags issue when buttons have empty text or aria-labels", async () => {
      const snapshot = createMockSnapshot({
        accessibilityViolations: [
          {
            id: "button-name",
            description: "Buttons must have discernible text",
            nodesCount: 2,
            selectorSample: "button.icon-only",
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("C7", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
    });
  });

  describe("C9: Media captions and autoplay", () => {
    it("flags issue when autoplay video is unmuted or missing captions", async () => {
      const snapshot = createMockSnapshot({
        pages: [
          {
            url: "https://example.com/",
            finalUrl: "https://example.com/",
            httpStatus: 200,
            pageType: "home",
            title: "Home",
            domFacts: {
              media: [
                { tag: "video", autoplay: true, muted: false, hasCaptions: false },
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
      const { output: res } = await engine.executeCheck("C9", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
    });
  });

  describe("C10: Touch target size and responsive", () => {
    it("flags issue when target-size violation exists", async () => {
      const snapshot = createMockSnapshot({
        accessibilityViolations: [
          {
            id: "target-size",
            description: "Touch targets must be at least 24px by 24px",
            nodesCount: 5,
            selectorSample: "a.footer-link",
          },
        ],
      });
      const ctx = createMockContext(snapshot.scanId);
      const { output: res } = await engine.executeCheck("C10", snapshot, ctx);
      expect(res.status).toBe("issue_found");
      expect(res.severity).toBe("medium");
    });
  });
});

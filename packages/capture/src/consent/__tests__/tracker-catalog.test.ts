import { describe, it, expect } from "vitest";
import {
  isTrackerUrl,
  identifyTrackerName,
  KNOWN_TRACKERS,
} from "../tracker-catalog";

describe("Tracker Catalog", () => {
  it("contains rules covering major ad networks, analytics, and session replay", () => {
    expect(KNOWN_TRACKERS.length).toBeGreaterThanOrEqual(15);
  });

  describe("isTrackerUrl", () => {
    it("identifies Google Analytics and Google Tag Manager URLs", () => {
      expect(isTrackerUrl("https://www.google-analytics.com/analytics.js")).toBe(true);
      expect(isTrackerUrl("https://www.googletagmanager.com/gtag/js?id=G-12345")).toBe(true);
      expect(isTrackerUrl("https://analytics.google.com/g/collect")).toBe(true);
    });

    it("identifies Meta / Facebook Pixel URLs", () => {
      expect(isTrackerUrl("https://connect.facebook.net/en_US/fbevents.js")).toBe(true);
      expect(isTrackerUrl("https://www.facebook.com/tr?id=12345&ev=PageView")).toBe(true);
    });

    it("identifies Microsoft Clarity and Hotjar session replay URLs", () => {
      expect(isTrackerUrl("https://www.clarity.ms/tag/abc1234")).toBe(true);
      expect(isTrackerUrl("https://static.hotjar.com/c/hotjar-123.js")).toBe(true);
    });

    it("identifies Criteo, TikTok, and LinkedIn ad trackers", () => {
      expect(isTrackerUrl("https://static.criteo.net/js/ld/ld.js")).toBe(true);
      expect(isTrackerUrl("https://analytics.tiktok.com/i18n/pixel/events.js")).toBe(true);
      expect(isTrackerUrl("https://snap.licdn.com/li.lms-analytics/insight.min.js")).toBe(true);
    });

    it("returns false for first-party, non-tracker URLs", () => {
      expect(isTrackerUrl("https://example.com/assets/app.js")).toBe(false);
      expect(isTrackerUrl("https://cdn.example.com/styles.css")).toBe(false);
      expect(isTrackerUrl("https://api.github.com/users")).toBe(false);
    });

    it("handles invalid URLs gracefully", () => {
      expect(isTrackerUrl("not-a-url")).toBe(false);
    });
  });

  describe("identifyTrackerName", () => {
    it("returns descriptive names for recognized tracker domains", () => {
      expect(identifyTrackerName("https://www.google-analytics.com/g/collect")).toBe(
        "Google Analytics / Tag Manager"
      );
      expect(identifyTrackerName("https://connect.facebook.net/fbevents.js")).toBe(
        "Meta / Facebook Pixel"
      );
      expect(identifyTrackerName("https://www.clarity.ms/collect")).toBe(
        "Microsoft Clarity"
      );
    });

    it("returns null for unknown URLs", () => {
      expect(identifyTrackerName("https://example.com/api/user")).toBeNull();
    });
  });
});

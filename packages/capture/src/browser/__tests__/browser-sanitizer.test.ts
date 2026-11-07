import { describe, it, expect } from "vitest";
import {
  sanitizeUrl,
  sanitizeHeaders,
  hashSensitiveValue,
  isThirdPartyUrl,
} from "../browser-sanitizer";

describe("Browser Sanitizer", () => {
  describe("sanitizeUrl", () => {
    it("redacts sensitive query parameters like token, auth, session, and email", () => {
      const url =
        "https://example.com/checkout?token=secret123&session=sess_999&email=user%40example.com&ref=homepage";
      const sanitized = sanitizeUrl(url);

      expect(sanitized).toContain("token=%5BREDACTED%5D");
      expect(sanitized).toContain("session=%5BREDACTED%5D");
      expect(sanitized).toContain("email=%5BREDACTED%5D");
      expect(sanitized).toContain("ref=homepage");
      expect(sanitized.includes("secret123")).toBe(false);
      expect(sanitized.includes("sess_999")).toBe(false);
      expect(sanitized.includes("user%40example.com")).toBe(false);
    });

    it("leaves safe URLs untouched", () => {
      const safe = "https://example.com/blog/article-1?page=2&sort=desc";
      expect(sanitizeUrl(safe)).toBe(safe);
    });

    it("handles malformed URLs gracefully", () => {
      expect(sanitizeUrl("not-a-valid-url")).toBe("not-a-valid-url");
    });
  });

  describe("sanitizeHeaders", () => {
    it("redacts Authorization and Cookie headers while preserving safe headers", () => {
      const headers = [
        { name: "Content-Type", value: "text/html; charset=utf-8" },
        { name: "Authorization", value: "Bearer eyJhbGciOi..." },
        { name: "Cookie", value: "session_id=12345; auth=yes" },
        { name: "Set-Cookie", value: "user=secret; Secure; HttpOnly" },
        { name: "X-Custom-Header", value: "harmless-value" },
      ];

      const sanitized = sanitizeHeaders(headers);

      expect(sanitized.find((h) => h.name === "Content-Type")?.value).toBe(
        "text/html; charset=utf-8"
      );
      expect(sanitized.find((h) => h.name === "Authorization")?.value).toContain(
        "[REDACTED_LEN_"
      );
      expect(sanitized.find((h) => h.name === "Cookie")?.value).toContain(
        "[REDACTED_LEN_"
      );
      expect(sanitized.find((h) => h.name === "Set-Cookie")?.value).toContain(
        "[REDACTED_LEN_"
      );
      expect(sanitized.find((h) => h.name === "X-Custom-Header")?.value).toBe(
        "harmless-value"
      );
    });
  });

  describe("hashSensitiveValue", () => {
    it("computes deterministic SHA-256 hashes without revealing plain text", () => {
      const secret = "session_token_xyz_12345";
      const hash1 = hashSensitiveValue(secret);
      const hash2 = hashSensitiveValue(secret);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex string length
      expect(hash1.includes("session_token")).toBe(false);
    });

    it("returns empty string for empty input", () => {
      expect(hashSensitiveValue("")).toBe("");
    });
  });

  describe("isThirdPartyUrl", () => {
    it("identifies same-origin and subdomain links as first-party", () => {
      const origin = "https://example.com";
      expect(isThirdPartyUrl("https://example.com/about", origin)).toBe(false);
      expect(isThirdPartyUrl("https://cdn.example.com/app.js", origin)).toBe(false);
      expect(isThirdPartyUrl("https://api.sub.example.com/v1", origin)).toBe(false);
    });

    it("identifies different apex domains as third-party", () => {
      const origin = "https://example.com";
      expect(isThirdPartyUrl("https://google-analytics.com/analytics.js", origin)).toBe(true);
      expect(isThirdPartyUrl("https://stripe.com/v3", origin)).toBe(true);
      expect(isThirdPartyUrl("https://evil-tracking.net/track", origin)).toBe(true);
    });
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { ScanStore } from "../lib/scan-store";

describe("Stage 14: ScanStore & Business Invariants", () => {
  const testScanId = "11111111-2222-3333-4444-555555555555";

  beforeEach(async () => {
    // Reset/seed scan
    await ScanStore.createScan({
      id: testScanId,
      targetUrl: "https://example.com",
      targetHost: "example.com",
      jurisdictions: ["india", "eu"],
      scannerVersion: "1.0.0",
      rulesetVersion: "1.0.0",
    });
  });

  describe("1. Scan Lifecycle & Event Stream", () => {
    it("creates an initialized scan with pending status and initial event", async () => {
      const scan = await ScanStore.getScan(testScanId);
      expect(scan).toBeDefined();
      expect(scan?.status).toBe("pending");
      expect(scan?.currentStage).toBe("initializing");
      expect(scan?.events.length).toBe(1);
      expect(scan?.events[0].message).toContain("https://example.com");
    });

    it("records genuine scan events in chronological order", async () => {
      await ScanStore.addEvent(testScanId, "url_validation", "Validating target URL safety");
      await ScanStore.addEvent(testScanId, "crawling", "Crawling discovery pages");
      await ScanStore.addEvent(testScanId, "detectors_running", "Running 41 Wave 1 checks");

      const scan = await ScanStore.getScan(testScanId);
      expect(scan?.events.length).toBe(4);
      expect(scan?.events[1].stage).toBe("url_validation");
      expect(scan?.events[2].stage).toBe("crawling");
      expect(scan?.events[3].stage).toBe("detectors_running");
      expect(scan?.currentStage).toBe("detectors_running");
    });
  });

  describe("2. Cryptographic Paid Report Token Handling", () => {
    it("generates a 256-bit high-entropy token, marks scan as paid, and stores ONLY SHA-256 hash", async () => {
      const unlockResult = await ScanStore.unlockPaidScan(testScanId, "founder@acme.com");
      expect(unlockResult).toBeDefined();
      expect(unlockResult?.token).toBeDefined();

      const rawToken = unlockResult!.token;
      // 32 bytes in hex = 64 characters
      expect(rawToken.length).toBe(64);
      expect(unlockResult?.reportUrl).toBe(`/report/${testScanId}?token=${rawToken}`);

      const scan = await ScanStore.getScan(testScanId);
      expect(scan?.isPaid).toBe(true);
      expect(scan?.paidByEmail).toBe("founder@acme.com");

      // CRITICAL INVARIANT: Raw token is NEVER stored in plaintext in the store
      expect(scan?.reportTokenHash).toBeDefined();
      expect(scan?.reportTokenHash).not.toBe(rawToken);
      expect(scan?.reportTokenHash?.length).toBe(64); // SHA-256 is 64 hex characters
    });

    it("verifies the authentic token and rejects forged/altered tokens", async () => {
      const unlockResult = await ScanStore.unlockPaidScan(testScanId, "agency@studio.design");
      const authenticToken = unlockResult!.token;

      // Authentic token passes verification
      const isValid = await ScanStore.verifyToken(testScanId, authenticToken);
      expect(isValid).toBe(true);

      // Forged token fails
      const forgedToken = "a".repeat(64);
      const isForgedValid = await ScanStore.verifyToken(testScanId, forgedToken);
      expect(isForgedValid).toBe(false);

      // Truncated or empty token fails
      expect(await ScanStore.verifyToken(testScanId, "")).toBe(false);
      expect(await ScanStore.verifyToken(testScanId, authenticToken.slice(0, 32))).toBe(false);
    });

    it("rejects token verification for non-existent scans", async () => {
      const isValid = await ScanStore.verifyToken("non-existent-scan-uuid", "some-token");
      expect(isValid).toBe(false);
    });
  });

  describe("3. Free vs Paid Scan Invariants", () => {
    it("distinguishes free preview from paid structured report storage", async () => {
      await ScanStore.updateScan(testScanId, {
        status: "completed",
        score: 92,
        freePreview: {
          scanId: testScanId,
          targetUrl: "https://example.com",
          score: 92,
          status: "completed",
          scannerVersion: "1.0.0",
          statusCounts: { passed: 38, issue_found: 2, not_applicable: 1, unable_to_verify: 0 },
          severityCounts: { critical: 0, high: 0, medium: 1, low: 1 },
          topFindings: [],
          exposureRange: {
            hasExposure: false,
            minDirectCostInr: 0,
            maxDirectCostInr: 0,
            statutoryMaxInr: 0,
            applicableRegimes: [],
          },
          isPaid: false,
          scannedAt: new Date().toISOString(),
        },
      });

      const scan = await ScanStore.getScan(testScanId);
      expect(scan?.freePreview).toBeDefined();
      expect(scan?.freePreview?.score).toBe(92);
      expect(scan?.freePreview?.isPaid).toBe(false);
    });
  });
});

import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { SiteSnapshot } from "@vibe/contracts";
import {
  DetectionEngine,
  EvidenceCollector,
  WAVE_1_CHECKS,
  d5HttpsTlsCheck,
  type CheckDefinition,
} from "../index";

function createBaseSnapshot(overrides: Partial<SiteSnapshot> = {}): SiteSnapshot {
  return {
    schemaVersion: "1.0.0",
    scanId: randomUUID(),
    canonicalOrigin: "https://example.com",
    targetHost: "example.com",
    capturedAt: new Date().toISOString(),
    scannerVersion: "1.0.0",
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
    cookies: [],
    networkRequests: [
      {
        id: randomUUID(),
        url: "https://example.com/",
        method: "GET",
        resourceType: "document",
        isThirdParty: false,
        requestHeaders: [{ name: "Accept", value: "text/html" }],
        timestamp: new Date().toISOString(),
      },
    ],
    responseHeaders: [
      { name: "Content-Type", value: "text/html" },
      { name: "Strict-Transport-Security", value: "max-age=31536000" },
      { name: "X-Content-Type-Options", value: "nosniff" },
      { name: "X-Frame-Options", value: "DENY" },
    ],
    dns: {
      resolvedIps: ["93.184.216.34"],
      records: [{ type: "A", value: "93.184.216.34" }],
      hasDkimSignal: false,
      isCloudflareOrCdn: false,
      checkedAt: new Date().toISOString(),
    },
    tls: {
      valid: true,
      enforcesHttps: true,
      hasMixedContentWarnings: false,
      protocol: "TLSv1.3",
      daysRemaining: 180,
    },
    assets: [],
    consentRuns: {
      noChoice: {
        scenario: "no_choice",
        status: "completed",
        bannerDetected: true,
        availableButtons: [],
        cookiesBefore: [],
        cookiesAfter: [],
        cookiesSet: [],
        storageItems: [],
        networkRequests: [],
        trackersFired: [],
        thirdPartyDomainsContacted: [],
        warnings: [],
        executionDurationMs: 500,
      },
      reject: {
        scenario: "reject",
        status: "completed",
        bannerDetected: true,
        availableButtons: [],
        cookiesBefore: [],
        cookiesAfter: [],
        cookiesSet: [],
        storageItems: [],
        networkRequests: [],
        trackersFired: [],
        thirdPartyDomainsContacted: [],
        warnings: [],
        executionDurationMs: 500,
      },
    },
    accessibilityViolations: [],
    collectionWarnings: [],
    incompleteStages: [],
    ...overrides,
  };
}

describe("Detection Engine Framework", () => {
  describe("1. Engine Isolation & Error Containment", () => {
    it("safely handles a buggy detector throwing an unhandled exception without crashing", async () => {
      const engine = new DetectionEngine();
      const faultyCheck: CheckDefinition = {
        id: "FAULT_1",
        version: "1.0.0",
        title: "Faulty Detector",
        description: "Throws an unexpected error",
        module: "security",
        wave: "W1",
        requiredEvidence: ["header"],
        run: () => {
          throw new Error("Simulated catastrophic crash inside detector");
        },
      };

      engine.register(faultyCheck);
      const snapshot = createBaseSnapshot();
      const context = {
        scanId: snapshot.scanId,
        evidenceCollector: new EvidenceCollector(snapshot.scanId),
      };

      const result = await engine.executeCheck("FAULT_1", snapshot, context);

      expect(result.checkId).toBe("FAULT_1");
      expect(result.output.status).toBe("unable_to_verify");
      expect(result.output.reasonCode).toBe("DETECTOR_EXECUTION_ERROR");
      expect(result.output.summary).toContain("Simulated catastrophic crash");
      expect(result.output.requiresHumanReview).toBe(true);
      expect(result.executionDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("catches Zod contract violations (e.g. issue_found with empty evidenceIds)", async () => {
      const engine = new DetectionEngine();
      const nonCompliantCheck: CheckDefinition = {
        id: "INVALID_1",
        version: "1.0.0",
        title: "Non compliant detector",
        description: "Returns issue_found without evidence",
        module: "privacy",
        wave: "W1",
        requiredEvidence: ["header"],
        run: () => ({
          checkId: "INVALID_1",
          checkVersion: "1.0.0",
          status: "issue_found",
          severity: "high",
          confidence: 1.0,
          reasonCode: "ILLEGAL_OUTPUT",
          summary: "Attempting to claim issue without evidence",
          evidenceIds: [], // VIOLATION: issue_found must have evidence!
          requiresHumanReview: false,
        }),
      };

      engine.register(nonCompliantCheck);
      const snapshot = createBaseSnapshot();
      const context = {
        scanId: snapshot.scanId,
        evidenceCollector: new EvidenceCollector(snapshot.scanId),
      };

      const result = await engine.executeCheck("INVALID_1", snapshot, context);

      expect(result.output.status).toBe("unable_to_verify");
      expect(result.output.reasonCode).toBe("DETECTOR_CONTRACT_VIOLATION");
    });
  });

  describe("2. Evidence Requirement & Missing Evidence Invariant", () => {
    it("returns 'unable_to_verify' when required evidence is missing from snapshot (NEVER pass)", async () => {
      const engine = new DetectionEngine();
      engine.register(d5HttpsTlsCheck);

      // Snapshot with missing TLS evidence
      const snapshotWithoutTls = createBaseSnapshot({
        tls: undefined as any,
      });

      const context = {
        scanId: snapshotWithoutTls.scanId,
        evidenceCollector: new EvidenceCollector(snapshotWithoutTls.scanId),
      };

      const result = await engine.executeCheck("D5", snapshotWithoutTls, context);

      expect(result.output.status).toBe("unable_to_verify");
      expect(result.output.reasonCode).toBe("REQUIRED_EVIDENCE_MISSING");
      expect(result.output.summary).toContain("tls_cert");
    });
  });

  describe("3. Wave 1 Deterministic Checks Verification", () => {
    let engine: DetectionEngine;

    beforeAll(() => {
      engine = new DetectionEngine();
      engine.registerAll(WAVE_1_CHECKS);
    });

    describe("Check A1: Privacy policy exists and is linked", () => {
      it("fails with issue_found when no privacy policy page or link is present", async () => {
        const snapshot = createBaseSnapshot({
          pages: [
            {
              url: "https://example.com/",
              finalUrl: "https://example.com/",
              httpStatus: 200,
              pageType: "home",
              hasLoginForm: false,
              hasPaymentForm: false,
              hasContactForm: false,
              loadDurationMs: 100,
              capturedAt: new Date().toISOString(),
            },
          ],
        });

        const context = {
          scanId: snapshot.scanId,
          evidenceCollector: new EvidenceCollector(snapshot.scanId),
        };

        const result = await engine.executeCheck("A1", snapshot, context);

        expect(result.output.status).toBe("issue_found");
        expect(result.output.severity).toBe("high");
        expect(result.output.reasonCode).toBe("PRIVACY_POLICY_MISSING");
        expect(result.output.evidenceIds.length).toBeGreaterThanOrEqual(1);
      });

      it("passes when privacy policy page is identified", async () => {
        const snapshot = createBaseSnapshot({
          pages: [
            {
              url: "https://example.com/privacy",
              finalUrl: "https://example.com/privacy",
              httpStatus: 200,
              pageType: "privacy",
              hasLoginForm: false,
              hasPaymentForm: false,
              hasContactForm: false,
              loadDurationMs: 100,
              capturedAt: new Date().toISOString(),
            },
          ],
        });

        const context = {
          scanId: snapshot.scanId,
          evidenceCollector: new EvidenceCollector(snapshot.scanId),
        };

        const result = await engine.executeCheck("A1", snapshot, context);

        expect(result.output.status).toBe("passed");
        expect(result.output.reasonCode).toBe("PRIVACY_POLICY_FOUND");
      });
    });

    describe("Check B2: Trackers fire before consent", () => {
      it("flags critical issue when trackers fire in no_choice scenario", async () => {
        const snapshot = createBaseSnapshot({
          consentRuns: {
            noChoice: {
              scenario: "no_choice",
              status: "completed",
              bannerDetected: true,
              availableButtons: [],
              cookiesBefore: [],
              cookiesAfter: [],
              cookiesSet: [],
              storageItems: [],
              networkRequests: [],
              trackersFired: ["https://www.google-analytics.com/analytics.js"],
              thirdPartyDomainsContacted: ["google-analytics.com"],
              warnings: [],
              executionDurationMs: 500,
            },
          },
        });

        const context = {
          scanId: snapshot.scanId,
          evidenceCollector: new EvidenceCollector(snapshot.scanId),
        };

        const result = await engine.executeCheck("B2", snapshot, context);

        expect(result.output.status).toBe("issue_found");
        expect(result.output.severity).toBe("critical");
        expect(result.output.reasonCode).toBe("TRACKERS_FIRED_BEFORE_CONSENT");
        expect(result.output.evidenceIds.length).toBe(1);
      });

      it("passes when zero trackers fire in no_choice scenario", async () => {
        const snapshot = createBaseSnapshot();
        const context = {
          scanId: snapshot.scanId,
          evidenceCollector: new EvidenceCollector(snapshot.scanId),
        };

        const result = await engine.executeCheck("B2", snapshot, context);

        expect(result.output.status).toBe("passed");
      });
    });

    describe("Check B4: Reject really blocks trackers (Phantom Reject)", () => {
      it("flags critical issue when trackers fire after user clicks reject", async () => {
        const snapshot = createBaseSnapshot({
          consentRuns: {
            reject: {
              scenario: "reject",
              status: "completed",
              bannerDetected: true,
              availableButtons: [],
              cookiesBefore: [],
              cookiesAfter: [],
              cookiesSet: [],
              storageItems: [],
              networkRequests: [],
              trackersFired: ["https://connect.facebook.net/en_US/fbevents.js"],
              thirdPartyDomainsContacted: ["facebook.net"],
              bannerActionTaken: "clicked_reject",
              warnings: [],
              executionDurationMs: 500,
            },
          },
        });

        const context = {
          scanId: snapshot.scanId,
          evidenceCollector: new EvidenceCollector(snapshot.scanId),
        };

        const result = await engine.executeCheck("B4", snapshot, context);

        expect(result.output.status).toBe("issue_found");
        expect(result.output.severity).toBe("critical");
        expect(result.output.reasonCode).toBe("PHANTOM_REJECT_DETECTED");
      });
    });

    describe("Check D5: HTTPS / TLS enforcement", () => {
      it("flags critical issue when certificate is invalid", async () => {
        const snapshot = createBaseSnapshot({
          tls: {
            valid: false,
            enforcesHttps: true,
            hasMixedContentWarnings: false,
          },
        });

        const context = {
          scanId: snapshot.scanId,
          evidenceCollector: new EvidenceCollector(snapshot.scanId),
        };

        const result = await engine.executeCheck("D5", snapshot, context);

        expect(result.output.status).toBe("issue_found");
        expect(result.output.severity).toBe("critical");
        expect(result.output.reasonCode).toBe("TLS_CERTIFICATE_INVALID");
      });
    });

    describe("Check D6: Security headers", () => {
      it("flags missing HSTS or X-Content-Type-Options headers", async () => {
        const snapshot = createBaseSnapshot({
          responseHeaders: [{ name: "Content-Type", value: "text/html" }],
        });

        const context = {
          scanId: snapshot.scanId,
          evidenceCollector: new EvidenceCollector(snapshot.scanId),
        };

        const result = await engine.executeCheck("D6", snapshot, context);

        expect(result.output.status).toBe("issue_found");
        expect(result.output.severity).toBe("high");
        expect(result.output.reasonCode).toBe("SECURITY_HEADERS_MISSING");
      });
    });
  });

  describe("4. Suite Execution (executeAll)", () => {
    it("evaluates all registered Wave 1 checks and aggregates status counts and evidence", async () => {
      const engine = new DetectionEngine({
        scannerVersion: "1.0.0",
        rulesetVersion: "1.0.0",
      });
      engine.registerAll(WAVE_1_CHECKS);

      const snapshot = createBaseSnapshot();
      const suiteResult = await engine.executeAll(snapshot, { waveFilter: ["W1"] });

      expect(suiteResult.scanId).toBe(snapshot.scanId);
      expect(suiteResult.totalChecksEvaluated).toBe(WAVE_1_CHECKS.length);
      expect(suiteResult.totalDurationMs).toBeGreaterThanOrEqual(0);

      // Verify status counts sum to total checks
      const sum =
        suiteResult.statusCounts.passed +
        suiteResult.statusCounts.issue_found +
        suiteResult.statusCounts.not_applicable +
        suiteResult.statusCounts.unable_to_verify;

      expect(sum).toBe(WAVE_1_CHECKS.length);

      // Verify collected evidence records
      expect(Array.isArray(suiteResult.collectedEvidence)).toBe(true);
      for (const ev of suiteResult.collectedEvidence) {
        expect(ev.scanId).toBe(snapshot.scanId);
        expect(ev.contentHash).toBeDefined();
      }
    });
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { SiteSnapshot } from "@vibe/contracts";
import { getDb, DbClient } from "../index";
import { scans, evidence, scanEvents } from "../schema";
import { persistSnapshotEvidence } from "../persistence/evidence-persistence";

describe("Evidence Persistence Engine (PostgreSQL Integration)", () => {
  let db: DbClient;
  let testScanId: string;

  beforeAll(async () => {
    // Requires DATABASE_URL from .env or environment
    if (!process.env.DATABASE_URL) {
      const dotenv = await import("dotenv");
      dotenv.config({ path: "../../.env" });
    }
    db = getDb();
    testScanId = randomUUID();

    // Create a scan record for this test run
    await db.insert(scans).values({
      id: testScanId,
      targetUrl: "https://example.com",
      normalizedUrl: "https://example.com/",
      targetHost: "example.com",
      status: "running",
      scannerVersion: "1.0.0",
      ruleLibraryVersion: "1.0.0",
      snapshotSchemaVersion: "1.0.0",
      ipHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    });
  });

  afterAll(async () => {
    // Clean up test scan (cascades to evidence and scanEvents)
    if (db && testScanId) {
      await db.delete(scans).where(eq(scans.id, testScanId)).catch(() => {});
    }
  });

  it("persists and deduplicates evidence records linked to the scan in Neon PostgreSQL", async () => {
    const mockSnapshot: SiteSnapshot = {
      schemaVersion: "1.0.0",
      scanId: testScanId,
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
          title: "Example Domain",
          hasLoginForm: false,
          hasPaymentForm: false,
          hasContactForm: false,
          loadDurationMs: 350,
          capturedAt: new Date().toISOString(),
          screenshotBlobKey: `scans/${testScanId}/screenshots/home.jpeg`,
          domFacts: {
            htmlBlobKey: `scans/${testScanId}/pages/home.html`,
          },
        },
      ],
      cookies: [
        {
          name: "session_id",
          domain: "example.com",
          path: "/",
          httpOnly: true,
          secure: true,
          isThirdParty: false,
          observedScenario: "pre_consent",
          redactedValueHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
      ],
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
        { name: "Content-Type", value: "text/html; charset=UTF-8" },
        // Intentional duplicate header to test deduplication
        { name: "Content-Type", value: "text/html; charset=UTF-8" },
        { name: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
      dns: {
        resolvedIps: ["93.184.216.34"],
        records: [
          { type: "A", value: "93.184.216.34", ttl: 3600 },
          { type: "NS", value: "a.iana-servers.net" },
        ],
        spfRecord: "v=spf1 -all",
        dmarcRecord: "v=DMARC1; p=reject",
        hasDkimSignal: false,
        isCloudflareOrCdn: false,
        checkedAt: new Date().toISOString(),
      },
      tls: {
        valid: true,
        issuer: "DigiCert Inc",
        subject: "www.example.org",
        daysRemaining: 120,
        protocol: "TLSv1.3",
        cipherSuite: "TLS_AES_256_GCM_SHA384",
        enforcesHttps: true,
        hasMixedContentWarnings: false,
      },
      assets: [
        {
          url: "https://example.com/script.js",
          assetType: "script",
          httpStatus: 200,
          isBroken: false,
          hasSri: true,
          sriHash: "sha384-xyz",
          isWatermarkedSignal: false,
        },
      ],
      consentRuns: {},
      accessibilityViolations: [
        {
          id: "color-contrast",
          impact: "serious",
          description: "Elements must have sufficient color contrast",
          nodesCount: 2,
        },
      ],
      collectionWarnings: [],
      incompleteStages: [],
    };

    // 1. Run persistence
    const result = await persistSnapshotEvidence(db, testScanId, mockSnapshot);

    expect(result.scanId).toBe(testScanId);
    expect(result.totalEvidencePersisted).toBeGreaterThan(0);
    // Deduplication should have caught the duplicate Content-Type header
    expect(result.deduplicatedCount).toBeGreaterThanOrEqual(1);

    // 2. Query evidence table directly from Neon
    const persistedEvidence = await db
      .select()
      .from(evidence)
      .where(eq(evidence.scanId, testScanId));

    expect(persistedEvidence.length).toBe(result.totalEvidencePersisted);

    // Verify all records link to testScanId
    for (const record of persistedEvidence) {
      expect(record.scanId).toBe(testScanId);
      expect(record.contentHash).toBeDefined();
      expect(record.contentHash?.length).toBe(64); // SHA-256 hex string
      expect(record.structuredValue).toBeDefined();
    }

    // Verify evidence types are present
    const types = new Set(persistedEvidence.map((r) => r.evidenceType));
    expect(types.has("header")).toBe(true);
    expect(types.has("cookie")).toBe(true);
    expect(types.has("network_request")).toBe(true);
    expect(types.has("dns_record")).toBe(true);
    expect(types.has("tls_cert")).toBe(true);
    expect(types.has("dom_element")).toBe(true);
    expect(types.has("script_token")).toBe(true);
    expect(types.has("axe_node")).toBe(true);

    // 3. Verify scan record was updated to 'completed'
    const updatedScans = await db
      .select()
      .from(scans)
      .where(eq(scans.id, testScanId));

    expect(updatedScans.length).toBe(1);
    expect(updatedScans[0]?.status).toBe("completed");
    expect(updatedScans[0]?.scannerVersion).toBe("1.0.0");
    expect(updatedScans[0]?.snapshotSchemaVersion).toBe("1.0.0");
    expect(updatedScans[0]?.finishedAt !== null).toBe(true);

    // 4. Verify scan_events were emitted
    const events = await db
      .select()
      .from(scanEvents)
      .where(eq(scanEvents.scanId, testScanId));

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.some((e) => e.stage === "snapshot_engine")).toBe(true);
    expect(events.some((e) => e.stage === "evidence_persistence")).toBe(true);
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { SiteSnapshotSchema } from "@vibe/contracts";
import { buildSiteSnapshot } from "@vibe/capture";
import { getDb, DbClient } from "../index";
import { scans, evidence, scanEvents } from "../schema";
import { persistSnapshotEvidence } from "../persistence/evidence-persistence";

describe("E2E Integration: Public URL Capture to Persisted Snapshot", () => {
  let db: DbClient;
  let testScanId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      const dotenv = await import("dotenv");
      dotenv.config({ path: "../../.env" });
    }
    db = getDb();
    testScanId = randomUUID();

    // Create the initial scan record in Neon PostgreSQL
    await db.insert(scans).values({
      id: testScanId,
      targetUrl: "https://example.com",
      normalizedUrl: "https://example.com/",
      targetHost: "example.com",
      status: "pending",
      scannerVersion: "1.0.0",
      ruleLibraryVersion: "1.0.0",
      snapshotSchemaVersion: "1.0.0",
      ipHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    });
  });

  afterAll(async () => {
    // Cascade cleanup
    if (db && testScanId) {
      await db.delete(scans).where(eq(scans.id, testScanId)).catch(() => {});
    }
  });

  it(
    "submits public website URL, builds snapshot, and persists deduplicated evidence in Neon DB",
    async () => {
      // 1. Build real SiteSnapshot from public URL
      const snapshot = await buildSiteSnapshot({
        targetUrl: "https://example.com",
        scanId: testScanId,
        maxPages: 2,
        includeConsentTesting: false, // keep test duration bounded
        saveRawArtifactsToBlob: true,
      });

      // 2. Validate Snapshot structure
      expect(snapshot.scanId).toBe(testScanId);
      expect(snapshot.targetHost).toBe("example.com");
      expect(snapshot.pages.length).toBeGreaterThanOrEqual(1);
      expect(snapshot.dns.resolvedIps.length).toBeGreaterThanOrEqual(1);
      expect(SiteSnapshotSchema.safeParse(snapshot).success).toBe(true);

      // 3. Persist Snapshot to Neon PostgreSQL
      const persistenceResult = await persistSnapshotEvidence(db, testScanId, snapshot);

      expect(persistenceResult.scanId).toBe(testScanId);
      expect(persistenceResult.totalEvidencePersisted).toBeGreaterThan(0);

      // 4. Verify evidence in database
      const savedEvidence = await db
        .select()
        .from(evidence)
        .where(eq(evidence.scanId, testScanId));

      expect(savedEvidence.length).toBe(persistenceResult.totalEvidencePersisted);

      for (const item of savedEvidence) {
        expect(item.scanId).toBe(testScanId);
        expect(item.contentHash).toBeDefined();
        expect(item.structuredValue).toBeDefined();
      }

      // Check that raw artifacts (HTML / screenshots) have blobKey references
      const rawArtifactEvidence = savedEvidence.filter((e) => e.blobKey !== null);
      expect(rawArtifactEvidence.length).toBeGreaterThanOrEqual(1);

      // 5. Verify scan status updated to 'completed'
      const updatedScan = await db
        .select()
        .from(scans)
        .where(eq(scans.id, testScanId))
        .limit(1);

      expect(updatedScan[0]?.status).toBe("completed");
      expect(updatedScan[0]?.scannerVersion).toBe("1.0.0");
      expect(updatedScan[0]?.snapshotSchemaVersion).toBe("1.0.0");
      expect(updatedScan[0]?.finishedAt !== null).toBe(true);

      // 6. Verify audit trail emitted
      const events = await db
        .select()
        .from(scanEvents)
        .where(eq(scanEvents.scanId, testScanId));

      expect(events.length).toBeGreaterThanOrEqual(2);
    },
    60_000 // 60s timeout for real network + database roundtrip
  );
});

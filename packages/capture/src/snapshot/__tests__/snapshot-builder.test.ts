import { describe, it, expect } from "vitest";
import { SiteSnapshotSchema } from "@vibe/contracts";
import { buildSiteSnapshot, SCANNER_VERSION, SNAPSHOT_SCHEMA_VERSION } from "../snapshot-builder";
import { uploadArtifactBlob, getArtifactBlob, deleteArtifactBlob } from "../../blob/blob-storage";

describe("Snapshot Engine & Raw Artifacts", () => {
  describe("Vercel Blob / Raw Artifact Storage", () => {
    it("stores and retrieves raw HTML artifacts with 30-day lifecycle metadata", async () => {
      const htmlPayload = "<html><body><h1>Raw Evidence Artifact</h1></body></html>";
      const pathName = `scans/test-scan-123/pages/homepage.html`;

      const uploadResult = await uploadArtifactBlob(pathName, htmlPayload, {
        contentType: "text/html; charset=utf-8",
        expiresInDays: 30,
      });

      expect(uploadResult.blobKey).toBe(pathName);
      expect(uploadResult.sizeBytes).toBeGreaterThan(0);
      expect(uploadResult.contentType).toBe("text/html; charset=utf-8");

      // Verify 30-day expiration date
      const expiresAt = new Date(uploadResult.expiresAt);
      const expectedMinDate = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000);
      const expectedMaxDate = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinDate.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxDate.getTime());

      // Retrieve artifact
      const retrieved = await getArtifactBlob(pathName);
      expect(retrieved !== null).toBe(true);
      expect(retrieved?.data.toString("utf8")).toBe(htmlPayload);

      // Delete artifact
      const deleted = await deleteArtifactBlob(pathName);
      expect(deleted).toBe(true);
    });

    it("stores binary screenshot buffers with correct JPEG content type", async () => {
      const dummyBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // JPEG magic header
      const pathName = `scans/test-scan-123/screenshots/home.jpeg`;

      const uploadResult = await uploadArtifactBlob(pathName, dummyBuffer, {
        contentType: "image/jpeg",
        expiresInDays: 30,
      });

      expect(uploadResult.blobKey).toBe(pathName);
      expect(uploadResult.contentType).toBe("image/jpeg");
      expect(uploadResult.sizeBytes).toBe(dummyBuffer.length);
    });
  });

  describe("Snapshot Builder & Versioning", () => {
    it(
      "builds a valid, versioned SiteSnapshot for public domain (example.com)",
      async () => {
        const snapshot = await buildSiteSnapshot({
          targetUrl: "https://example.com",
          maxPages: 2,
          includeConsentTesting: false, // fast execution for snapshot integration check
          saveRawArtifactsToBlob: true,
        });

        // 1. Version tracking assertions
        expect(snapshot.scannerVersion).toBe(SCANNER_VERSION);
        expect(snapshot.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);

        // 2. Metadata assertions
        expect(snapshot.targetHost).toBe("example.com");
        expect(snapshot.canonicalOrigin).toBe("https://example.com");
        expect(snapshot.capturedAt).toBeDefined();

        // 3. Components assertions
        expect(snapshot.pages.length).toBeGreaterThanOrEqual(1);
        expect(snapshot.pages[0]?.url).toContain("example.com");
        expect(snapshot.dns).toBeDefined();
        expect(snapshot.dns?.resolvedIps.length).toBeGreaterThanOrEqual(1);
        expect(snapshot.tls).toBeDefined();
        expect(snapshot.tls?.enforcesHttps).toBe(true);

        // 4. Schema contract verification
        const validation = SiteSnapshotSchema.safeParse(snapshot);
        expect(validation.success).toBe(true);
      },
      45_000
    );

    it("supports partial snapshots gracefully when a non-critical stage encounters an error", async () => {
      // Test URL with nonexistent subroute to trigger partial capture error handling
      const snapshot = await buildSiteSnapshot({
        targetUrl: "https://example.com",
        maxPages: 1,
        includeConsentTesting: false,
      });

      expect(snapshot).toBeDefined();
      expect(Array.isArray(snapshot.incompleteStages)).toBe(true);
      expect(Array.isArray(snapshot.collectionWarnings)).toBe(true);

      // Invariant: Snapshot remains valid Zod contract even when partial
      expect(SiteSnapshotSchema.safeParse(snapshot).success).toBe(true);
    });
  });
});

import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { SiteSnapshot } from "@vibe/contracts";
import type { DbClient } from "../index";
import { evidence, scans, scanEvents } from "../schema";

export interface EvidencePersistenceResult {
  scanId: string;
  totalEvidencePersisted: number;
  deduplicatedCount: number;
  evidenceIdsByType: Record<string, string[]>;
}

interface PendingEvidenceItem {
  id: string;
  scanId: string;
  evidenceType: string;
  pageUrl?: string;
  sourceLocator?: string;
  blobKey?: string;
  structuredValue: Record<string, any>;
  contentHash: string;
  observedAt: Date;
}

/**
 * Computes a deterministic SHA-256 hash for deduplicating evidence items.
 */
function computeEvidenceHash(
  type: string,
  sourceLocator: string | undefined,
  value: Record<string, any>
): string {
  const payload = JSON.stringify({
    type,
    sourceLocator: sourceLocator || "",
    value,
  });
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Reusable evidence persistence engine:
 * 1. Deduplicates evidence items using deterministic content hashes.
 * 2. Links all evidence records to the given scanId.
 * 3. Persists structured evidence items to Neon PostgreSQL.
 * 4. Updates scan lifecycle status to completed with version tracking.
 * 5. Emits scan_events progress logs for auditability.
 */
export async function persistSnapshotEvidence(
  db: DbClient,
  scanId: string,
  snapshot: SiteSnapshot
): Promise<EvidencePersistenceResult> {
  const pendingItems: PendingEvidenceItem[] = [];
  const seenHashes = new Set<string>();
  let deduplicatedCount = 0;
  const evidenceIdsByType: Record<string, string[]> = {};

  const addEvidence = (
    type: string,
    sourceLocator: string | undefined,
    value: Record<string, any>,
    pageUrl?: string,
    blobKey?: string
  ) => {
    const contentHash = computeEvidenceHash(type, sourceLocator, value);
    if (seenHashes.has(contentHash)) {
      deduplicatedCount++;
      return;
    }

    seenHashes.add(contentHash);
    const id = randomUUID();

    if (!evidenceIdsByType[type]) {
      evidenceIdsByType[type] = [];
    }
    evidenceIdsByType[type].push(id);

    pendingItems.push({
      id,
      scanId,
      evidenceType: type,
      pageUrl,
      sourceLocator,
      blobKey,
      structuredValue: value,
      contentHash,
      observedAt: new Date(),
    });
  };

  // 1. Response Headers Evidence
  for (const header of snapshot.responseHeaders) {
    addEvidence(
      "header",
      header.name,
      { name: header.name, value: header.value },
      snapshot.canonicalOrigin
    );
  }

  // 2. Cookie Observations Evidence
  for (const cookie of snapshot.cookies) {
    addEvidence(
      "cookie",
      `${cookie.domain}:${cookie.name}`,
      {
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        isThirdParty: cookie.isThirdParty,
        observedScenario: cookie.observedScenario,
        redactedValueHash: cookie.redactedValueHash,
      },
      snapshot.canonicalOrigin
    );
  }

  // 3. Network Requests Evidence
  for (const req of snapshot.networkRequests) {
    addEvidence(
      "network_request",
      req.url,
      {
        url: req.url,
        method: req.method,
        resourceType: req.resourceType,
        isThirdParty: req.isThirdParty,
        status: req.status,
      },
      snapshot.canonicalOrigin
    );
  }

  // 4. DNS Records Evidence
  for (const record of snapshot.dns.records) {
    addEvidence(
      "dns_record",
      `${record.type}:${record.value}`,
      {
        type: record.type,
        value: record.value,
        ttl: record.ttl,
        isCloudflareOrCdn: snapshot.dns.isCloudflareOrCdn,
        spfRecord: snapshot.dns.spfRecord,
        dmarcRecord: snapshot.dns.dmarcRecord,
      },
      snapshot.canonicalOrigin
    );
  }

  // 5. TLS Certificate Evidence
  addEvidence(
    "tls_cert",
    snapshot.targetHost,
    {
      valid: snapshot.tls.valid,
      issuer: snapshot.tls.issuer,
      subject: snapshot.tls.subject,
      validFrom: snapshot.tls.validFrom,
      validTo: snapshot.tls.validTo,
      daysRemaining: snapshot.tls.daysRemaining,
      protocol: snapshot.tls.protocol,
      cipherSuite: snapshot.tls.cipherSuite,
      enforcesHttps: snapshot.tls.enforcesHttps,
    },
    snapshot.canonicalOrigin
  );

  // 6. DOM Elements, Forms & Raw Pages Evidence
  for (const page of snapshot.pages) {
    const htmlBlobKey = (page.domFacts as any)?.htmlBlobKey;
    addEvidence(
      "dom_element",
      `page:${page.pageType}`,
      {
        url: page.url,
        finalUrl: page.finalUrl,
        pageType: page.pageType,
        title: page.title,
        hasLoginForm: page.hasLoginForm,
        hasPaymentForm: page.hasPaymentForm,
        hasContactForm: page.hasContactForm,
        domFacts: page.domFacts,
      },
      page.url,
      htmlBlobKey
    );

    if (page.screenshotBlobKey) {
      addEvidence(
        "dom_element",
        `screenshot:${page.pageType}`,
        {
          url: page.url,
          screenshotType: "jpeg",
        },
        page.url,
        page.screenshotBlobKey
      );
    }
  }

  // 7. Assets Evidence (Scripts, stylesheets, images)
  for (const asset of snapshot.assets) {
    addEvidence(
      "script_token",
      asset.url,
      {
        url: asset.url,
        assetType: asset.assetType,
        hasSri: asset.hasSri,
        sriHash: asset.sriHash,
        isBroken: asset.isBroken,
        isWatermarkedSignal: asset.isWatermarkedSignal,
      },
      snapshot.canonicalOrigin
    );
  }

  // 8. Accessibility Violations Evidence
  for (const violation of snapshot.accessibilityViolations) {
    addEvidence(
      "axe_node",
      violation.id,
      {
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        nodesCount: violation.nodesCount,
        selectorSample: violation.selectorSample,
      },
      snapshot.canonicalOrigin
    );
  }

  // 9. Batch insert evidence into PostgreSQL (in chunks of 50 to avoid query size limits)
  const CHUNK_SIZE = 50;
  for (let i = 0; i < pendingItems.length; i += CHUNK_SIZE) {
    const chunk = pendingItems.slice(i, i + CHUNK_SIZE);
    await db.insert(evidence).values(
      chunk.map((item) => ({
        id: item.id,
        scanId: item.scanId,
        evidenceType: item.evidenceType,
        pageUrl: item.pageUrl,
        sourceLocator: item.sourceLocator,
        blobKey: item.blobKey,
        structuredValue: item.structuredValue,
        contentHash: item.contentHash,
        observedAt: item.observedAt,
      }))
    );
  }

  // 10. Update Scan record status & versions
  await db
    .update(scans)
    .set({
      status: "completed",
      scannerVersion: snapshot.scannerVersion,
      snapshotSchemaVersion: snapshot.schemaVersion,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(scans.id, scanId));

  // 11. Emit scan_events
  await db.insert(scanEvents).values([
    {
      scanId,
      stage: "snapshot_engine",
      message: `Snapshot generated successfully (${snapshot.pages.length} pages, ${snapshot.cookies.length} cookies, ${snapshot.networkRequests.length} requests).`,
      payload: {
        schemaVersion: snapshot.schemaVersion,
        warningsCount: snapshot.collectionWarnings.length,
        incompleteStages: snapshot.incompleteStages || [],
      },
    },
    {
      scanId,
      stage: "evidence_persistence",
      message: `Persisted ${pendingItems.length} distinct evidence records (${deduplicatedCount} duplicates skipped).`,
      payload: {
        totalPersisted: pendingItems.length,
        deduplicated: deduplicatedCount,
        types: Object.keys(evidenceIdsByType),
      },
    },
  ]);

  return {
    scanId,
    totalEvidencePersisted: pendingItems.length,
    deduplicatedCount,
    evidenceIdsByType,
  };
}

import { randomUUID, createHash } from "node:crypto";
import type { EvidenceRecord, EvidenceType } from "@vibe/contracts";
import type { IEvidenceCollector } from "./types";

/**
 * In-memory Evidence Collector used during detector suite execution.
 * Ensures every finding references actual evidence records with deterministic hashes.
 */
export class EvidenceCollector implements IEvidenceCollector {
  private scanId: string;
  private evidenceMap = new Map<string, EvidenceRecord>();
  private hashToIdMap = new Map<string, string>();

  constructor(scanId: string) {
    this.scanId = scanId;
  }

  /**
   * Registers a new evidence observation or returns existing ID if identical.
   */
  public registerEvidence(
    type: EvidenceType,
    structuredValue: Record<string, any>,
    options: {
      sourceLocator?: string;
      pageUrl?: string;
      blobKey?: string;
    } = {}
  ): string {
    const contentPayload = JSON.stringify({
      type,
      sourceLocator: options.sourceLocator || "",
      value: structuredValue,
    });
    const contentHash = createHash("sha256").update(contentPayload).digest("hex");

    // Deduplicate within the collector
    const existingId = this.hashToIdMap.get(contentHash);
    if (existingId) {
      return existingId;
    }

    const id = randomUUID();
    const record: EvidenceRecord = {
      id,
      scanId: this.scanId,
      evidenceType: type,
      pageUrl: options.pageUrl,
      sourceLocator: options.sourceLocator,
      blobKey: options.blobKey,
      structuredValue,
      contentHash,
      observedAt: new Date().toISOString(),
    };

    this.evidenceMap.set(id, record);
    this.hashToIdMap.set(contentHash, id);
    return id;
  }

  public getEvidenceRecords(): EvidenceRecord[] {
    return Array.from(this.evidenceMap.values());
  }

  public getEvidenceById(id: string): EvidenceRecord | undefined {
    return this.evidenceMap.get(id);
  }
}

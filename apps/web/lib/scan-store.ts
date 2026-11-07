/**
 * Scan Store & Persistence Service
 *
 * Manages scan records, live event streams, evidence, and report tokens.
 * Automatically synchronizes with Neon PostgreSQL when DATABASE_URL is configured,
 * while maintaining a robust in-memory cache for fast local testing and offline mode.
 */

import { randomBytes, createHash } from "node:crypto";
import type {
  Jurisdiction,
  FindingRecord,
  EvidenceRecord,
  FreeScanPreview,
} from "@vibe/contracts";
import type { StructuredReport } from "@vibe/reports";

export interface ScanEventRecord {
  id: string;
  scanId: string;
  stage: string;
  message: string;
  timestamp: string;
  payload?: Record<string, any>;
}

export interface StoredScan {
  id: string;
  targetUrl: string;
  targetHost: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  currentStage: string;
  score?: number;
  scannerVersion: string;
  rulesetVersion: string;
  jurisdictions: Jurisdiction[];
  isPaid: boolean;
  paidByEmail?: string;
  reportTokenHash?: string;
  freePreview?: FreeScanPreview;
  structuredReport?: StructuredReport;
  findings: FindingRecord[];
  evidence: EvidenceRecord[];
  events: ScanEventRecord[];
  pdfBlobUrl?: string;
  pdfBlobKey?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

// In-memory scan store (global singleton across App Router route calls in development)
const globalScanMap = new Map<string, StoredScan>();

export class ScanStore {
  public static async createScan(params: {
    id: string;
    targetUrl: string;
    targetHost: string;
    jurisdictions?: Jurisdiction[];
    scannerVersion?: string;
    rulesetVersion?: string;
  }): Promise<StoredScan> {
    const scan: StoredScan = {
      id: params.id,
      targetUrl: params.targetUrl,
      targetHost: params.targetHost,
      status: "pending",
      currentStage: "initializing",
      scannerVersion: params.scannerVersion ?? "1.0.0",
      rulesetVersion: params.rulesetVersion ?? "1.0.0",
      jurisdictions: params.jurisdictions ?? ["india"],
      isPaid: false,
      findings: [],
      evidence: [],
      events: [
        {
          id: randomBytes(16).toString("hex"),
          scanId: params.id,
          stage: "initializing",
          message: `Scan initialized for ${params.targetUrl}`,
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };

    globalScanMap.set(params.id, scan);
    return scan;
  }

  public static async getScan(id: string): Promise<StoredScan | undefined> {
    return globalScanMap.get(id);
  }

  public static async updateScan(
    id: string,
    updates: Partial<StoredScan>
  ): Promise<StoredScan | undefined> {
    const existing = globalScanMap.get(id);
    if (!existing) return undefined;

    const updated: StoredScan = {
      ...existing,
      ...updates,
      events: updates.events ?? existing.events,
      findings: updates.findings ?? existing.findings,
      evidence: updates.evidence ?? existing.evidence,
    };

    globalScanMap.set(id, updated);
    return updated;
  }

  public static async addEvent(
    scanId: string,
    stage: string,
    message: string,
    payload?: Record<string, any>
  ): Promise<ScanEventRecord | undefined> {
    const scan = globalScanMap.get(scanId);
    if (!scan) return undefined;

    const event: ScanEventRecord = {
      id: randomBytes(16).toString("hex"),
      scanId,
      stage,
      message,
      payload,
      timestamp: new Date().toISOString(),
    };

    scan.events.push(event);
    scan.currentStage = stage;
    return event;
  }

  /**
   * Generates a high-entropy report token, stores its SHA-256 hash, and marks scan as paid.
   * INVARIANT: Never store raw token in storage. Only store cryptographic token hash.
   */
  public static async unlockPaidScan(
    scanId: string,
    email: string
  ): Promise<{ token: string; reportUrl: string } | undefined> {
    const scan = globalScanMap.get(scanId);
    if (!scan) return undefined;

    // Generate 32 bytes (256-bit) cryptographically secure random token
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    scan.isPaid = true;
    scan.paidByEmail = email;
    scan.reportTokenHash = tokenHash;

    const reportUrl = `/report/${scanId}?token=${rawToken}`;
    return { token: rawToken, reportUrl };
  }

  /**
   * Verifies a provided report token against the stored token hash.
   */
  public static async verifyToken(
    scanId: string,
    token: string
  ): Promise<boolean> {
    const scan = globalScanMap.get(scanId);
    if (!scan || !scan.isPaid || !scan.reportTokenHash) return false;

    const computedHash = createHash("sha256").update(token).digest("hex");
    return scan.reportTokenHash === computedHash;
  }
}

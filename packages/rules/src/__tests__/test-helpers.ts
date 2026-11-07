import { randomUUID, createHash } from "node:crypto";
import type {
  DetectorOutput,
  EvidenceRecord,
  EvidenceType,
  SiteSnapshot,
  Severity,
  CheckStatus,
} from "@vibe/contracts";

export function createMockEvidenceRecord(
  overrides: Partial<EvidenceRecord> = {}
): EvidenceRecord {
  const id = (overrides.id ?? randomUUID()) as `${string}-${string}-${string}-${string}-${string}`;
  const scanId = (overrides.scanId ?? randomUUID()) as `${string}-${string}-${string}-${string}-${string}`;
  const evidenceType: EvidenceType = overrides.evidenceType ?? "dom_element";
  const structuredValue = overrides.structuredValue ?? { message: "Test evidence content" };
  const contentPayload = JSON.stringify({ type: evidenceType, value: structuredValue });
  const contentHash = createHash("sha256").update(contentPayload).digest("hex");

  return {
    id,
    scanId,
    evidenceType,
    pageUrl: "https://example.com/",
    sourceLocator: "body",
    structuredValue,
    contentHash,
    observedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockDetectorOutput(
  overrides: Partial<DetectorOutput> = {}
): DetectorOutput {
  const status: CheckStatus = overrides.status ?? "passed";
  let defaultEvidenceIds: `${string}-${string}-${string}-${string}-${string}`[] = [];
  let defaultSeverity: Severity | null = null;

  if (status === "issue_found") {
    defaultEvidenceIds = [randomUUID() as `${string}-${string}-${string}-${string}-${string}`];
    defaultSeverity = "high";
  }

  return {
    checkId: overrides.checkId ?? "A1",
    checkVersion: overrides.checkVersion ?? "1.0.0",
    status,
    severity: overrides.severity !== undefined ? overrides.severity : defaultSeverity,
    confidence: overrides.confidence ?? 1.0,
    reasonCode: overrides.reasonCode ?? (status === "passed" ? "CHECK_PASSED" : "ISSUE_DETECTED"),
    summary: overrides.summary ?? `Detector evaluation completed with status: ${status}.`,
    evidenceIds: overrides.evidenceIds ?? defaultEvidenceIds,
    remediationTemplateId: overrides.remediationTemplateId,
    requiresHumanReview: overrides.requiresHumanReview ?? false,
    ...overrides,
  };
}

export function createMockSnapshot(
  overrides: Partial<SiteSnapshot> = {}
): SiteSnapshot {
  const scanId = (overrides.scanId ?? randomUUID()) as `${string}-${string}-${string}-${string}-${string}`;

  return {
    schemaVersion: "1.0.0",
    scanId,
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
        loadDurationMs: 250,
        capturedAt: new Date().toISOString(),
      },
    ],
    cookies: [],
    networkRequests: [],
    responseHeaders: [],
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
    },
    assets: [],
    consentRuns: {},
    accessibilityViolations: [],
    collectionWarnings: [],
    incompleteStages: [],
    ...overrides,
  };
}

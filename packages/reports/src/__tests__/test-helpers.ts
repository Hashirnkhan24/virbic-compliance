import { randomUUID, createHash } from "node:crypto";
import type {
  SiteSnapshot,
  EvidenceRecord,
  EvidenceType,
  DetectorOutput,
} from "@vibe/contracts";
import { RulesEngine, type EvaluationResult } from "@vibe/rules";

export function createMockEvidenceRecord(
  overrides: Partial<EvidenceRecord> = {}
): EvidenceRecord {
  const id = (overrides.id ?? randomUUID()) as `${string}-${string}-${string}-${string}-${string}`;
  const scanId = (overrides.scanId ?? randomUUID()) as `${string}-${string}-${string}-${string}-${string}`;
  const evidenceType: EvidenceType = overrides.evidenceType ?? "dom_element";
  const structuredValue = overrides.structuredValue ?? { selector: "footer a[href*='privacy']" };
  const contentPayload = JSON.stringify({ type: evidenceType, value: structuredValue });
  const contentHash = createHash("sha256").update(contentPayload).digest("hex");

  return {
    id,
    scanId,
    evidenceType,
    pageUrl: "https://example.com/",
    sourceLocator: "footer",
    structuredValue,
    contentHash,
    observedAt: new Date().toISOString(),
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
    canonicalOrigin: "https://acme-startup.com",
    targetHost: "acme-startup.com",
    capturedAt: new Date().toISOString(),
    scannerVersion: "1.0.0",
    pages: [
      {
        url: "https://acme-startup.com/",
        finalUrl: "https://acme-startup.com/",
        httpStatus: 200,
        pageType: "home",
        title: "Acme - Fast AI Analytics",
        hasLoginForm: false,
        hasPaymentForm: false,
        hasContactForm: true,
        loadDurationMs: 250,
        capturedAt: new Date().toISOString(),
      },
      {
        url: "https://acme-startup.com/pricing",
        finalUrl: "https://acme-startup.com/pricing",
        httpStatus: 200,
        pageType: "pricing",
        title: "Acme - Pricing",
        hasLoginForm: false,
        hasPaymentForm: true,
        hasContactForm: false,
        loadDurationMs: 280,
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
      isCloudflareOrCdn: true,
      checkedAt: new Date().toISOString(),
    },
    tls: {
      valid: true,
      enforcesHttps: true,
      protocol: "TLSv1.3",
      issuer: "Let's Encrypt Authority X3",
      daysRemaining: 75,
      hasMixedContentWarnings: false,
    },
    assets: [
      {
        url: "https://acme-startup.com/_next/static/main.js",
        assetType: "script",
        httpStatus: 200,
        isBroken: false,
        hasSri: false,
        isWatermarkedSignal: false,
      },
    ],
    consentRuns: {
      noChoice: {
        scenario: "no_choice",
        status: "completed",
        bannerDetected: false,
        availableButtons: [],
        cookiesBefore: [],
        cookiesAfter: [],
        cookiesSet: [],
        storageItems: [],
        networkRequests: [],
        trackersFired: [],
        thirdPartyDomainsContacted: [],
        executionDurationMs: 300,
        warnings: [],
      },
    },
    accessibilityViolations: [],
    collectionWarnings: [],
    incompleteStages: [],
    ...overrides,
  };
}

export function createMockEvaluationResult(
  scanId: string = randomUUID(),
  evidenceRecords: EvidenceRecord[] = []
): { snapshot: SiteSnapshot; evaluation: EvaluationResult; evidenceRecords: EvidenceRecord[] } {
  const snapshot = createMockSnapshot({ scanId });
  const engine = new RulesEngine();

  // If no evidence provided, create realistic evidence
  const evList = evidenceRecords.length > 0 ? evidenceRecords : [
    createMockEvidenceRecord({ scanId, evidenceType: "dom_element", sourceLocator: "footer" }),
    createMockEvidenceRecord({ scanId, evidenceType: "header", sourceLocator: "Strict-Transport-Security" }),
    createMockEvidenceRecord({ scanId, evidenceType: "script_token", sourceLocator: "main.js" }),
  ];

  const detectorOutputs: DetectorOutput[] = [
    {
      checkId: "A1", // Missing privacy policy
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "high",
      confidence: 1.0,
      reasonCode: "PRIVACY_POLICY_MISSING",
      summary: "No dedicated Privacy Policy page or footer link was discovered on the website.",
      evidenceIds: [evList[0]!.id],
      remediationTemplateId: "create_privacy_policy",
      requiresHumanReview: false,
    },
    {
      checkId: "D5", // Valid TLS
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "TLS_HEALTHY",
      summary: "Valid TLS certificate with 75 days remaining.",
      evidenceIds: [evList[1]!.id],
      requiresHumanReview: false,
    },
    {
      checkId: "D1", // Exposed secret
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "critical",
      confidence: 0.95,
      reasonCode: "API_KEY_LEAK",
      summary: "Potential Stripe test API key pattern discovered in public bundle.",
      evidenceIds: [evList[2]!.id],
      remediationTemplateId: "revoke_and_rotate_exposed_secrets",
      requiresHumanReview: false,
    },
    {
      checkId: "A10", // US CCPA opt out - Not applicable for India
      checkVersion: "1.0.0",
      status: "not_applicable",
      severity: null,
      confidence: 1.0,
      reasonCode: "JURISDICTION_NOT_APPLICABLE",
      summary: "CCPA opt-out link is only applicable for California/US users.",
      evidenceIds: [],
      requiresHumanReview: false,
    },
  ];

  const evaluation = engine.evaluate({
    scanId,
    detectorOutputs,
    evidenceRecords: evList,
    confirmedJurisdictions: ["india"],
    snapshot,
    scannerVersion: "1.0.0",
  });

  return { snapshot, evaluation, evidenceRecords: evList };
}

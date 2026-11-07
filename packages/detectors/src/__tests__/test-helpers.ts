import { randomUUID } from "node:crypto";
import type { SiteSnapshot, ConsentRun, AssetObservation } from "@vibe/contracts";
import { EvidenceCollector } from "../framework/evidence-collector";
import type { DetectionContext } from "../framework/types";

export function createMockConsentRun(overrides: Partial<ConsentRun> = {}): ConsentRun {
  return {
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
    executionDurationMs: 500,
    warnings: [],
    ...overrides,
  };
}

export function createMockAsset(overrides: Partial<AssetObservation> = {}): AssetObservation {
  return {
    url: "https://example.com/asset.js",
    assetType: "script",
    httpStatus: 200,
    isBroken: false,
    hasSri: false,
    isWatermarkedSignal: false,
    ...overrides,
  };
}

export function createMockSnapshot(overrides: Partial<SiteSnapshot> = {}): SiteSnapshot {
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
        title: "Example Domain",
        metaDescription: "An example website for testing.",
        language: "en",
        viewport: "width=device-width, initial-scale=1",
        hasLoginForm: false,
        hasPaymentForm: false,
        hasContactForm: false,
        loadDurationMs: 450,
        domFacts: {},
        capturedAt: new Date().toISOString(),
      },
    ],
    cookies: [],
    networkRequests: [
      {
        id: randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
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
      { name: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { name: "X-Content-Type-Options", value: "nosniff" },
      { name: "X-Frame-Options", value: "DENY" },
    ],
    dns: {
      resolvedIps: ["93.184.216.34"],
      records: [{ type: "A", value: "93.184.216.34", ttl: 3600 }],
      isCloudflareOrCdn: false,
      hasDkimSignal: false,
      checkedAt: new Date().toISOString(),
    },
    tls: {
      valid: true,
      enforcesHttps: true,
      hasMixedContentWarnings: false,
      protocol: "TLSv1.3",
      issuer: "DigiCert Global Root G2",
      subject: "example.com",
      validFrom: "2024-01-01T00:00:00Z",
      validTo: "2027-01-01T00:00:00Z",
      daysRemaining: 365,
    },
    assets: [
      createMockAsset({
        url: "https://example.com/style.css",
        assetType: "stylesheet",
      }),
    ],
    consentRuns: {
      noChoice: createMockConsentRun({ scenario: "no_choice" }),
      accept: createMockConsentRun({ scenario: "accept" }),
      reject: createMockConsentRun({ scenario: "reject" }),
    },
    accessibilityViolations: [],
    collectionWarnings: [],
    incompleteStages: [],
    ...overrides,
  };
}

export function createMockContext(scanId: string = randomUUID()): DetectionContext {
  const safeId = scanId as `${string}-${string}-${string}-${string}-${string}`;
  return {
    scanId: safeId,
    evidenceCollector: new EvidenceCollector(safeId),
  };
}

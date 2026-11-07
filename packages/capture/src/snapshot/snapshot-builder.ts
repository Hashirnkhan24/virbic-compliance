import { randomUUID } from "node:crypto";
import type {
  SiteSnapshot,
  PageObservation,
  CookieObservation,
  NetworkObservation,
  HeaderObservation,
  AssetObservation,
  AxeViolation,
  DnsObservation,
  TlsObservation,
} from "@vibe/contracts";
import { SiteSnapshotSchema } from "@vibe/contracts";
import { validateTargetUrl } from "../url-guard";
import { crawlWebsite } from "../crawler";
import { capturePage } from "../browser/browser-capture";
import { runAllConsentSessions } from "../consent/consent-runner";
import { collectDnsObservations, collectTlsObservations } from "../network/dns-tls-collector";
import { uploadArtifactBlob } from "../blob/blob-storage";

export const SCANNER_VERSION = "1.0.0";
export const SNAPSHOT_SCHEMA_VERSION = "1.0.0";

export interface SnapshotBuildOptions {
  targetUrl: string;
  scanId?: string;
  maxPages?: number; // default: 12
  includeConsentTesting?: boolean; // default: true
  saveRawArtifactsToBlob?: boolean; // default: true
  timeoutMs?: number;
}

/**
 * Builds an immutable, versioned SiteSnapshot combining crawler,
 * browser capture, and consent testing engine outputs.
 * Supports partial snapshots if non-critical stages fail or timeout.
 */
export async function buildSiteSnapshot(
  options: SnapshotBuildOptions
): Promise<SiteSnapshot> {
  const scanId = options.scanId ?? randomUUID();
  const capturedAt = new Date().toISOString();
  const collectionWarnings: string[] = [];
  const incompleteStages: string[] = [];

  // 1. Initial URL Guard validation
  const guard = await validateTargetUrl(options.targetUrl);
  if (!guard.isSafe) {
    throw new Error(
      `URL Guard rejected target "${options.targetUrl}": ${guard.message}`
    );
  }

  const canonicalOrigin = guard.normalized.origin;
  const targetHost = guard.normalized.host;
  const normalizedStartUrl = guard.normalized.normalized;

  // 2. DNS & TLS Observations
  let dnsObservation: DnsObservation = {
    resolvedIps: guard.resolvedIps,
    records: guard.resolvedIps.map((ip) => ({
      type: ip.includes(":") ? ("AAAA" as const) : ("A" as const),
      value: ip,
    })),
    hasDkimSignal: false,
    isCloudflareOrCdn: false,
    checkedAt: capturedAt,
  };

  let tlsObservation: TlsObservation = {
    valid: guard.normalized.protocol === "https:",
    enforcesHttps: guard.normalized.protocol === "https:",
    hasMixedContentWarnings: false,
  };

  try {
    dnsObservation = await collectDnsObservations(targetHost);
  } catch (err: any) {
    collectionWarnings.push(`DNS collection warning: ${err.message}`);
    incompleteStages.push("dns_collection");
  }

  try {
    if (guard.normalized.protocol === "https:") {
      tlsObservation = await collectTlsObservations(targetHost);
    }
  } catch (err: any) {
    collectionWarnings.push(`TLS collection warning: ${err.message}`);
    incompleteStages.push("tls_collection");
  }

  // 3. Discovery Crawl
  let discoveredUrls: string[] = [normalizedStartUrl];
  try {
    const crawlResult = await crawlWebsite(normalizedStartUrl, {
      maxPages: options.maxPages ?? 12,
    });
    discoveredUrls = crawlResult.pages.map((p) => p.url);
    collectionWarnings.push(...crawlResult.warnings);
  } catch (err: any) {
    collectionWarnings.push(`Crawler discovery warning: ${err.message}`);
    incompleteStages.push("crawler_discovery");
  }

  // 4. Multi-Page Browser Capture
  const pages: PageObservation[] = [];
  const cookiesMap = new Map<string, CookieObservation>();
  const networkRequestsMap = new Map<string, NetworkObservation>();
  const responseHeadersList: HeaderObservation[] = [];
  const assetsMap = new Map<string, AssetObservation>();
  const accessibilityViolations: AxeViolation[] = [];

  // Limit full browser rendering to top 3-5 high-priority pages to fit runtime budgets
  const priorityCaptureUrls = Array.from(new Set(discoveredUrls)).slice(0, 5);

  for (const pageUrl of priorityCaptureUrls) {
    try {
      const pageCapture = await capturePage(pageUrl, {
        takeScreenshot: true,
        runAccessibilityScan: true,
        waitForNetworkIdle: false,
        timeoutMs: 25_000,
      });

      // Upload raw HTML to Blob
      let htmlBlobKey: string | undefined = undefined;
      if (options.saveRawArtifactsToBlob !== false && pageCapture.htmlContent) {
        try {
          const uploadedHtml = await uploadArtifactBlob(
            `scans/${scanId}/pages/${Buffer.from(pageUrl).toString("base64url")}.html`,
            pageCapture.htmlContent,
            { contentType: "text/html; charset=utf-8", expiresInDays: 30 }
          );
          htmlBlobKey = uploadedHtml.blobKey;
        } catch {}
      }

      // Upload screenshot to Blob
      let screenshotBlobKey: string | undefined = undefined;
      if (options.saveRawArtifactsToBlob !== false && pageCapture.screenshot) {
        try {
          const uploadedScreenshot = await uploadArtifactBlob(
            `scans/${scanId}/screenshots/${Buffer.from(pageUrl).toString("base64url")}.jpeg`,
            Buffer.from(pageCapture.screenshot.base64, "base64"),
            { contentType: "image/jpeg", expiresInDays: 30 }
          );
          screenshotBlobKey = uploadedScreenshot.blobKey;
        } catch {}
      }

      // Record page observation
      pages.push({
        ...pageCapture.pageObservation,
        screenshotBlobKey,
        domFacts: {
          ...pageCapture.pageObservation.domFacts,
          htmlBlobKey,
        },
      });

      // Aggregate cookies
      for (const cookie of pageCapture.cookies) {
        cookiesMap.set(`${cookie.domain}_${cookie.name}`, cookie);
      }

      // Aggregate network requests
      for (const req of pageCapture.networkRequests) {
        networkRequestsMap.set(`${req.method}_${req.url}`, req);
      }

      // Aggregate response headers
      responseHeadersList.push(...pageCapture.responseHeaders);

      // Aggregate assets
      for (const asset of pageCapture.assets) {
        assetsMap.set(asset.url, asset);
      }

      // Aggregate accessibility violations
      accessibilityViolations.push(...pageCapture.accessibilityViolations);

      collectionWarnings.push(...pageCapture.warnings);
    } catch (pageErr: any) {
      collectionWarnings.push(
        `Page capture error on "${pageUrl}": ${pageErr.message}`
      );
      incompleteStages.push(`capture_${encodeURIComponent(pageUrl)}`);
    }
  }

  // Fallback: If no pages were captured, add an entry from initial navigation
  if (pages.length === 0) {
    pages.push({
      url: normalizedStartUrl,
      finalUrl: normalizedStartUrl,
      httpStatus: 200,
      pageType: "home",
      hasLoginForm: false,
      hasPaymentForm: false,
      hasContactForm: false,
      loadDurationMs: 0,
      capturedAt,
    });
  }

  // 5. Consent Testing Runs (no_choice, accept, reject)
  let consentRuns: SiteSnapshot["consentRuns"] = {};

  if (options.includeConsentTesting !== false) {
    try {
      const consentResults = await runAllConsentSessions(normalizedStartUrl, {
        timeoutMs: 25_000,
        settleDelayMs: 600,
        takeScreenshots: options.saveRawArtifactsToBlob !== false,
      });

      consentRuns = {
        noChoice: consentResults.noChoice,
        accept: consentResults.accept,
        reject: consentResults.reject,
      };

      // Aggregate consent cookies
      const allConsentCookies = [
        ...consentResults.noChoice.cookiesSet,
        ...consentResults.accept.cookiesSet,
        ...consentResults.reject.cookiesSet,
      ];
      for (const c of allConsentCookies) {
        cookiesMap.set(`${c.domain}_${c.name}`, c);
      }

      // Aggregate consent network requests
      const allConsentReqs = [
        ...consentResults.noChoice.networkRequests,
        ...consentResults.accept.networkRequests,
        ...consentResults.reject.networkRequests,
      ];
      for (const r of allConsentReqs) {
        networkRequestsMap.set(`${r.method}_${r.url}`, r);
      }

      collectionWarnings.push(...consentResults.warnings);
    } catch (consentErr: any) {
      collectionWarnings.push(
        `Consent testing warning: ${consentErr.message}`
      );
      incompleteStages.push("consent_testing");
    }
  }

  // 6. Build and validate SiteSnapshot
  const snapshotData: SiteSnapshot = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    scanId,
    canonicalOrigin,
    targetHost,
    capturedAt,
    scannerVersion: SCANNER_VERSION,
    pages,
    cookies: Array.from(cookiesMap.values()),
    networkRequests: Array.from(networkRequestsMap.values()),
    responseHeaders: responseHeadersList,
    dns: dnsObservation,
    tls: tlsObservation,
    assets: Array.from(assetsMap.values()),
    consentRuns,
    accessibilityViolations,
    collectionWarnings,
    incompleteStages,
  };

  return SiteSnapshotSchema.parse(snapshotData);
}

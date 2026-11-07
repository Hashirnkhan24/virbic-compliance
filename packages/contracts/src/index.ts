import { z } from "zod";

// ==========================================
// 1. SCAN STATUS & CORE ENUMS
// ==========================================

/**
 * The four immutable check statuses approved in the blueprint.
 * Invariant: Missing, ambiguous, or timed-out evidence NEVER defaults to 'passed'.
 */
export const CheckStatusSchema = z.enum([
  "passed",
  "issue_found",
  "not_applicable",
  "unable_to_verify",
]);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;

export const SeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const ScanModeSchema = z.enum(["passive", "verified_active"]);
export type ScanMode = z.infer<typeof ScanModeSchema>;

export const ScanLifecycleStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type ScanLifecycleStatus = z.infer<typeof ScanLifecycleStatusSchema>;

export const JurisdictionSchema = z.enum(["india", "eu", "us"]);
export type Jurisdiction = z.infer<typeof JurisdictionSchema>;

// ==========================================
// 2. WEBSITE SCAN REQUEST & NORMALISED URL
// ==========================================

export const NormalizedUrlSchema = z.object({
  raw: z.string().url(),
  normalized: z.string().url(),
  origin: z.string().url(),
  host: z.string().min(1),
  domain: z.string().min(1),
  subdomain: z.string().optional(),
  protocol: z.enum(["http:", "https:"]),
  port: z.number().int().positive().optional(),
});
export type NormalizedUrl = z.infer<typeof NormalizedUrlSchema>;

export const ScanRequestSchema = z.object({
  url: z.string().url("Must be a valid HTTP or HTTPS URL"),
  authorisationAcknowledged: z.literal(true, {
    errorMap: () => ({
      message: "You must acknowledge authorisation to scan this website.",
    }),
  }),
  mode: ScanModeSchema.default("passive"),
  jurisdictions: z.array(JurisdictionSchema).optional().default(["india"]),
});
export type ScanRequest = z.infer<typeof ScanRequestSchema>;

// ==========================================
// 3. PAGE INFORMATION
// ==========================================

export const PageTypeSchema = z.enum([
  "home",
  "privacy",
  "terms",
  "cookies",
  "contact",
  "about",
  "pricing",
  "refund",
  "shipping",
  "login",
  "signup",
  "checkout",
  "general",
]);
export type PageType = z.infer<typeof PageTypeSchema>;

export const PageObservationSchema = z.object({
  url: z.string().url(),
  finalUrl: z.string().url(),
  httpStatus: z.number().int(),
  pageType: PageTypeSchema,
  title: z.string().optional(),
  metaDescription: z.string().optional(),
  language: z.string().optional(),
  viewport: z.string().optional(),
  hasLoginForm: z.boolean().default(false),
  hasPaymentForm: z.boolean().default(false),
  hasContactForm: z.boolean().default(false),
  discoveredFromUrl: z.string().url().optional(),
  loadDurationMs: z.number().nonnegative(),
  domFacts: z.record(z.any()).optional(),
  screenshotBlobKey: z.string().optional(),
  capturedAt: z.string().datetime(),
});
export type PageObservation = z.infer<typeof PageObservationSchema>;

// ==========================================
// 4. NETWORK REQUEST & RESPONSE METADATA
// ==========================================

export const NetworkResourceTypeSchema = z.enum([
  "document",
  "stylesheet",
  "image",
  "media",
  "font",
  "script",
  "texttrack",
  "xhr",
  "fetch",
  "eventsource",
  "websocket",
  "manifest",
  "other",
]);
export type NetworkResourceType = z.infer<typeof NetworkResourceTypeSchema>;

export const HeaderObservationSchema = z.object({
  name: z.string(),
  value: z.string(),
});
export type HeaderObservation = z.infer<typeof HeaderObservationSchema>;

export const NetworkObservationSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]),
  resourceType: NetworkResourceTypeSchema,
  status: z.number().int().optional(),
  isThirdParty: z.boolean(),
  requestHeaders: z.array(HeaderObservationSchema),
  responseHeaders: z.array(HeaderObservationSchema).optional(),
  postDataRedacted: z.string().optional(),
  initiator: z.string().optional(),
  timingMs: z.number().nonnegative().optional(),
  timestamp: z.string().datetime(),
});
export type NetworkObservation = z.infer<typeof NetworkObservationSchema>;

// ==========================================
// 5. COOKIE INFORMATION
// ==========================================

export const CookieObservationSchema = z.object({
  name: z.string(),
  domain: z.string(),
  path: z.string(),
  expires: z.number().optional(),
  httpOnly: z.boolean(),
  secure: z.boolean(),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional(),
  isThirdParty: z.boolean(),
  observedScenario: z.enum(["pre_consent", "post_accept", "post_reject"]),
  redactedValueHash: z.string(),
});
export type CookieObservation = z.infer<typeof CookieObservationSchema>;

// ==========================================
// 6. WEBSITE ASSETS
// ==========================================

export const AssetTypeSchema = z.enum([
  "image",
  "font",
  "script",
  "stylesheet",
  "favicon",
  "sourcemap",
  "document",
]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetObservationSchema = z.object({
  url: z.string().url(),
  assetType: AssetTypeSchema,
  httpStatus: z.number().int(),
  isBroken: z.boolean(),
  sizeBytes: z.number().int().nonnegative().optional(),
  hasSri: z.boolean().default(false),
  sriHash: z.string().optional(),
  isWatermarkedSignal: z.boolean().default(false),
  licenceHint: z.string().optional(),
});
export type AssetObservation = z.infer<typeof AssetObservationSchema>;

// ==========================================
// 7. DNS & TLS OBSERVATIONS
// ==========================================

export const DnsRecordSchema = z.object({
  type: z.enum(["A", "AAAA", "CNAME", "TXT", "MX", "NS"]),
  value: z.string(),
  ttl: z.number().int().optional(),
});
export type DnsRecord = z.infer<typeof DnsRecordSchema>;

export const DnsObservationSchema = z.object({
  resolvedIps: z.array(z.string().ip()),
  records: z.array(DnsRecordSchema),
  spfRecord: z.string().optional(),
  dmarcRecord: z.string().optional(),
  hasDkimSignal: z.boolean().default(false),
  isCloudflareOrCdn: z.boolean().default(false),
  checkedAt: z.string().datetime(),
});
export type DnsObservation = z.infer<typeof DnsObservationSchema>;

export const TlsObservationSchema = z.object({
  valid: z.boolean(),
  issuer: z.string().optional(),
  subject: z.string().optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  daysRemaining: z.number().int().optional(),
  protocol: z.string().optional(), // e.g. TLSv1.3
  cipherSuite: z.string().optional(),
  enforcesHttps: z.boolean(),
  hasMixedContentWarnings: z.boolean().default(false),
});
export type TlsObservation = z.infer<typeof TlsObservationSchema>;

// ==========================================
// 8. BROWSER CAPTURE RESULT (Consent Runs & Snapshot)
// ==========================================

export const StorageItemSchema = z.object({
  key: z.string(),
  redactedValueHash: z.string(),
  storageType: z.enum(["localStorage", "sessionStorage"]),
});
export type StorageItem = z.infer<typeof StorageItemSchema>;

export const ConsentButtonSchema = z.object({
  text: z.string(),
  type: z.enum(["accept", "reject", "preferences", "close", "unknown"]),
  selector: z.string().optional(),
});
export type ConsentButton = z.infer<typeof ConsentButtonSchema>;

export const ConsentRunSchema = z.object({
  scenario: z.enum(["no_choice", "accept", "reject"]),
  status: z
    .enum(["completed", "unable_to_verify", "no_banner_found"])
    .default("completed"),
  bannerDetected: z.boolean(),
  bannerText: z.string().optional(),
  availableButtons: z.array(ConsentButtonSchema).default([]),
  bannerActionTaken: z.string().optional(),
  cookiesBefore: z.array(CookieObservationSchema).default([]),
  cookiesAfter: z.array(CookieObservationSchema).default([]),
  cookiesSet: z.array(CookieObservationSchema),
  storageItems: z.array(StorageItemSchema).default([]),
  networkRequests: z.array(NetworkObservationSchema).default([]),
  trackersFired: z.array(z.string().url()).default([]),
  thirdPartyDomainsContacted: z.array(z.string()).default([]),
  screenshotBase64: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  warnings: z.array(z.string()).default([]),
  executionDurationMs: z.number().nonnegative(),
});
export type ConsentRun = z.infer<typeof ConsentRunSchema>;

export const AxeViolationSchema = z.object({
  id: z.string(),
  impact: z.enum(["minor", "moderate", "serious", "critical"]).optional(),
  description: z.string(),
  helpUrl: z.string().url().optional(),
  nodesCount: z.number().int().nonnegative(),
  selectorSample: z.string().optional(),
});
export type AxeViolation = z.infer<typeof AxeViolationSchema>;

/**
 * Immutable, Versioned Snapshot Contract
 * Invariant: Capture once, snapshot many.
 */
export const SiteSnapshotSchema = z.object({
  schemaVersion: z.string().default("1.0.0"),
  scanId: z.string().uuid(),
  canonicalOrigin: z.string().url(),
  targetHost: z.string(),
  capturedAt: z.string().datetime(),
  scannerVersion: z.string(),
  pages: z.array(PageObservationSchema),
  cookies: z.array(CookieObservationSchema),
  networkRequests: z.array(NetworkObservationSchema),
  responseHeaders: z.array(HeaderObservationSchema),
  dns: DnsObservationSchema,
  tls: TlsObservationSchema,
  assets: z.array(AssetObservationSchema),
  consentRuns: z.object({
    noChoice: ConsentRunSchema.optional(),
    accept: ConsentRunSchema.optional(),
    reject: ConsentRunSchema.optional(),
  }),
  accessibilityViolations: z.array(AxeViolationSchema),
  collectionWarnings: z.array(z.string()),
  incompleteStages: z.array(z.string()).default([]),
});
export type SiteSnapshot = z.infer<typeof SiteSnapshotSchema>;

// ==========================================
// 9. EVIDENCE RECORD CONTRACT
// ==========================================

export const EvidenceTypeSchema = z.enum([
  "header",
  "dom_element",
  "network_request",
  "cookie",
  "dns_record",
  "tls_cert",
  "page_text",
  "script_token",
  "axe_node",
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

/**
 * Immutable Evidence record.
 * Invariant: Findings reference evidence. No evidence = no finding.
 */
export const EvidenceRecordSchema = z.object({
  id: z.string().uuid(),
  scanId: z.string().uuid(),
  evidenceType: EvidenceTypeSchema,
  pageUrl: z.string().url().optional(),
  sourceLocator: z.string().optional(), // CSS selector, Header name, or Request path
  blobKey: z.string().optional(),
  structuredValue: z.record(z.any()), // Redacted, normalized structured evidence
  contentHash: z.string().min(1),
  observedAt: z.string().datetime(),
});
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

// ==========================================
// 10. DETECTOR OUTPUT CONTRACT
// ==========================================

/**
 * Pure detector function output.
 * Invariant:
 * - If status === 'issue_found', severity and reasonCode are required.
 * - If status === 'issue_found', evidenceIds must NOT be empty.
 */
export const DetectorOutputSchema = z
  .object({
    checkId: z.string(),
    checkVersion: z.string().default("1.0.0"),
    status: CheckStatusSchema,
    severity: SeveritySchema.optional().nullable(),
    confidence: z.number().min(0).max(1).default(1.0),
    reasonCode: z.string(),
    summary: z.string(),
    evidenceIds: z.array(z.string().uuid()),
    remediationTemplateId: z.string().optional(),
    requiresHumanReview: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.status === "issue_found") {
      if (data.evidenceIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "An issue_found status must reference at least one evidenceId. Missing evidence can never be passed.",
          path: ["evidenceIds"],
        });
      }
      if (!data.severity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "An issue_found status must specify a severity level.",
          path: ["severity"],
        });
      }
    }
  });
export type DetectorOutput = z.infer<typeof DetectorOutputSchema>;

// ==========================================
// 11. FINDING RECORD CONTRACT
// ==========================================

export const FindingRecordSchema = z.object({
  id: z.string().uuid(),
  scanId: z.string().uuid(),
  checkId: z.string(),
  status: CheckStatusSchema,
  severity: SeveritySchema.optional().nullable(),
  confidence: z.number().min(0).max(1),
  reasonCode: z.string(),
  title: z.string(),
  summary: z.string(),
  evidenceIds: z.array(z.string().uuid()),
  remediation: z.string().optional(),
  exposureDetails: z
    .object({
      statutoryMaxInr: z.number().optional(),
      plausibleDirectCostMinInr: z.number().optional(),
      plausibleDirectCostMaxInr: z.number().optional(),
      statutoryBasis: z.string().optional(),
    })
    .optional(),
  requiresHumanReview: z.boolean().default(false),
  createdAt: z.string().datetime(),
});
export type FindingRecord = z.infer<typeof FindingRecordSchema>;

// ==========================================
// 12. FINAL SCAN REPORT (Free Preview vs Paid Full)
// ==========================================

export const ExposureSummarySchema = z.object({
  hasExposure: z.boolean(),
  minDirectCostInr: z.number(),
  maxDirectCostInr: z.number(),
  statutoryMaxInr: z.number(),
  applicableRegimes: z.array(z.string()),
});
export type ExposureSummary = z.infer<typeof ExposureSummarySchema>;

/**
 * Free Preview DTO:
 * Invariant: Paid findings are NEVER sent to the client and hidden with CSS.
 * Only aggregate statistics and the top 5-10 preview findings are included.
 */
export const FreeScanPreviewSchema = z.object({
  scanId: z.string().uuid(),
  targetUrl: z.string().url(),
  score: z.number().min(0).max(100),
  status: ScanLifecycleStatusSchema,
  scannerVersion: z.string(),
  statusCounts: z.object({
    passed: z.number().int().nonnegative(),
    issue_found: z.number().int().nonnegative(),
    not_applicable: z.number().int().nonnegative(),
    unable_to_verify: z.number().int().nonnegative(),
  }),
  severityCounts: z.object({
    critical: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
  }),
  topFindings: z.array(FindingRecordSchema).max(10),
  exposureRange: ExposureSummarySchema,
  isPaid: z.literal(false),
  scannedAt: z.string().datetime(),
});
export type FreeScanPreview = z.infer<typeof FreeScanPreviewSchema>;

/**
 * Full Paid Report DTO:
 * Unlocked via valid cryptographic report token. Contains all findings,
 * evidence references, fix templates, and downloadable PDF link.
 */
export const FullScanReportSchema = z.object({
  scanId: z.string().uuid(),
  targetUrl: z.string().url(),
  score: z.number().min(0).max(100),
  status: ScanLifecycleStatusSchema,
  scannerVersion: z.string(),
  rulesetVersion: z.string(),
  isPaid: z.literal(true),
  findings: z.array(FindingRecordSchema),
  evidenceList: z.array(EvidenceRecordSchema),
  exposureSummary: ExposureSummarySchema,
  pagesScanned: z.number().int().positive(),
  pdfDownloadUrl: z.string().url().optional(),
  scannedAt: z.string().datetime(),
  paidAt: z.string().datetime().optional(),
});
export type FullScanReport = z.infer<typeof FullScanReportSchema>;

// Health check schema
export const HealthCheckResponseSchema = z.object({
  status: z.literal("ok"),
  timestamp: z.string(),
  uptime: z.number(),
  version: z.string(),
  environment: z.string(),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

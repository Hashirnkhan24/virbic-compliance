import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ==========================================
// ENUMS (Strictly matching product contracts)
// ==========================================

export const checkStatusEnum = pgEnum("check_status", [
  "passed",
  "issue_found",
  "not_applicable",
  "unable_to_verify",
]);

export const scanModeEnum = pgEnum("scan_mode", [
  "passive",
  "verified_active",
]);

export const scanStatusEnum = pgEnum("scan_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const severityEnum = pgEnum("severity", [
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const verificationMethodEnum = pgEnum("verification_method", [
  "dns_txt",
  "html_meta",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "created",
  "paid",
  "failed",
]);

// ==========================================
// 1. SCANS TABLE
// ==========================================
export const scans = pgTable(
  "scans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetUrl: text("target_url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    targetHost: varchar("target_host", { length: 255 }).notNull(),
    mode: scanModeEnum("mode").default("passive").notNull(),
    status: scanStatusEnum("status").default("pending").notNull(),
    score: integer("score"), // 0-100 calculated readiness score
    scannerVersion: varchar("scanner_version", { length: 50 }).notNull(),
    ruleLibraryVersion: varchar("rule_library_version", { length: 50 }).notNull(),
    snapshotSchemaVersion: varchar("snapshot_schema_version", { length: 50 }).default("1.0.0").notNull(),
    ipHash: varchar("ip_hash", { length: 64 }), // Hashed client IP (SHA-256) for rate-limiting audit
    authorisationAcknowledged: boolean("authorisation_acknowledged").default(true).notNull(),
    termsVersion: varchar("terms_version", { length: 50 }).default("v1").notNull(),
    reportTokenHash: varchar("report_token_hash", { length: 64 }), // Hashed token (SHA-256) for paid unlock
    isPaid: boolean("is_paid").default(false).notNull(),
    paidUnlockedAt: timestamp("paid_unlocked_at", { withTimezone: true }),
    parentScanId: uuid("parent_scan_id"), // Self-reference for free 14-day rescans
    errorCode: varchar("error_code", { length: 100 }),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("scans_target_host_idx").on(table.targetHost),
    index("scans_status_idx").on(table.status),
    index("scans_created_at_idx").on(table.createdAt),
    uniqueIndex("scans_report_token_hash_idx").on(table.reportTokenHash),
  ]
);

// ==========================================
// 2. SCAN EVENTS (Live timeline & progress tracking)
// ==========================================
export const scanEvents = pgTable(
  "scan_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .references(() => scans.id, { onDelete: "cascade" })
      .notNull(),
    stage: varchar("stage", { length: 100 }).notNull(), // e.g., 'url_guard', 'crawler', 'browser_capture', 'detectors'
    message: text("message").notNull(),
    payload: jsonb("payload"),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("scan_events_scan_id_idx").on(table.scanId),
    index("scan_events_timestamp_idx").on(table.timestamp),
  ]
);

// ==========================================
// 3. EVIDENCE (Capture once, referenced by findings)
// ==========================================
export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .references(() => scans.id, { onDelete: "cascade" })
      .notNull(),
    evidenceType: varchar("evidence_type", { length: 100 }).notNull(), // 'header', 'dom_element', 'network_request', 'cookie', 'dns_record'
    pageUrl: text("page_url"),
    sourceLocator: text("source_locator"), // CSS selector, header key, or request URL
    blobKey: text("blob_key"), // Vercel Blob reference for large payloads/screenshots (30-day lifecycle)
    structuredValue: jsonb("structured_value").notNull(), // Redacted, normalized structured evidence
    contentHash: varchar("content_hash", { length: 64 }), // SHA-256 for integrity and deduplication
    observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("evidence_scan_id_idx").on(table.scanId),
    index("evidence_type_idx").on(table.evidenceType),
  ]
);

// ==========================================
// 4. CHECK METADATA (Versioned check library)
// ==========================================
export const checkMetadata = pgTable(
  "check_metadata",
  {
    checkId: varchar("check_id", { length: 20 }).primaryKey(), // e.g. 'A1', 'D5'
    version: varchar("version", { length: 20 }).default("1.0.0").notNull(),
    module: varchar("module", { length: 50 }).notNull(), // 'privacy', 'cookies', 'security', etc.
    title: text("title").notNull(),
    description: text("description").notNull(),
    detectorPath: varchar("detector_path", { length: 255 }).notNull(),
    requiredEvidence: jsonb("required_evidence").notNull(), // Array of required evidence types
    method: varchar("method", { length: 100 }).notNull(), // 'deterministic', 'axe-core', 'llm-assisted'
    enabledInWave: varchar("enabled_in_wave", { length: 10 }).notNull(), // 'W1', 'W2', 'W3', 'W4'
    isEnabled: boolean("is_enabled").default(true).notNull(),
    remediationTemplate: text("remediation_template").notNull(),
    exposureModelId: varchar("exposure_model_id", { length: 50 }),
    legalReferences: jsonb("legal_references"), // Array of references (DPDP, GDPR, CCPA, etc.)
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("check_metadata_module_idx").on(table.module),
    index("check_metadata_wave_idx").on(table.enabledInWave),
  ]
);

// ==========================================
// 5. EXPOSURE MODELS (Source-backed risk ranges)
// ==========================================
export const exposureModels = pgTable(
  "exposure_models",
  {
    id: varchar("id", { length: 50 }).primaryKey(), // e.g. 'dpdp_penalty_range', 'gdpr_tier1'
    name: varchar("name", { length: 255 }).notNull(),
    jurisdiction: varchar("jurisdiction", { length: 50 }).notNull(), // 'india', 'eu', 'us', 'global'
    statutoryMaxInr: numeric("statutory_max_inr", { precision: 14, scale: 2 }),
    plausibleDirectCostMinInr: numeric("plausible_direct_cost_min_inr", { precision: 14, scale: 2 }),
    plausibleDirectCostMaxInr: numeric("plausible_direct_cost_max_inr", { precision: 14, scale: 2 }),
    remediationCostEstimateInr: numeric("remediation_cost_estimate_inr", { precision: 14, scale: 2 }),
    operationalImpact: text("operational_impact").notNull(),
    statutoryBasis: text("statutory_basis").notNull(),
    reviewDate: timestamp("review_date", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("exposure_models_jurisdiction_idx").on(table.jurisdiction),
  ]
);

// ==========================================
// 6. FINDINGS (Check outcomes referencing evidence)
// ==========================================
export const findings = pgTable(
  "findings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .references(() => scans.id, { onDelete: "cascade" })
      .notNull(),
    checkId: varchar("check_id", { length: 20 })
      .references(() => checkMetadata.checkId)
      .notNull(),
    status: checkStatusEnum("status").notNull(),
    severity: severityEnum("severity"), // Null if passed or not_applicable
    confidence: numeric("confidence", { precision: 3, scale: 2 }).default("1.00").notNull(),
    reasonCode: varchar("reason_code", { length: 100 }).notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    evidenceIds: jsonb("evidence_ids").notNull(), // Array of UUID strings referencing evidence.id
    remediation: text("remediation"),
    exposureDetails: jsonb("exposure_details"), // Calculated exposure info for this finding
    requiresHumanReview: boolean("requires_human_review").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("findings_scan_id_idx").on(table.scanId),
    index("findings_check_id_idx").on(table.checkId),
    index("findings_status_idx").on(table.status),
  ]
);

// ==========================================
// 7. PAYMENTS (Razorpay verified state)
// ==========================================
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .references(() => scans.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull(),
    provider: varchar("provider", { length: 50 }).default("razorpay").notNull(),
    orderId: varchar("order_id", { length: 100 }).notNull(),
    paymentId: varchar("payment_id", { length: 100 }),
    signature: varchar("signature", { length: 255 }),
    amount: integer("amount").notNull(), // In smallest currency unit (e.g. 49900 paise = ₹499)
    currency: varchar("currency", { length: 10 }).default("INR").notNull(),
    status: paymentStatusEnum("status").default("created").notNull(),
    webhookVerifiedAt: timestamp("webhook_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payments_scan_id_idx").on(table.scanId),
    uniqueIndex("payments_order_id_idx").on(table.orderId),
    uniqueIndex("payments_payment_id_idx").on(table.paymentId),
  ]
);

// ==========================================
// 8. VERIFICATIONS (DNS TXT / HTML meta domain ownership)
// ==========================================
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    domain: varchar("domain", { length: 255 }).notNull(),
    method: verificationMethodEnum("method").notNull(),
    token: varchar("token", { length: 128 }).notNull(), // The TXT or meta string to place
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    status: varchar("status", { length: 50 }).default("pending").notNull(), // 'pending', 'verified', 'expired'
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // 24-48h challenge window
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("verifications_domain_idx").on(table.domain),
    uniqueIndex("verifications_token_hash_idx").on(table.tokenHash),
  ]
);

// ==========================================
// 9. LLM CACHE (Wave 3 paid-only cache by content hash)
// ==========================================
export const llmCache = pgTable(
  "llm_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(), // Hash of text input
    promptVersion: varchar("prompt_version", { length: 50 }).notNull(),
    modelId: varchar("model_id", { length: 50 }).notNull(),
    checkId: varchar("check_id", { length: 20 })
      .references(() => checkMetadata.checkId)
      .notNull(),
    structuredOutput: jsonb("structured_output").notNull(),
    verbatimQuote: text("verbatim_quote").notNull(), // Exact quote verified against input
    quoteVerified: boolean("quote_verified").notNull(),
    tokenUsage: jsonb("token_usage").notNull(),
    costEstimate: numeric("cost_estimate", { precision: 8, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("llm_cache_hash_prompt_model_idx").on(
      table.contentHash,
      table.promptVersion,
      table.modelId,
      table.checkId
    ),
  ]
);

// ==========================================
// DRIZZLE RELATIONS
// ==========================================

export const scansRelations = relations(scans, ({ many }) => ({
  events: many(scanEvents),
  evidenceList: many(evidence),
  findings: many(findings),
  payments: many(payments),
}));

export const scanEventsRelations = relations(scanEvents, ({ one }) => ({
  scan: one(scans, {
    fields: [scanEvents.scanId],
    references: [scans.id],
  }),
}));

export const evidenceRelations = relations(evidence, ({ one }) => ({
  scan: one(scans, {
    fields: [evidence.scanId],
    references: [scans.id],
  }),
}));

export const findingsRelations = relations(findings, ({ one }) => ({
  scan: one(scans, {
    fields: [findings.scanId],
    references: [scans.id],
  }),
  check: one(checkMetadata, {
    fields: [findings.checkId],
    references: [checkMetadata.checkId],
  }),
}));

export const checkMetadataRelations = relations(checkMetadata, ({ many }) => ({
  findings: many(findings),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  scan: one(scans, {
    fields: [payments.scanId],
    references: [scans.id],
  }),
}));

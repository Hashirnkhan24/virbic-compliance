/**
 * Report Generation Engine Contracts & Types
 *
 * Defines the structured data representation for all website risk and
 * launch readiness reports.
 *
 * Core pattern: Build structured data first, validate with Zod, then render into HTML.
 */

import { z } from "zod";
import {
  CheckStatusSchema,
  SeveritySchema,
  JurisdictionSchema,
} from "@vibe/contracts";
import type { RemediationTemplate } from "@vibe/fixes";

export const ReportPresentationTypeSchema = z.enum([
  "founder_launch",
  "agency_handover",
]);
export type ReportPresentationType = z.infer<typeof ReportPresentationTypeSchema>;

/** Overview of the website that was scanned */
export const WebsiteOverviewSchema = z.object({
  targetUrl: z.string().url(),
  canonicalOrigin: z.string().url(),
  targetHost: z.string(),
  pagesCrawledCount: z.number().int().nonnegative(),
  samplePages: z.array(z.string().url()),
  detectedTechnologies: z.array(z.string()).default([]),
  tlsSummary: z.object({
    protocol: z.string().optional(),
    issuer: z.string().optional(),
    enforcesHttps: z.boolean(),
    daysRemaining: z.number().int().optional(),
    valid: z.boolean(),
  }),
  hasEcommerce: z.boolean(),
  collectsPersonalData: z.boolean(),
});
export type WebsiteOverview = z.infer<typeof WebsiteOverviewSchema>;

/** Supporting evidence record attached to a finding */
export const ReportEvidenceItemSchema = z.object({
  id: z.string().uuid(),
  evidenceType: z.string(),
  pageUrl: z.string().url().optional(),
  sourceLocator: z.string().optional(),
  structuredValue: z.record(z.any()),
  contentHash: z.string(),
  observedAt: z.string(),
});
export type ReportEvidenceItem = z.infer<typeof ReportEvidenceItemSchema>;

/** Individual finding formatted for human readability in reports */
export const ReportFindingItemSchema = z.object({
  id: z.string().uuid(),
  checkId: z.string(),
  checkTitle: z.string(),
  module: z.string(),
  status: CheckStatusSchema,
  severity: SeveritySchema.nullable(),
  confidence: z.number().min(0).max(1),
  confidencePercent: z.number().min(0).max(100),
  reasonCode: z.string(),
  summary: z.string(),
  whyItMatters: z.string(),
  legalReferences: z.array(z.string()),
  evidenceList: z.array(ReportEvidenceItemSchema),
  remediation: z.custom<RemediationTemplate>().optional(),
  exposureDetails: z
    .object({
      statutoryMaxInr: z.number().optional(),
      plausibleDirectCostMinInr: z.number().optional(),
      plausibleDirectCostMaxInr: z.number().optional(),
      statutoryBasis: z.string().optional(),
    })
    .optional(),
  requiresHumanReview: z.boolean(),
  rank: z.number().int().positive().optional(),
});
export type ReportFindingItem = z.infer<typeof ReportFindingItemSchema>;

/** Check summary statistics */
export const ReportCheckSummarySchema = z.object({
  totalEvaluated: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  issueFound: z.number().int().nonnegative(),
  notApplicable: z.number().int().nonnegative(),
  unableToVerify: z.number().int().nonnegative(),
  unverifiedRatio: z.number().min(0).max(1),
  severityCounts: z.object({
    critical: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
    info: z.number().int().nonnegative(),
  }),
});
export type ReportCheckSummary = z.infer<typeof ReportCheckSummarySchema>;

/** Source-backed financial exposure summary */
export const ReportExposureSummarySchema = z.object({
  hasExposure: z.boolean(),
  statutoryMaxInr: z.number().nonnegative(),
  statutoryMaxFormattedInr: z.string(),
  minDirectCostInr: z.number().nonnegative(),
  maxDirectCostInr: z.number().nonnegative(),
  plausibleDirectCostRangeFormattedInr: z.string(),
  applicableRegimes: z.array(z.string()),
  explanation: z.string(),
});
export type ReportExposureSummary = z.infer<typeof ReportExposureSummarySchema>;

/** Jurisdiction applicability context notes */
export const ReportJurisdictionNotesSchema = z.object({
  confirmedJurisdictions: z.array(JurisdictionSchema),
  evaluatedRegimes: z.array(z.string()),
  applicabilityNote: z.string(),
  notApplicableChecksCount: z.number().int().nonnegative(),
});
export type ReportJurisdictionNotes = z.infer<typeof ReportJurisdictionNotesSchema>;

/** Report limitations and audit boundaries */
export const ReportLimitationsSchema = z.object({
  disclaimer: z.string(),
  clientSideBoundaryNote: z.string(),
  unverifiedItems: z.array(
    z.object({
      checkId: z.string(),
      title: z.string(),
      reason: z.string(),
    })
  ),
  manualVerificationRecommended: z.array(z.string()),
});
export type ReportLimitations = z.infer<typeof ReportLimitationsSchema>;

/** Presentation-specific template metadata */
export const TemplateMetadataSchema = z.object({
  presentationType: ReportPresentationTypeSchema,
  templateTitle: z.string(),
  templateSubtitle: z.string(),
  clientName: z.string().optional(),
  agencyName: z.string().optional(),
  auditorName: z.string().optional(),
  executiveDecision: z.string(),
  decisionRATIONALE: z.string(),
  targetAudience: z.string(),
});
export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;

/** Complete validated structured report data model */
export const StructuredReportSchema = z.object({
  reportId: z.string().uuid(),
  scanId: z.string().uuid(),
  generatedAt: z.string().datetime(),
  scannedAt: z.string().datetime(),
  scannerVersion: z.string(),
  rulesetVersion: z.string(),
  schemaVersion: z.string(),

  templateMetadata: TemplateMetadataSchema,
  websiteOverview: WebsiteOverviewSchema,
  score: z.number().min(0).max(100),
  scoreCategory: z.string(),
  checkSummary: ReportCheckSummarySchema,
  exposureSummary: ReportExposureSummarySchema,
  jurisdictionNotes: ReportJurisdictionNotesSchema,

  highestPriorityFindings: z.array(ReportFindingItemSchema),
  allFindings: z.array(ReportFindingItemSchema),
  findingsByModule: z.record(z.array(ReportFindingItemSchema)),

  limitations: ReportLimitationsSchema,
});
export type StructuredReport = z.infer<typeof StructuredReportSchema>;

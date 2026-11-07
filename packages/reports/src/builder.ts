/**
 * Report Data Builder
 *
 * Converts completed scan artifacts and rules engine evaluation results
 * into a strongly-typed, Zod-validated StructuredReport.
 *
 * Core invariant: Single underlying scan engine; presentation variants
 * (SaaS Founder vs Agency Handover) are strictly presentation layer adaptations.
 */

import { randomUUID } from "node:crypto";
import type {
  SiteSnapshot,
  EvidenceRecord,
  FindingRecord,
  Jurisdiction,
} from "@vibe/contracts";
import type { EvaluationResult } from "@vibe/rules";
import { CheckRegistry, WAVE_1_REGISTRY } from "@vibe/rules";
import { getRemediationTemplate } from "@vibe/fixes";

import {
  StructuredReportSchema,
  type StructuredReport,
  type ReportPresentationType,
  type ReportFindingItem,
  type ReportEvidenceItem,
  type WebsiteOverview,
  type ReportCheckSummary,
  type ReportExposureSummary,
  type ReportJurisdictionNotes,
  type ReportLimitations,
  type TemplateMetadata,
} from "./types";

export interface ReportBuilderOptions {
  presentationType?: ReportPresentationType;
  clientName?: string;
  agencyName?: string;
  auditorName?: string;
}

/** Formats currency in Indian numbering system (Lakh / Crore) */
export function formatInr(amount: number): string {
  if (amount >= 10000000) {
    const crores = amount / 10000000;
    return `₹${crores.toFixed(crores >= 10 ? 0 : 1)} Cr`;
  }
  if (amount >= 100000) {
    const lakhs = amount / 100000;
    return `₹${lakhs.toFixed(lakhs >= 10 ? 0 : 1)} Lakh`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** Business and legal impact rationale per check */
const WHY_IT_MATTERS_MAP: Record<string, string> = {
  A1: "Operating a website without a visible privacy policy violates statutory notice requirements (DPDP 2023 Sec 6, GDPR Art 13) and risks immediate ad platform (Google/Meta) account suspension.",
  A5: "When privacy policies do not accurately declare active trackers, the policy is legally defective under transparency mandates, exposing the company to regulatory audit.",
  A6: "Collecting personal data through contact or lead forms without unbundled consent checkboxes invalidates your lawful basis for processing under DPDP and GDPR.",
  A10: "Failing to offer an explicit opt-out mechanism for US/California visitors triggers mandatory cure period notices under CCPA § 1798.120.",
  B1: "Tracking users without an upfront consent banner breaches privacy regulations requiring affirmative user consent before cookies are written.",
  B2: "Firing tracking pixels before the user interacts with the consent banner constitutes unconsented tracking—the most commonly penalized violation by data protection authorities.",
  B3: "Hiding or visually minimizing the 'Reject' button violates dark pattern prohibitions under India's Consumer Protection Guidelines 2023 and EDPB standards.",
  B4: "When clicking 'Reject' fails to halt tracking scripts, user choices are effectively ignored, creating clear statutory non-compliance.",
  B5: "An incomplete cookie inventory misinforms users and fails statutory transparency obligations.",
  B6: "Invasive tracking mechanisms (fingerprinting, persistent identifiers) violate data minimization principles and trigger maximum statutory scrutiny.",
  B7: "Loading third-party resources before consent transfers visitor IP addresses to foreign servers without lawful basis.",
  C1: "Missing image alternative text prevents visually impaired users with screen readers from navigating your site, violating accessibility standards (WCAG 2.1 SC 1.1.1).",
  C2: "Low contrast text makes content unreadable for users with moderate visual impairments and degrades overall mobile readability in bright lighting.",
  C4: "Form fields without accessible labels break screen reader usability, leading to high form abandonment and accessibility non-compliance.",
  C5: "Skipped heading levels disorient assistive technology users who rely on heading structure for page navigation.",
  C6: "Without a declared page language, screen readers cannot select correct pronunciation engines and phonetics.",
  C7: "Icon buttons without accessible names are announced as unlabelled buttons by screen readers, rendering key actions inoperable.",
  C9: "Videos without captions exclude deaf or hard-of-hearing users and fail accessibility standards.",
  C10: "Touch targets smaller than 44×44 CSS px cause tap errors on mobile devices and reduce conversion rates.",
  D1: "CRITICAL: Exposed API keys or secrets in client JavaScript allow malicious actors to compromise backend infrastructure, steal data, or run up catastrophic cloud bills.",
  D5: "Failing to enforce HTTPS enables man-in-the-middle attacks, triggers browser 'Not Secure' warnings, and prevents modern web APIs from functioning.",
  D6: "Missing HTTP security headers leaves the site vulnerable to clickjacking, MIME-type sniffing, and cross-site scripting (XSS) attacks.",
  D7: "Insecure cookie flags allow session tokens to be intercepted over plain HTTP or stolen by malicious third-party scripts via document.cookie.",
  D9: "Publicly accessible source maps expose proprietary frontend logic, internal variable names, and application architecture to competitors and attackers.",
  D12: "Internal staging URLs or developer debug logs in production bundles reveal sensitive internal infrastructure details.",
  E1: "A website without terms of service lacks limitation of liability, leaving the business exposed to unrestricted contractual disputes.",
  E2: "E-commerce sites are legally mandated to publish transparent refund, return, and cancellation policies under consumer protection regulations.",
  E4: "Failing to provide business contact information and a designated Grievance Officer violates e-commerce and DPDP statutory mandates.",
  E5: "Leaving template placeholders (e.g. '[Insert Company Name]') on legal pages undermines legal enforceability and damages brand credibility.",
  F7: "Insecure or uncertified payment integration compromises customer trust and risks payment gateway account suspension.",
  G6: "Unlicensed web fonts or icons risk copyright infringement claims and commercial settlement demands from type foundries.",
  G9: "Uncredited media assets risk copyright takedown notices under intellectual property laws.",
  H1: "Broken navigation links frustrate users, damage search engine crawlability, and reflect poor launch quality.",
  H3: "Missing essential pages (Home, About, Contact) undermines business credibility and customer trust.",
  H4: "Lack of responsive viewport configuration causes degraded rendering on mobile devices, harming user experience and SEO rankings.",
  H5: "Broken images and stylesheets produce visual defects and increase bounce rates.",
  H7: "Non-functional key navigation interactions block critical user conversion funnels.",
  I1: "Undocumented third-party scripts introduce supply chain risk and performance degradation.",
  I2: "Sensitive form data leaking to third-party analytics scripts triggers severe regulatory penalties under personal data protection laws.",
  I3: "Loading third-party CDN scripts without Subresource Integrity (SRI) leaves your site vulnerable if the CDN is compromised.",
};

export class ReportDataBuilder {
  private registry: CheckRegistry;

  constructor(registry?: CheckRegistry) {
    if (registry) {
      this.registry = registry;
    } else {
      this.registry = new CheckRegistry();
      this.registry.registerAll(WAVE_1_REGISTRY);
    }
  }

  public build(
    snapshot: SiteSnapshot,
    evaluation: EvaluationResult,
    evidenceRecords: EvidenceRecord[],
    options: ReportBuilderOptions = {}
  ): StructuredReport {
    const presentationType = options.presentationType ?? "founder_launch";
    const evidenceMap = new Map(evidenceRecords.map((e) => [e.id, e]));

    // 1. Build Website Overview
    const websiteOverview = this.buildWebsiteOverview(snapshot);

    // 2. Score category description
    const scoreCategory = this.getScoreCategory(evaluation.score);

    // 3. Build Check Summary
    const checkSummary: ReportCheckSummary = {
      totalEvaluated: evaluation.metadata.checksEvaluated,
      passed: evaluation.statusCounts.passed,
      issueFound: evaluation.statusCounts.issue_found,
      notApplicable: evaluation.statusCounts.not_applicable,
      unableToVerify: evaluation.statusCounts.unable_to_verify,
      unverifiedRatio: evaluation.scoreBreakdown.unverifiedRatio,
      severityCounts: evaluation.severityCounts,
    };

    // 4. Build Financial Exposure Summary
    const exposureSummary = this.buildExposureSummary(evaluation);

    // 5. Build Jurisdiction Notes
    const jurisdictionNotes = this.buildJurisdictionNotes(snapshot, evaluation);

    // 6. Build Detailed Findings with Evidence & Fixes
    const allFindings = this.buildFindingItems(evaluation.findings, evidenceMap);
    const highestPriorityFindings = this.buildFindingItems(evaluation.topFindings, evidenceMap);

    // Group findings by module
    const findingsByModule: Record<string, ReportFindingItem[]> = {};
    for (const finding of allFindings) {
      if (!findingsByModule[finding.module]) {
        findingsByModule[finding.module] = [];
      }
      findingsByModule[finding.module]!.push(finding);
    }

    // 7. Build Limitations & Manual Verification Checklist
    const limitations = this.buildLimitations(evaluation, snapshot);

    // 8. Build Presentation-Specific Template Metadata
    const templateMetadata = this.buildTemplateMetadata(
      presentationType,
      evaluation.score,
      options
    );

    const report: StructuredReport = {
      reportId: randomUUID(),
      scanId: evaluation.scanId,
      generatedAt: new Date().toISOString(),
      scannedAt: snapshot.capturedAt,
      scannerVersion: evaluation.metadata.scannerVersion,
      rulesetVersion: evaluation.metadata.rulesetVersion,
      schemaVersion: snapshot.schemaVersion,

      templateMetadata,
      websiteOverview,
      score: evaluation.score,
      scoreCategory,
      checkSummary,
      exposureSummary,
      jurisdictionNotes,

      highestPriorityFindings,
      allFindings,
      findingsByModule,

      limitations,
    };

    // Validate structured report with Zod before returning
    return StructuredReportSchema.parse(report);
  }

  private buildWebsiteOverview(snapshot: SiteSnapshot): WebsiteOverview {
    const hasEcommerce = snapshot.pages.some(
      (p) => p.hasPaymentForm || p.pageType === "checkout" || p.pageType === "pricing"
    );
    const collectsPersonalData = snapshot.pages.some(
      (p) => p.hasLoginForm || p.hasContactForm || p.pageType === "login" || p.pageType === "signup"
    );

    const detectedTech: string[] = [];
    if (snapshot.dns.isCloudflareOrCdn) detectedTech.push("CDN / Cloudflare");
    if (snapshot.assets.some((a) => a.url.includes("_next"))) detectedTech.push("Next.js");
    if (snapshot.assets.some((a) => a.url.includes("tailwind"))) detectedTech.push("Tailwind CSS");

    return {
      targetUrl: snapshot.canonicalOrigin,
      canonicalOrigin: snapshot.canonicalOrigin,
      targetHost: snapshot.targetHost,
      pagesCrawledCount: snapshot.pages.length,
      samplePages: snapshot.pages.slice(0, 5).map((p) => p.url),
      detectedTechnologies: detectedTech,
      tlsSummary: {
        protocol: snapshot.tls.protocol,
        issuer: snapshot.tls.issuer,
        enforcesHttps: snapshot.tls.enforcesHttps,
        daysRemaining: snapshot.tls.daysRemaining,
        valid: snapshot.tls.valid,
      },
      hasEcommerce,
      collectsPersonalData,
    };
  }

  private getScoreCategory(score: number): string {
    if (score >= 90) return "Launch Ready with Minor Optimisations";
    if (score >= 75) return "Launch Ready with Recommended Fixes";
    if (score >= 50) return "Remediation Recommended Before Launch";
    return "Critical Remediation Required Prior to Launch";
  }

  private buildExposureSummary(evaluation: EvaluationResult): ReportExposureSummary {
    const exp = evaluation.exposureSummary;
    if (!exp.hasExposure) {
      return {
        hasExposure: false,
        statutoryMaxInr: 0,
        statutoryMaxFormattedInr: "₹0",
        minDirectCostInr: 0,
        maxDirectCostInr: 0,
        plausibleDirectCostRangeFormattedInr: "₹0",
        applicableRegimes: [],
        explanation: "No statutory exposure models triggered based on confirmed findings and jurisdictions.",
      };
    }

    return {
      hasExposure: true,
      statutoryMaxInr: exp.statutoryMaxInr,
      statutoryMaxFormattedInr: formatInr(exp.statutoryMaxInr),
      minDirectCostInr: exp.minDirectCostInr,
      maxDirectCostInr: exp.maxDirectCostInr,
      plausibleDirectCostRangeFormattedInr: `${formatInr(exp.minDirectCostInr)} – ${formatInr(exp.maxDirectCostInr)}`,
      applicableRegimes: exp.applicableRegimes,
      explanation:
        "Statutory caps reflect maximum legislative ceilings under confirmed statutory regimes (non-additive). Plausible direct cost ranges represent estimated legal defense, audit response, and regulatory inquiry remediation expenses.",
    };
  }

  private buildJurisdictionNotes(
    _snapshot: SiteSnapshot,
    evaluation: EvaluationResult
  ): ReportJurisdictionNotes {
    // Invariant: Customer-confirmed jurisdictions only.
    // Never infer legal applicability solely from IP address or server location.
    const confirmed = ["india"] as Jurisdiction[]; // Default primary jurisdiction
    const evaluatedRegimes: string[] = [];

    evaluatedRegimes.push("Digital Personal Data Protection Act 2023 (India)");
    evaluatedRegimes.push("Consumer Protection Act 2019 & Dark Patterns Guidelines (India)");
    evaluatedRegimes.push("Information Technology Act 2000 (India)");

    return {
      confirmedJurisdictions: confirmed,
      evaluatedRegimes,
      applicabilityNote:
        "Legal checks were evaluated exclusively against confirmed target jurisdictions. In accordance with architectural safety invariants, legal applicability is never inferred from server IP hosting location or DNS CDN routing.",
      notApplicableChecksCount: evaluation.statusCounts.not_applicable,
    };
  }

  private buildFindingItems(
    findings: FindingRecord[],
    evidenceMap: Map<string, EvidenceRecord>
  ): ReportFindingItem[] {
    return findings.map((f, index) => {
      const entry = this.registry.get(f.checkId);
      const module = entry?.module ?? "general";
      const checkTitle = entry?.title ?? f.title;
      const legalReferences = entry?.legalReferences ?? [];

      const whyItMatters =
        WHY_IT_MATTERS_MAP[f.checkId] ??
        `Compliance with ${checkTitle} is essential for web security, accessibility, and user data privacy standards.`;

      // Resolve supporting evidence items
      const evidenceList: ReportEvidenceItem[] = f.evidenceIds
        .map((eid) => evidenceMap.get(eid))
        .filter((e): e is EvidenceRecord => e !== undefined)
        .map((e) => ({
          id: e.id,
          evidenceType: e.evidenceType,
          pageUrl: e.pageUrl,
          sourceLocator: e.sourceLocator,
          structuredValue: e.structuredValue,
          contentHash: e.contentHash,
          observedAt: e.observedAt,
        }));

      // Resolve remediation template
      const remediation = getRemediationTemplate(
        f.remediation ?? entry?.remediationTemplateId
      );

      return {
        id: f.id,
        checkId: f.checkId,
        checkTitle,
        module,
        status: f.status,
        severity: f.severity ?? null,
        confidence: f.confidence,
        confidencePercent: Math.round(f.confidence * 100),
        reasonCode: f.reasonCode,
        summary: f.summary,
        whyItMatters,
        legalReferences,
        evidenceList,
        remediation,
        exposureDetails: f.exposureDetails,
        requiresHumanReview: f.requiresHumanReview,
        rank: index + 1,
      };
    });
  }

  private buildLimitations(
    evaluation: EvaluationResult,
    snapshot: SiteSnapshot
  ): ReportLimitations {
    const unverifiedItems = evaluation.findings
      .filter((f) => f.status === "unable_to_verify")
      .map((f) => ({
        checkId: f.checkId,
        title: f.title,
        reason: f.summary,
      }));

    const manualChecks: string[] = [
      "Physical and organizational security policies (SOC 2, ISO 27001).",
      "Internal database encryption at rest and backend credential isolation.",
      "Vendor Data Processing Agreements (DPAs) with third-party service providers.",
      "Offline consumer grievance redressal processes.",
    ];

    if (snapshot.collectionWarnings.length > 0) {
      manualChecks.push(...snapshot.collectionWarnings);
    }

    return {
      disclaimer:
        "IMPORTANT LEGAL DISCLAIMER: This report is an automated pre-launch technical risk assessment. It does NOT constitute legal advice, a formal compliance certification, an accreditation of legal safety, or a guarantee of 100% regulatory immunity. Regulatory enforcement authorities have discretionary power beyond automated scan boundaries.",
      clientSideBoundaryNote:
        "Automated passive scanning inspects client-side observable network traffic, HTML DOM, public HTTP responses, and TLS configurations. Internal backend database operations, employee data handling, and private server architectures require independent manual review.",
      unverifiedItems,
      manualVerificationRecommended: manualChecks,
    };
  }

  private buildTemplateMetadata(
    presentationType: ReportPresentationType,
    score: number,
    options: ReportBuilderOptions
  ): TemplateMetadata {
    if (presentationType === "agency_handover") {
      const isApprovedForHandover = score >= 75;
      return {
        presentationType: "agency_handover",
        templateTitle: "Agency Client Handover & Compliance QA Sign-Off",
        templateSubtitle:
          "Independent pre-delivery audit documenting technical compliance, quality signals, and client operational requirements.",
        clientName: options.clientName ?? "Client Representative",
        agencyName: options.agencyName ?? "Digital Agency Development Team",
        auditorName: options.auditorName ?? "Automated Compliance QA Engine",
        executiveDecision: isApprovedForHandover
          ? "APPROVED FOR CLIENT HANDOVER"
          : "HANDOVER PENDING CRITICAL REMEDIATION",
        decisionRATIONALE: isApprovedForHandover
          ? "Website meets baseline agency quality and regulatory compliance standards for deployment. Remaining items require client-supplied legal policies or minor non-blocking fixes."
          : "Identified high/critical findings must be remediated by the development team before final client sign-off and production release.",
        targetAudience: "Agency Project Managers, Web Developers, and Client Stakeholders",
      };
    }

    // Default: SaaS Founder Launch Report
    const canLaunch = score >= 80;
    return {
      presentationType: "founder_launch",
      templateTitle: "SaaS Founder Pre-Launch Risk & Readiness Assessment",
      templateSubtitle:
        "Executive triage report highlighting launch blockers, customer trust signals, and direct developer action items.",
      clientName: options.clientName,
      executiveDecision: canLaunch ? "READY FOR LAUNCH" : "CONDITIONAL LAUNCH (FIX BLOCKERS)",
      decisionRATIONALE: canLaunch
        ? "No critical blockers detected. Complete recommended minor fixes to maximize customer trust and conversion."
        : "Critical or high-severity issues observed that could impact launch day traffic, trigger payment processor friction, or attract regulatory scrutiny.",
      targetAudience: "Technical Founders, CTOs, and Product Lead Engineers",
    };
  }
}

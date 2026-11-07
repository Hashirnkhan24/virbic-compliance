/**
 * HTML Report Renderer
 *
 * Renders a Zod-validated StructuredReport into self-contained, responsive,
 * and print-ready HTML suitable for browser viewing and Chromium print-to-PDF.
 *
 * Features:
 * - Two distinct presentation modes: SaaS Founder Launch vs Agency Handover.
 * - Same underlying scan data and mathematical scoring.
 * - Embedded CSS with print stylesheets (@media print).
 * - Strict legal disclaimers and non-additive financial exposure presentation.
 */

import type {
  StructuredReport,
  ReportFindingItem,
  ReportEvidenceItem,
} from "../types";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderReportToHtml(report: StructuredReport): string {
  const isAgency = report.templateMetadata.presentationType === "agency_handover";
  const title = escapeHtml(report.templateMetadata.templateTitle);
  const subtitle = escapeHtml(report.templateMetadata.templateSubtitle);
  const host = escapeHtml(report.websiteOverview.targetHost);
  const targetUrl = escapeHtml(report.websiteOverview.targetUrl);
  const formattedDate = new Date(report.scannedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const scoreColor =
    report.score >= 80
      ? "#16a34a"
      : report.score >= 60
      ? "#d97706"
      : "#dc2626";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — ${host}</title>
  <style>
    /* ─── BASE RESET & TYPOGRAPHY ────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background-color: #f8fafc;
      line-height: 1.5;
      padding: 32px 16px;
    }
    .report-container {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    }

    /* ─── HEADER & HERO ──────────────────────────────────────── */
    header {
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 28px;
      margin-bottom: 32px;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 12px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .brand-subtitle {
      font-size: 14px;
      color: #64748b;
      margin-top: 4px;
    }
    .report-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: #e2e8f0;
      color: #334155;
    }
    .scan-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 13px;
      color: #475569;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px dashed #e2e8f0;
    }
    .scan-meta span strong { color: #0f172a; }

    /* ─── HERO SCORE CARD ────────────────────────────────────── */
    .hero-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 24px;
      margin-bottom: 32px;
    }
    .score-circle {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 110px;
      height: 110px;
      border-radius: 50%;
      border: 6px solid ${scoreColor};
      background: #ffffff;
      flex-shrink: 0;
    }
    .score-val {
      font-size: 38px;
      font-weight: 800;
      color: ${scoreColor};
      line-height: 1;
    }
    .score-max {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
      margin-top: 2px;
    }
    .hero-decision {
      flex: 1;
    }
    .decision-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
    }
    .decision-headline {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 4px 0;
    }
    .decision-rationale {
      font-size: 14px;
      color: #475569;
    }

    /* ─── SUMMARY STATS GRID ─────────────────────────────────── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 32px;
    }
    .stat-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
      text-align: center;
      background: #ffffff;
    }
    .stat-box.passed { border-left: 4px solid #16a34a; }
    .stat-box.issues { border-left: 4px solid #dc2626; }
    .stat-box.na { border-left: 4px solid #94a3b8; }
    .stat-box.unverified { border-left: 4px solid #7c3aed; }
    .stat-num {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
    }
    .stat-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
      text-transform: uppercase;
      margin-top: 2px;
    }

    /* ─── SECTION STYLING ────────────────────────────────────── */
    .section-block {
      margin-bottom: 36px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* ─── PRESENTATION-SPECIFIC CALLOUTS ─────────────────────── */
    .callout-box {
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 24px;
      font-size: 14px;
    }
    .callout-box.founder {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
    }
    .callout-box.agency {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
    }
    .callout-box h4 {
      font-weight: 700;
      margin-bottom: 4px;
    }

    /* ─── EXPOSURE CARD ──────────────────────────────────────── */
    .exposure-card {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 28px;
    }
    .exposure-header {
      font-size: 14px;
      font-weight: 700;
      color: #92400e;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }
    .exposure-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 14px;
      border-bottom: 1px dashed #fef3c7;
    }
    .exposure-row:last-child { border-bottom: none; }
    .exposure-row strong { color: #78350f; }

    /* ─── FINDINGS CARDS ─────────────────────────────────────── */
    .finding-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 16px;
      background: #ffffff;
      break-inside: avoid;
    }
    .finding-card.critical { border-left: 5px solid #dc2626; }
    .finding-card.high { border-left: 5px solid #ea580c; }
    .finding-card.medium { border-left: 5px solid #d97706; }
    .finding-card.low { border-left: 5px solid #2563eb; }
    .finding-card.info { border-left: 5px solid #64748b; }
    .finding-card.passed { border-left: 5px solid #16a34a; }
    .finding-card.unable_to_verify { border-left: 5px solid #7c3aed; }
    .finding-card.not_applicable { border-left: 5px solid #94a3b8; }

    .finding-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 8px;
    }
    .finding-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .check-id-badge {
      font-family: monospace;
      font-size: 12px;
      font-weight: 700;
      background: #e2e8f0;
      color: #334155;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .finding-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-critical { background: #fee2e2; color: #991b1b; }
    .badge-high { background: #ffedd5; color: #9a3412; }
    .badge-medium { background: #fef3c7; color: #92400e; }
    .badge-low { background: #dbeafe; color: #1e40af; }
    .badge-info { background: #f1f5f9; color: #475569; }
    .badge-passed { background: #dcfce7; color: #166534; }
    .badge-unable { background: #f3e8ff; color: #6b21a8; }
    .badge-na { background: #f1f5f9; color: #64748b; }

    .finding-summary {
      font-size: 14px;
      color: #334155;
      margin-bottom: 12px;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      font-size: 13px;
      background: #f8fafc;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .detail-item strong {
      color: #0f172a;
      display: block;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 2px;
    }

    /* ─── CODE SNIPPET ───────────────────────────────────────── */
    .code-snippet {
      background: #0f172a;
      color: #f8fafc;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      border-radius: 6px;
      padding: 12px;
      overflow-x: auto;
      margin-top: 6px;
      white-space: pre-wrap;
    }

    /* ─── EVIDENCE ACCORDION ─────────────────────────────────── */
    .evidence-block {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 12px;
      background: #ffffff;
      margin-top: 8px;
    }
    .evidence-header {
      font-weight: 600;
      color: #475569;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
    }
    .evidence-hash {
      font-family: monospace;
      font-size: 10px;
      color: #94a3b8;
    }

    /* ─── SIGN-OFF BLOCK (AGENCY TEMPLATE) ───────────────────── */
    .signoff-box {
      border: 2px solid #cbd5e1;
      border-radius: 8px;
      padding: 24px;
      margin-top: 32px;
      background: #ffffff;
      break-inside: avoid;
    }
    .signoff-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-top: 24px;
    }
    .signoff-line {
      border-bottom: 1px solid #0f172a;
      margin-top: 40px;
      margin-bottom: 8px;
    }
    .signoff-meta {
      font-size: 12px;
      color: #64748b;
    }

    /* ─── LEGAL DISCLAIMER FOOTER ────────────────────────────── */
    footer {
      border-top: 2px solid #f1f5f9;
      padding-top: 24px;
      margin-top: 40px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }
    .disclaimer-title {
      font-weight: 700;
      color: #475569;
      margin-bottom: 4px;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.05em;
    }

    /* ─── PRINT MEDIA OPTIMIZATIONS ──────────────────────────── */
    @media print {
      @page {
        size: A4;
        margin: 20mm 15mm 20mm 15mm;
      }
      body {
        background: #ffffff;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .report-container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .page-break {
        page-break-before: always;
        break-before: page;
      }
      .finding-card {
        page-break-inside: avoid;
        break-inside: avoid;
        margin-bottom: 20px;
      }
      .hero-card, .stats-grid, .signoff-box, .exposure-card, .detail-grid {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .code-snippet {
        white-space: pre-wrap;
        word-break: break-all;
        overflow-wrap: anywhere;
        max-width: 100%;
      }
      .evidence-hash, .finding-summary, .detail-item span {
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      p, li {
        orphans: 3;
        widows: 3;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- HEADER -->
    <header>
      <div class="header-top">
        <div>
          <h1 class="brand-title">${title}</h1>
          <p class="brand-subtitle">${subtitle}</p>
        </div>
        <div>
          <span class="report-badge">${isAgency ? "Handover Audit" : "Founder Triage"}</span>
        </div>
      </div>
      <div class="scan-meta">
        <span>Target: <strong>${targetUrl}</strong></span>
        <span>Scan Date: <strong>${formattedDate}</strong></span>
        <span>Scanner Version: <strong>${escapeHtml(report.scannerVersion)}</strong></span>
        <span>Ruleset: <strong>v${escapeHtml(report.rulesetVersion)}</strong></span>
      </div>
    </header>

    <!-- HERO SCORE CARD -->
    <div class="hero-card">
      <div class="score-circle">
        <span class="score-val">${report.score}</span>
        <span class="score-max">/ 100</span>
      </div>
      <div class="hero-decision">
        <div class="decision-label">${isAgency ? "Handover Approval Status" : "Launch Readiness Status"}</div>
        <div class="decision-headline">${escapeHtml(report.templateMetadata.executiveDecision)}</div>
        <div class="decision-rationale">${escapeHtml(report.templateMetadata.decisionRATIONALE)}</div>
      </div>
    </div>

    <!-- PRESENTATION-SPECIFIC CALLOUT -->
    ${
      isAgency
        ? `<div class="callout-box agency">
            <h4>Agency Quality &amp; Handover Notice</h4>
            <p>This report documents verified compliance deliverables for <strong>${escapeHtml(
              report.templateMetadata.clientName ?? "the client"
            )}</strong> prepared by <strong>${escapeHtml(
            report.templateMetadata.agencyName ?? "the agency"
          )}</strong>. Items marked as requiring client action (such as legal entity registration, privacy policy DPO designation, or third-party merchant accounts) must be finalized by the client.</p>
          </div>`
        : `<div class="callout-box founder">
            <h4>Founder Launch Triage Action Plan</h4>
            <p>Prioritize resolving the <strong>Critical &amp; High severity</strong> issues below prior to public announcement. Medium and Low severity items can be resolved during the post-launch stabilization sprint.</p>
          </div>`
    }

    <!-- STATS SUMMARY GRID -->
    <div class="stats-grid">
      <div class="stat-box passed">
        <div class="stat-num">${report.checkSummary.passed}</div>
        <div class="stat-label">Passed Checks</div>
      </div>
      <div class="stat-box issues">
        <div class="stat-num">${report.checkSummary.issueFound}</div>
        <div class="stat-label">Issues Found</div>
      </div>
      <div class="stat-box na">
        <div class="stat-num">${report.checkSummary.notApplicable}</div>
        <div class="stat-label">Not Applicable</div>
      </div>
      <div class="stat-box unverified">
        <div class="stat-num">${report.checkSummary.unableToVerify}</div>
        <div class="stat-label">Unable to Verify</div>
      </div>
    </div>

    <!-- WEBSITE OVERVIEW -->
    <div class="section-block">
      <h3 class="section-title">Website Overview &amp; Scope</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <strong>Inspected Pages</strong>
          <span>${report.websiteOverview.pagesCrawledCount} pages crawled (${report.websiteOverview.samplePages.map(escapeHtml).join(", ")})</span>
        </div>
        <div class="detail-item">
          <strong>Security & TLS Health</strong>
          <span>${
            report.websiteOverview.tlsSummary.valid
              ? `Valid TLS certificate (${escapeHtml(
                  report.websiteOverview.tlsSummary.protocol ?? "TLSv1.3"
                )}) issued by ${escapeHtml(
                  report.websiteOverview.tlsSummary.issuer ?? "Trusted CA"
                )} with ${
                  report.websiteOverview.tlsSummary.daysRemaining ?? "adequate"
                } days remaining. HTTPS enforced: ${
                  report.websiteOverview.tlsSummary.enforcesHttps ? "Yes" : "No"
                }.`
              : "Invalid or expired TLS configuration detected."
          }</span>
        </div>
        <div class="detail-item">
          <strong>Site Functionality Signals</strong>
          <span>E-Commerce / Payment flows: ${
            report.websiteOverview.hasEcommerce ? "Detected" : "None detected"
          } | Personal data collection forms: ${
            report.websiteOverview.collectsPersonalData ? "Detected" : "None detected"
          }</span>
        </div>
      </div>
    </div>

    <!-- FINANCIAL EXPOSURE SUMMARY (SOURCE-BACKED ONLY) -->
    ${
      report.exposureSummary.hasExposure
        ? `<div class="exposure-card">
            <div class="exposure-header">Source-Backed Regulatory Exposure Overview</div>
            <div class="exposure-row">
              <span>Maximum Legislative Statutory Ceiling (Non-Additive):</span>
              <strong>${escapeHtml(report.exposureSummary.statutoryMaxFormattedInr)}</strong>
            </div>
            <div class="exposure-row">
              <span>Plausible Regulatory Direct Inquiry / Defense Cost:</span>
              <strong>${escapeHtml(report.exposureSummary.plausibleDirectCostRangeFormattedInr)}</strong>
            </div>
            <div class="exposure-row">
              <span>Triggered Legislative Regimes:</span>
              <span>${escapeHtml(report.exposureSummary.applicableRegimes.join(", "))}</span>
            </div>
            <p style="font-size: 12px; color: #78350f; margin-top: 10px;">
              ${escapeHtml(report.exposureSummary.explanation)}
            </p>
          </div>`
        : ""
    }

    <!-- JURISDICTION & APPLICABILITY NOTES -->
    <div class="section-block">
      <h3 class="section-title">Jurisdiction &amp; Applicability</h3>
      <p style="font-size: 14px; color: #475569; margin-bottom: 8px;">
        ${escapeHtml(report.jurisdictionNotes.applicabilityNote)}
      </p>
      <div style="font-size: 13px; color: #64748b;">
        Confirmed operational jurisdiction(s): <strong>${escapeHtml(
          report.jurisdictionNotes.confirmedJurisdictions.join(", ").toUpperCase()
        )}</strong> | Excluded jurisdiction-specific checks: <strong>${
    report.jurisdictionNotes.notApplicableChecksCount
  }</strong>.
      </div>
    </div>

    <!-- HIGHEST PRIORITY FINDINGS (TRIAGE) -->
    <div class="section-block">
      <h3 class="section-title">Highest-Priority Findings &amp; Action Items</h3>
      ${
        report.highestPriorityFindings.length === 0
          ? `<p style="font-size: 14px; color: #16a34a; font-weight: 600;">No critical or high-priority findings detected.</p>`
          : report.highestPriorityFindings.map((f: ReportFindingItem) => renderFindingCard(f, isAgency)).join("\n")
      }
    </div>

    <!-- ALL DETAILED FINDINGS GROUPED BY MODULE -->
    <div class="section-block page-break">
      <h3 class="section-title">Comprehensive Audit Findings by Module</h3>
      ${(Object.entries(report.findingsByModule) as [string, ReportFindingItem[]][])
        .map(([moduleName, moduleFindings]) => `
          <div style="margin-bottom: 24px;">
            <h4 style="font-size: 15px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;">
              Module: ${escapeHtml(moduleName)} (${moduleFindings.length} checks)
            </h4>
            ${moduleFindings.map((f: ReportFindingItem) => renderFindingCard(f, isAgency)).join("\n")}
          </div>
        `)
        .join("\n")}
    </div>

    <!-- LIMITATIONS & MANUAL VERIFICATION ITEMS -->
    <div class="section-block">
      <h3 class="section-title">Audit Scope Boundaries &amp; Manual Verification Items</h3>
      <p style="font-size: 13px; color: #475569; margin-bottom: 12px;">
        ${escapeHtml(report.limitations.clientSideBoundaryNote)}
      </p>
      ${
        report.limitations.unverifiedItems.length > 0
          ? `<div style="margin-bottom: 14px;">
              <strong style="font-size: 13px; color: #0f172a;">Checks Requiring Manual Verification (${report.limitations.unverifiedItems.length}):</strong>
              <ul style="font-size: 13px; color: #475569; padding-left: 20px; margin-top: 6px;">
                ${report.limitations.unverifiedItems
                  .map((item: { checkId: string; title: string; reason: string }) => `<li><strong>[${escapeHtml(item.checkId)}] ${escapeHtml(item.title)}:</strong> ${escapeHtml(item.reason)}</li>`)
                  .join("")}
              </ul>
            </div>`
          : ""
      }
      <div style="margin-bottom: 14px;">
        <strong style="font-size: 13px; color: #0f172a;">Recommended Manual Policies & Governance Inspections:</strong>
        <ul style="font-size: 13px; color: #475569; padding-left: 20px; margin-top: 6px;">
          ${report.limitations.manualVerificationRecommended
            .map((rec: string) => `<li>${escapeHtml(rec)}</li>`)
            .join("")}
        </ul>
      </div>
    </div>

    <!-- AGENCY HANDOVER SIGN-OFF BLOCK -->
    ${
      isAgency
        ? `<div class="signoff-box">
            <h3 style="font-size: 16px; font-weight: 700; color: #0f172a;">Handover Acceptance &amp; Compliance Sign-Off</h3>
            <p style="font-size: 13px; color: #64748b; margin-top: 4px;">
              By signing below, the parties acknowledge review of this technical compliance audit report.
            </p>
            <div class="signoff-grid">
              <div>
                <strong style="font-size: 14px; color: #0f172a;">Agency Delivery Representative</strong>
                <div class="signoff-line"></div>
                <div class="signoff-meta">Name: ${escapeHtml(report.templateMetadata.agencyName ?? "Agency Lead")}</div>
                <div class="signoff-meta">Date: ${formattedDate}</div>
              </div>
              <div>
                <strong style="font-size: 14px; color: #0f172a;">Client Acceptance Representative</strong>
                <div class="signoff-line"></div>
                <div class="signoff-meta">Name: ${escapeHtml(report.templateMetadata.clientName ?? "Client Lead")}</div>
                <div class="signoff-meta">Date: ________________________</div>
              </div>
            </div>
          </div>`
        : ""
    }

    <!-- FOOTER LEGAL DISCLAIMER -->
    <footer>
      <div class="disclaimer-title">Legal Disclaimer &amp; Compliance Scope</div>
      <p>${escapeHtml(report.limitations.disclaimer)}</p>
      <p style="margin-top: 8px;">
        Generated by Vibe Compliance Engine on ${formattedDate}. Scanner version: ${escapeHtml(
    report.scannerVersion
  )}. Ruleset: ${escapeHtml(report.rulesetVersion)}.
      </p>
    </footer>
  </div>
</body>
</html>`;
}

function renderFindingCard(finding: ReportFindingItem, isAgency: boolean): string {
  const sev = finding.severity ?? "info";
  const statusBadge = renderStatusBadge(finding.status, finding.severity);
  const title = escapeHtml(finding.checkTitle);
  const summary = escapeHtml(finding.summary);
  const whyItMatters = escapeHtml(finding.whyItMatters);

  return `
  <div class="finding-card ${finding.status === "issue_found" ? sev : finding.status}">
    <div class="finding-header">
      <div class="finding-title-wrap">
        <span class="check-id-badge">${escapeHtml(finding.checkId)}</span>
        <span class="finding-title">${title}</span>
        ${statusBadge}
        ${
          finding.requiresHumanReview
            ? `<span class="badge" style="background: #fef08a; color: #854d0e;">Review Recommended</span>`
            : ""
        }
      </div>
      <div style="font-size: 12px; color: #64748b; font-weight: 600;">
        ${finding.confidencePercent}% Confidence
      </div>
    </div>

    <div class="finding-summary">${summary}</div>

    <div class="detail-grid">
      <div class="detail-item">
        <strong>Why This Matters</strong>
        <span>${whyItMatters}</span>
      </div>

      ${
        finding.legalReferences.length > 0
          ? `<div class="detail-item">
              <strong>Framework / Statutory References</strong>
              <span>${escapeHtml(finding.legalReferences.join(" | "))}</span>
            </div>`
          : ""
      }

      ${
        finding.remediation
          ? `<div class="detail-item">
              <strong>Recommended Remediation (${escapeHtml(finding.remediation.timeToFixEstimate)}${
              isAgency && finding.remediation.clientActionRequired
                ? " — Client Action Required"
                : ""
            })</strong>
              <span>${escapeHtml(finding.remediation.summary)}</span>
              <ul style="padding-left: 18px; margin-top: 4px;">
                ${finding.remediation.steps.map((s: string) => `<li>${escapeHtml(s)}</li>`).join("")}
              </ul>
              ${
                finding.remediation.codeSnippet
                  ? `<div class="code-snippet">${escapeHtml(finding.remediation.codeSnippet)}</div>`
                  : ""
              }
            </div>`
          : ""
      }
    </div>

    <!-- EVIDENCE LIST -->
    ${
      finding.evidenceList.length > 0
        ? `<div class="evidence-block">
            <div class="evidence-header">
              <span>Supporting Evidence (${finding.evidenceList.length} record(s))</span>
              <span>Observed: ${escapeHtml(finding.evidenceList[0]?.observedAt ?? "")}</span>
            </div>
            ${finding.evidenceList
              .map(
                (e: ReportEvidenceItem) => `
              <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dotted #e2e8f0;">
                <div><strong>Type:</strong> ${escapeHtml(e.evidenceType)} ${
                  e.sourceLocator ? `| <strong>Locator:</strong> ${escapeHtml(e.sourceLocator)}` : ""
                } ${e.pageUrl ? `| <strong>Page:</strong> ${escapeHtml(e.pageUrl)}` : ""}</div>
                <div class="evidence-hash">SHA-256: ${escapeHtml(e.contentHash)}</div>
              </div>
            `
              )
              .join("")}
          </div>`
        : ""
    }
  </div>`;
}

function renderStatusBadge(status: string, severity: string | null): string {
  switch (status) {
    case "passed":
      return `<span class="badge badge-passed">Passed</span>`;
    case "issue_found": {
      const sevClass = `badge-${severity ?? "medium"}`;
      return `<span class="badge ${sevClass}">${escapeHtml(
        severity ? `${severity} Risk` : "Issue Found"
      )}</span>`;
    }
    case "not_applicable":
      return `<span class="badge badge-na">Not Applicable</span>`;
    case "unable_to_verify":
      return `<span class="badge badge-unable">Unable to Verify</span>`;
    default:
      return `<span class="badge badge-info">${escapeHtml(status)}</span>`;
  }
}

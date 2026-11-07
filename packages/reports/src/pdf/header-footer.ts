/**
 * Chromium PDF Header and Footer Templates
 *
 * Implements standard running headers and footers for Chromium print-to-PDF.
 * Uses Chromium special classes:
 * - <span class="pageNumber"></span>
 * - <span class="totalPages"></span>
 */

import type { StructuredReport } from "../types";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildChromiumHeaderTemplate(report: StructuredReport): string {
  const host = escapeHtml(report.websiteOverview.targetHost);
  const title = escapeHtml(report.templateMetadata.templateTitle);
  const scannerVer = escapeHtml(report.scannerVersion);
  const rulesetVer = escapeHtml(report.rulesetVersion);

  return `
  <div style="
    font-size: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #64748b;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 15mm;
    box-sizing: border-box;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4px;
    margin-top: 5mm;
  ">
    <span><strong>${host}</strong> — ${title}</span>
    <span>Scanner: v${scannerVer} | Ruleset: v${rulesetVer}</span>
  </div>`;
}

export function buildChromiumFooterTemplate(report: StructuredReport): string {
  const targetUrl = escapeHtml(report.websiteOverview.targetUrl);

  return `
  <div style="
    font-size: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #64748b;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 15mm;
    box-sizing: border-box;
    border-top: 1px solid #e2e8f0;
    padding-top: 4px;
    margin-bottom: 5mm;
  ">
    <span>Confidential Pre-Launch Technical Audit • ${targetUrl}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`;
}

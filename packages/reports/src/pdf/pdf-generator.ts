/**
 * PDF Generator
 *
 * Implements Stage 13: Converts HTML report templates into high-fidelity,
 * downloadable PDF reports using Chromium print-to-PDF and stores them in Vercel Blob.
 *
 * Features:
 * - Professional A4 print layout with page numbers (<span class="pageNumber"></span> of <span class="totalPages"></span>).
 * - Running headers and footers with target host, scan date, and scanner/ruleset versions.
 * - Word-wrapping and page-break rules preventing clipped URLs or broken cards.
 * - Direct integration with Vercel Blob storage (30-day lifecycle expiry).
 * - Support for browser provider injection.
 */

import { withBrowser, uploadArtifactBlob } from "@vibe/capture";
import { renderReportToHtml } from "../renderer/html-renderer";
import type { StructuredReport } from "../types";
import {
  buildChromiumHeaderTemplate,
  buildChromiumFooterTemplate,
} from "./header-footer";
import type {
  PdfRenderOptions,
  PdfUploadOptions,
  PdfGenerationResult,
} from "./types";

export type BrowserRunner = <T>(
  callback: (browser: any) => Promise<T>
) => Promise<T>;

export type BlobUploader = (
  pathName: string,
  data: Buffer,
  options?: { contentType?: string; expiresInDays?: number }
) => Promise<{ blobKey: string; url: string; expiresAt: string }>;

export interface PdfGeneratorConfig {
  /** Optional custom browser execution runner */
  browserRunner?: BrowserRunner;
  /** Optional custom blob uploader */
  blobUploader?: BlobUploader;
}

export class PdfGenerator {
  private browserRunner: BrowserRunner;
  private blobUploader: BlobUploader;

  constructor(config: PdfGeneratorConfig = {}) {
    this.browserRunner = config.browserRunner ?? withBrowser;
    this.blobUploader = config.blobUploader ?? uploadArtifactBlob;
  }

  /**
   * Generates a raw binary PDF buffer from an HTML string using Chromium.
   */
  public async generatePdfBufferFromHtml(
    html: string,
    options: PdfRenderOptions = {},
    report?: StructuredReport
  ): Promise<Buffer> {
    const format = options.format ?? "A4";
    const printBackground = options.printBackground ?? true;
    const landscape = options.landscape ?? false;
    const displayHeaderFooter = options.displayHeaderFooter ?? true;

    const margin = {
      top: options.margin?.top ?? "24mm",
      bottom: options.margin?.bottom ?? "24mm",
      left: options.margin?.left ?? "15mm",
      right: options.margin?.right ?? "15mm",
    };

    let headerTemplate = options.headerTemplate;
    let footerTemplate = options.footerTemplate;

    if (displayHeaderFooter && report) {
      headerTemplate = headerTemplate ?? buildChromiumHeaderTemplate(report);
      footerTemplate = footerTemplate ?? buildChromiumFooterTemplate(report);
    }

    return await this.browserRunner(async (browser) => {
      const page = await browser.newPage();
      try {
        await page.setContent(html, {
          waitUntil: "load",
          timeout: 30000,
        });

        // Evaluate layout stability before printing
        await page.evaluate(() => document.fonts.ready);

        const pdfBuffer = await page.pdf({
          format,
          printBackground,
          landscape,
          margin,
          displayHeaderFooter,
          headerTemplate: headerTemplate ?? "<span></span>",
          footerTemplate: footerTemplate ?? "<span></span>",
        });

        return Buffer.from(pdfBuffer);
      } finally {
        await page.close().catch(() => {});
      }
    });
  }

  /**
   * Converts a validated StructuredReport into a PDF and optionally uploads it to Vercel Blob.
   */
  public async generatePdf(
    report: StructuredReport,
    options: PdfUploadOptions = {}
  ): Promise<PdfGenerationResult> {
    // 1. Render actual persisted report to HTML (no hardcoded content)
    const html = renderReportToHtml(report);

    // 2. Generate PDF Buffer via Chromium
    const pdfBuffer = await this.generatePdfBufferFromHtml(html, options, report);
    const sizeBytes = pdfBuffer.length;
    const contentType = "application/pdf";

    // 3. Upload to Vercel Blob unless explicitly disabled
    const shouldUpload = options.uploadToBlob !== false;
    let blobKey: string | undefined;
    let blobUrl: string | undefined;
    let expiresAt: string | undefined;

    if (shouldUpload) {
      const blobPath =
        options.blobPathOverride ??
        `scans/${report.scanId}/reports/${report.templateMetadata.presentationType}-${report.reportId}.pdf`;

      const uploadResult = await this.blobUploader(blobPath, pdfBuffer, {
        contentType,
        expiresInDays: options.expiresInDays ?? 30, // 30-day lifecycle per blueprint
      });

      blobKey = uploadResult.blobKey;
      blobUrl = uploadResult.url;
      expiresAt = uploadResult.expiresAt;
    }

    return {
      pdfBuffer,
      sizeBytes,
      contentType,
      blobKey,
      blobUrl,
      expiresAt,
    };
  }
}

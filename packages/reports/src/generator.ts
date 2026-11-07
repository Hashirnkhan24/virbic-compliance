/**
 * Report Generator
 *
 * Primary entry point for converting completed scan results and rules evaluation
 * into structured reports, rendered HTML presentations, and Chromium-generated PDFs.
 *
 * Implements Stage 12 and Stage 13 of the product blueprint.
 */

import type { SiteSnapshot, EvidenceRecord } from "@vibe/contracts";
import type { EvaluationResult } from "@vibe/rules";
import { ReportDataBuilder, type ReportBuilderOptions } from "./builder";
import { renderReportToHtml } from "./renderer/html-renderer";
import { PdfGenerator, type PdfGeneratorConfig } from "./pdf/pdf-generator";
import type { PdfUploadOptions, PdfGenerationResult } from "./pdf/types";
import type { StructuredReport } from "./types";

export interface GeneratedReportOutput {
  readonly structuredReport: StructuredReport;
  readonly html: string;
}

export interface GeneratedFullReportPackage extends GeneratedReportOutput {
  readonly pdf: PdfGenerationResult;
}

export class ReportGenerator {
  private builder: ReportDataBuilder;
  private pdfGenerator: PdfGenerator;

  constructor(builder?: ReportDataBuilder, pdfConfig?: PdfGeneratorConfig) {
    this.builder = builder ?? new ReportDataBuilder();
    this.pdfGenerator = new PdfGenerator(pdfConfig);
  }

  /**
   * Generates a validated, strongly-typed StructuredReport.
   */
  public generateStructuredReport(
    snapshot: SiteSnapshot,
    evaluation: EvaluationResult,
    evidenceRecords: EvidenceRecord[],
    options: ReportBuilderOptions = {}
  ): StructuredReport {
    return this.builder.build(snapshot, evaluation, evidenceRecords, options);
  }

  /**
   * Generates rendered HTML report for the specified presentation type.
   */
  public generateHtmlReport(
    snapshot: SiteSnapshot,
    evaluation: EvaluationResult,
    evidenceRecords: EvidenceRecord[],
    options: ReportBuilderOptions = {}
  ): string {
    const structured = this.generateStructuredReport(
      snapshot,
      evaluation,
      evidenceRecords,
      options
    );
    return renderReportToHtml(structured);
  }

  /**
   * Generates both structured data and rendered HTML in a single call.
   */
  public generateReport(
    snapshot: SiteSnapshot,
    evaluation: EvaluationResult,
    evidenceRecords: EvidenceRecord[],
    options: ReportBuilderOptions = {}
  ): GeneratedReportOutput {
    const structuredReport = this.generateStructuredReport(
      snapshot,
      evaluation,
      evidenceRecords,
      options
    );
    const html = renderReportToHtml(structuredReport);

    return {
      structuredReport,
      html,
    };
  }

  /**
   * Generates a downloadable PDF report through Chromium and uploads to Vercel Blob.
   */
  public async generatePdf(
    reportOrSnapshot: StructuredReport | {
      snapshot: SiteSnapshot;
      evaluation: EvaluationResult;
      evidenceRecords: EvidenceRecord[];
      options?: ReportBuilderOptions;
    },
    pdfOptions: PdfUploadOptions = {}
  ): Promise<PdfGenerationResult> {
    let report: StructuredReport;

    if ("reportId" in reportOrSnapshot) {
      report = reportOrSnapshot;
    } else {
      report = this.generateStructuredReport(
        reportOrSnapshot.snapshot,
        reportOrSnapshot.evaluation,
        reportOrSnapshot.evidenceRecords,
        reportOrSnapshot.options
      );
    }

    return await this.pdfGenerator.generatePdf(report, pdfOptions);
  }

  /**
   * Generates the complete report package: structured report, HTML, and Vercel Blob PDF.
   */
  public async generateFullPackage(
    snapshot: SiteSnapshot,
    evaluation: EvaluationResult,
    evidenceRecords: EvidenceRecord[],
    options: ReportBuilderOptions = {},
    pdfOptions: PdfUploadOptions = {}
  ): Promise<GeneratedFullReportPackage> {
    const structuredReport = this.generateStructuredReport(
      snapshot,
      evaluation,
      evidenceRecords,
      options
    );
    const html = renderReportToHtml(structuredReport);
    const pdf = await this.pdfGenerator.generatePdf(structuredReport, pdfOptions);

    return {
      structuredReport,
      html,
      pdf,
    };
  }
}

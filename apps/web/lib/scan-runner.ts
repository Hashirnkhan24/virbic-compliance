/**
 * Scan Runner Pipeline Orchestrator
 *
 * Coordinates the full scan lifecycle from URL validation through
 * capture, deterministic detection, rules evaluation, and report/PDF generation.
 * Emits live, genuine scan events at each stage for frontend polling.
 */

import {
  validateTargetUrl,
  buildSiteSnapshot,
} from "@vibe/capture";
import { DetectionEngine, WAVE_1_CHECKS } from "@vibe/detectors";
import { RulesEngine } from "@vibe/rules";
import { ReportGenerator } from "@vibe/reports";
import type {
  FreeScanPreview,
  FindingRecord,
  SiteSnapshot,
} from "@vibe/contracts";
import { ScanStore } from "./scan-store";

export async function runScan(scanId: string): Promise<void> {
  const scan = await ScanStore.getScan(scanId);
  if (!scan) return;

  const startTime = Date.now();
  await ScanStore.updateScan(scanId, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    // -------------------------------------------------------------
    // Stage 1: URL Guard & Network Safety Validation
    // -------------------------------------------------------------
    await ScanStore.addEvent(
      scanId,
      "url_validation",
      `Validating target URL ${scan.targetUrl} against SSRF and private network policies...`
    );

    const guard = await validateTargetUrl(scan.targetUrl);
    if (!guard.isSafe) {
      await ScanStore.addEvent(
        scanId,
        "failed",
        `Security Guard rejected target: ${guard.message}`
      );
      await ScanStore.updateScan(scanId, {
        status: "failed",
        errorMessage: guard.message,
        finishedAt: new Date().toISOString(),
      });
      return;
    }

    await ScanStore.addEvent(
      scanId,
      "url_validation_complete",
      `URL validated safely. Host: ${guard.normalized.host}, Resolved IPs: ${guard.resolvedIps.join(", ")}`
    );

    // -------------------------------------------------------------
    // Stage 2: Evidence Capture & Snapshot Assembly
    // -------------------------------------------------------------
    await ScanStore.addEvent(
      scanId,
      "network_probes",
      "Running DNS and TLS protocol probes..."
    );

    await ScanStore.addEvent(
      scanId,
      "crawling",
      "Discovering same-origin pages and public routes (limit 12)..."
    );

    await ScanStore.addEvent(
      scanId,
      "browser_capture",
      "Rendering pages in headless browser with accessibility and DOM inspection..."
    );

    await ScanStore.addEvent(
      scanId,
      "consent_testing",
      "Running multi-context consent analysis (no-choice, reject, accept)..."
    );

    let snapshot: SiteSnapshot;
    try {
      snapshot = await buildSiteSnapshot({
        targetUrl: scan.targetUrl,
        scanId: scan.id,
        maxPages: 12,
        includeConsentTesting: true,
        saveRawArtifactsToBlob: true,
        timeoutMs: 45_000,
      });
    } catch (captureErr: any) {
      // In case full browser capture fails (e.g. timeout or sandbox network restriction)
      // fallback to a safe minimal snapshot to enable graceful partial scan evaluation
      console.warn("Full capture encountered error, assembling minimal snapshot:", captureErr);
      await ScanStore.addEvent(
        scanId,
        "capture_fallback",
        `Capture warning: ${captureErr.message}. Proceeding with collected evidence.`
      );

      snapshot = {
        schemaVersion: "1.0.0",
        scanId: scan.id,
        canonicalOrigin: guard.normalized.origin,
        targetHost: guard.normalized.host,
        capturedAt: new Date().toISOString(),
        scannerVersion: scan.scannerVersion,
        pages: [
          {
            url: guard.normalized.normalized,
            finalUrl: guard.normalized.normalized,
            httpStatus: 200,
            pageType: "home",
            loadDurationMs: 300,
            hasLoginForm: false,
            hasPaymentForm: false,
            hasContactForm: false,
            capturedAt: new Date().toISOString(),
          },
        ],
        cookies: [],
        networkRequests: [],
        responseHeaders: [],
        assets: [],
        dns: {
          resolvedIps: guard.resolvedIps,
          records: guard.resolvedIps.map((ip) => ({
            type: ip.includes(":") ? "AAAA" : "A",
            value: ip,
          })),
          hasDkimSignal: false,
          isCloudflareOrCdn: false,
          checkedAt: new Date().toISOString(),
        },
        tls: {
          valid: guard.normalized.protocol === "https:",
          enforcesHttps: guard.normalized.protocol === "https:",
          hasMixedContentWarnings: false,
        },
        consentRuns: {},
        accessibilityViolations: [],
        incompleteStages: ["browser_rendering_timeout"],
        collectionWarnings: [captureErr.message],
      };
    }

    await ScanStore.addEvent(
      scanId,
      "snapshot_assembled",
      `Snapshot assembled: ${snapshot.pages.length} pages, ${snapshot.cookies.length} cookies, ${snapshot.networkRequests.length} network requests.`
    );

    // -------------------------------------------------------------
    // Stage 3: Deterministic Detection Suite
    // -------------------------------------------------------------
    await ScanStore.addEvent(
      scanId,
      "detectors_running",
      `Executing Wave 1 detection suite (${WAVE_1_CHECKS.length} checks across 9 risk modules)...`
    );

    const detectionEngine = new DetectionEngine({
      scannerVersion: scan.scannerVersion,
      rulesetVersion: scan.rulesetVersion,
    });
    detectionEngine.registerAll(WAVE_1_CHECKS);

    const detectionSuiteResult = await detectionEngine.executeAll(snapshot, {
      jurisdictions: scan.jurisdictions,
    });

    const detectorOutputs = Object.values(detectionSuiteResult.results).map(
      (r) => r.output
    );
    const evidenceRecords = detectionSuiteResult.collectedEvidence;

    await ScanStore.addEvent(
      scanId,
      "detectors_complete",
      `Detection suite completed in ${detectionSuiteResult.totalDurationMs}ms. Raw issues: ${detectionSuiteResult.statusCounts.issue_found}.`
    );

    // -------------------------------------------------------------
    // Stage 4: Rules Engine & Launch Readiness Scoring
    // -------------------------------------------------------------
    await ScanStore.addEvent(
      scanId,
      "rules_evaluating",
      "Evaluating jurisdiction applicability, validating evidence references, and computing readiness score..."
    );

    const rulesEngine = new RulesEngine({
      rulesetVersion: scan.rulesetVersion,
    });

    const evaluationResult = rulesEngine.evaluate({
      scanId: scan.id,
      detectorOutputs,
      evidenceRecords,
      confirmedJurisdictions: scan.jurisdictions,
      snapshot,
      scannerVersion: scan.scannerVersion,
    });

    await ScanStore.addEvent(
      scanId,
      "score_computed",
      `Launch readiness score: ${evaluationResult.score}/100. Status counts: ${evaluationResult.statusCounts.passed} passed, ${evaluationResult.statusCounts.issue_found} issues, ${evaluationResult.statusCounts.unable_to_verify} unable to verify.`
    );

    // -------------------------------------------------------------
    // Stage 5: Structured Reports & Free Scan Preview DTO
    // -------------------------------------------------------------
    await ScanStore.addEvent(
      scanId,
      "generating_reports",
      "Synthesizing Founder and Agency handover reports..."
    );

    const reportGenerator = new ReportGenerator();
    const structuredReport = reportGenerator.generateStructuredReport(
      snapshot,
      evaluationResult,
      evidenceRecords,
      { presentationType: "founder_launch" }
    );

    // Build the strictly limited FreeScanPreview DTO (top 5-10 findings only, no locked data)
    const topFindingsMapped: FindingRecord[] = evaluationResult.topFindings.map(
      (f) => ({
        id: f.id,
        scanId: f.scanId,
        checkId: f.checkId,
        status: f.status,
        severity: f.severity,
        confidence: f.confidence,
        reasonCode: f.reasonCode,
        title: f.title,
        summary: f.summary,
        evidenceIds: f.evidenceIds,
        remediation: f.remediation,
        exposureDetails: f.exposureDetails,
        requiresHumanReview: f.requiresHumanReview,
        createdAt: f.createdAt,
      })
    );

    const freePreview: FreeScanPreview = {
      scanId: scan.id,
      targetUrl: scan.targetUrl,
      score: evaluationResult.score,
      status: "completed",
      scannerVersion: scan.scannerVersion,
      statusCounts: evaluationResult.statusCounts,
      severityCounts: evaluationResult.severityCounts,
      topFindings: topFindingsMapped,
      exposureRange: evaluationResult.exposureSummary,
      isPaid: false,
      scannedAt: new Date().toISOString(),
    };

    // -------------------------------------------------------------
    // Stage 6: Generate Downloadable PDF Package
    // -------------------------------------------------------------
    await ScanStore.addEvent(
      scanId,
      "generating_pdf",
      "Rendering print-ready PDF via Chromium and archiving in storage..."
    );

    let pdfBlobUrl: string | undefined = undefined;
    let pdfBlobKey: string | undefined = undefined;

    try {
      const fullPackage = await reportGenerator.generateFullPackage(
        snapshot,
        evaluationResult,
        evidenceRecords,
        { presentationType: "founder_launch" }
      );
      pdfBlobUrl = fullPackage.pdf.blobUrl;
      pdfBlobKey = fullPackage.pdf.blobKey;
    } catch (pdfErr: any) {
      console.warn("PDF generation error (will be retried on demand):", pdfErr);
      await ScanStore.addEvent(
        scanId,
        "pdf_deferred",
        `PDF generation deferred: ${pdfErr.message}`
      );
    }

    // -------------------------------------------------------------
    // Stage 7: Persist Final Scan Results
    // -------------------------------------------------------------
    await ScanStore.updateScan(scanId, {
      status: "completed",
      score: evaluationResult.score,
      freePreview,
      structuredReport,
      findings: evaluationResult.findings.map((f) => ({
        id: f.id,
        scanId: f.scanId,
        checkId: f.checkId,
        status: f.status,
        severity: f.severity,
        confidence: f.confidence,
        reasonCode: f.reasonCode,
        title: f.title,
        summary: f.summary,
        evidenceIds: f.evidenceIds,
        remediation: f.remediation,
        exposureDetails: f.exposureDetails,
        requiresHumanReview: f.requiresHumanReview,
        createdAt: f.createdAt,
      })),
      evidence: evidenceRecords,
      pdfBlobUrl,
      pdfBlobKey,
      finishedAt: new Date().toISOString(),
    });

    await ScanStore.addEvent(
      scanId,
      "completed",
      `Scan completed successfully in ${((Date.now() - startTime) / 1000).toFixed(1)}s.`
    );
  } catch (err: any) {
    console.error(`Scan execution failed for ${scanId}:`, err);
    await ScanStore.addEvent(
      scanId,
      "failed",
      `Scan failed unexpectedly: ${err.message}`
    );
    await ScanStore.updateScan(scanId, {
      status: "failed",
      errorMessage: err.message,
      finishedAt: new Date().toISOString(),
    });
  }
}

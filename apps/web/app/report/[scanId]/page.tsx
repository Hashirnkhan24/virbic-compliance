"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { FindingRecord, EvidenceRecord, Jurisdiction } from "@vibe/contracts";
import type { StructuredReport } from "@vibe/reports";
import { generateCombinedFixingKit } from "@vibe/fixes";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ScoreGauge } from "@/components/ScoreGauge";
import { FindingCard } from "@/components/FindingCard";
import { ExposureCard } from "@/components/ExposureCard";

interface FullReportResponse {
  scanId: string;
  targetUrl: string;
  targetHost: string;
  score: number;
  scannerVersion: string;
  rulesetVersion: string;
  isPaid: boolean;
  structuredReport?: StructuredReport;
  findings: FindingRecord[];
  evidence: EvidenceRecord[];
  pdfUrl: string;
  scannedAt: string;
}

export default function PaidReportPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [reportData, setReportData] = useState<FullReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state: Founder vs Agency
  const [viewMode, setViewMode] = useState<"founder" | "agency">("founder");

  // Region filter: All vs India vs EU vs US (same snapshot, no rescan)
  const [regionFilter, setRegionFilter] = useState<"all" | Jurisdiction>("all");

  // Module filter
  const [selectedModule, setSelectedModule] = useState<string>("all");

  // Combined prompt copy state
  const [copiedCombined, setCopiedCombined] = useState(false);

  useEffect(() => {
    async function fetchReport() {
      try {
        const url = token
          ? `/api/scan/${scanId}/report?token=${encodeURIComponent(token)}`
          : `/api/scan/${scanId}/report`;
        const res = await fetch(url);
        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            throw new Error("Invalid or missing report token. Please unlock the report to view complete data.");
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to retrieve full report.");
        }

        const data: FullReportResponse = await res.json();
        setReportData(data);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [scanId, token]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Header />
        <main className="flex-1 flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <svg className="animate-spin w-8 h-8 text-indigo-500 mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm text-slate-400">Loading audit report & AI Fixing Kit...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Header />
        <main className="flex-1 py-20">
          <div className="max-w-2xl mx-auto px-4 text-center space-y-4">
            <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm space-y-2">
              <div className="font-bold text-base">Report Access Restricted</div>
              <p>{error || "Unable to access paid report."}</p>
            </div>
            <Link
              href={`/scan/${scanId}/results`}
              className="inline-block px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white"
            >
              Back to Free Summary
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const { findings, evidence, structuredReport } = reportData;

  // Filter findings by jurisdiction and module
  const filteredFindings = findings.filter((f) => {
    // Module filter
    if (selectedModule !== "all") {
      const mod = f.checkId.charAt(0).toLowerCase();
      if (selectedModule === "privacy" && mod !== "a") return false;
      if (selectedModule === "cookies" && mod !== "b") return false;
      if (selectedModule === "a11y" && mod !== "c") return false;
      if (selectedModule === "security" && mod !== "d") return false;
      if (selectedModule === "legal" && mod !== "e") return false;
      if (selectedModule === "quality" && mod !== "h" && mod !== "i" && mod !== "g") return false;
    }

    // Region filter
    if (regionFilter !== "all") {
      const mod = f.checkId.charAt(0).toLowerCase();
      if (regionFilter === "india") {
        if (!["a", "b", "e"].includes(mod)) return false;
      }
      if (regionFilter === "eu") {
        if (!["a", "b", "c"].includes(mod)) return false;
      }
      if (regionFilter === "us") {
        if (!["a", "b", "e"].includes(mod)) return false;
      }
    }

    return true;
  });

  const passedCount = findings.filter((f) => f.status === "passed").length;
  const issuesCount = findings.filter((f) => f.status === "issue_found").length;
  const unableCount = findings.filter((f) => f.status === "unable_to_verify").length;
  const naCount = findings.filter((f) => f.status === "not_applicable").length;

  // Combined fixing kit handler
  const handleCopyCombined = async () => {
    const issues = findings.filter((f) => f.status === "issue_found");
    const combinedMarkdown = generateCombinedFixingKit(issues, evidence, {
      targetUrl: reportData.targetUrl,
    });
    try {
      await navigator.clipboard.writeText(combinedMarkdown);
      setCopiedCombined(true);
      setTimeout(() => setCopiedCombined(false), 2000);
    } catch (err) {
      console.error("Failed to copy combined prompt", err);
    }
  };

  const handleDownloadFixingKit = () => {
    const issues = findings.filter((f) => f.status === "issue_found");
    const combinedMarkdown = generateCombinedFixingKit(issues, evidence, {
      targetUrl: reportData.targetUrl,
    });
    const blob = new Blob([combinedMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-fixing-kit-${reportData.targetHost || "website"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />

      <main className="flex-1 py-10 sm:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Top Control Bar: Title, Presentation Switcher, Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border border-slate-800 bg-slate-900/60">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                  Full Scan Report & AI Fixing Kit
                </span>
                <span className="text-xs text-slate-500">
                  Audited {new Date(reportData.scannedAt).toLocaleDateString()}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5 break-all">
                {reportData.targetUrl}
              </h1>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Presentation Mode Toggle */}
              <div className="p-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center text-xs">
                <button
                  onClick={() => setViewMode("founder")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    viewMode === "founder"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Founder View
                </button>
                <button
                  onClick={() => setViewMode("agency")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    viewMode === "agency"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Agency View
                </button>
              </div>

              {/* Download AI Fixing Kit */}
              <button
                onClick={handleDownloadFixingKit}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-purple-300 bg-purple-950/50 hover:bg-purple-900/50 border border-purple-500/30 transition-all shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Fixing Kit (.md)</span>
              </button>

              {/* PDF Download Button */}
              <a
                href={reportData.pdfUrl}
                download
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all shadow-sm"
              >
                <svg className="w-3.5 h-3.5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>PDF Report</span>
              </a>
            </div>
          </div>

          {/* Perspective Subtitle Note */}
          <div className="p-3.5 rounded-xl bg-slate-900/30 border border-slate-800 text-xs text-slate-400">
            <span>
              Viewing as:{" "}
              <strong className="text-slate-200 font-semibold">
                {viewMode === "founder"
                  ? "SaaS Founder Perspective (focusing on launch blockers, payment gateway readiness, and customer trust)"
                  : "Agency Handover Perspective (formal pre-delivery QA, verifiable quality metrics, and clear client responsibility scope)"}
              </strong>
            </span>
          </div>

          {/* Score & Summary Counts */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 text-center space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                Launch Score
              </span>
              <ScoreGauge score={reportData.score} size="md" />
            </div>

            <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
                <span className="text-2xl font-bold text-emerald-400 block">
                  {passedCount}
                </span>
                <span className="text-xs font-medium text-slate-300">Passed</span>
                <span className="text-[10px] text-slate-500 block">Checks satisfied</span>
              </div>

              <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-center">
                <span className="text-2xl font-bold text-rose-400 block">
                  {issuesCount}
                </span>
                <span className="text-xs font-medium text-slate-300">Issues Found</span>
                <span className="text-[10px] text-slate-500 block">Fixing kit available</span>
              </div>

              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center">
                <span className="text-2xl font-bold text-amber-400 block">
                  {unableCount}
                </span>
                <span className="text-xs font-medium text-slate-300">Unable to Verify</span>
                <span className="text-[10px] text-slate-500 block">Manual check suggested</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-center">
                <span className="text-2xl font-bold text-slate-400 block">
                  {naCount}
                </span>
                <span className="text-xs font-medium text-slate-300">Not Applicable</span>
                <span className="text-[10px] text-slate-500 block">Scope excluded</span>
              </div>
            </div>
          </div>

          {/* Exposure and Estimated Resolution Cost Card */}
          {structuredReport?.exposureSummary && (
            <ExposureCard exposure={structuredReport.exposureSummary} />
          )}

          {/* AI Fixing Kit Master Action Hub */}
          {issuesCount > 0 && (
            <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900/60 p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-lg shadow-purple-950/20">
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
                    AI Fixing Kit Ready
                  </span>
                  <span className="text-xs text-slate-400">
                    {issuesCount} issues ready for your coding agent
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Hand ready-to-use prompts straight to Cursor, Claude Code, or Antigravity
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Every issue includes structured tasks, constraints, acceptance criteria, and verification steps. Copy individual prompts from the findings below, or grab the combined plan.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                <button
                  onClick={handleCopyCombined}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                    copiedCombined
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
                  }`}
                >
                  {copiedCombined ? (
                    <>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Copied All {issuesCount} Prompts</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                        />
                      </svg>
                      <span>Copy Combined AI Prompt</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadFixingKit}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-all flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download .md Document</span>
                </button>
              </div>
            </div>
          )}

          {/* Filter Bar: Modules & Jurisdictions */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Module Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="text-slate-500 mr-1.5 font-medium">Filter Category:</span>
                {[
                  { key: "all", label: "All Issues" },
                  { key: "privacy", label: "Privacy" },
                  { key: "cookies", label: "Cookie Consent" },
                  { key: "a11y", label: "Accessibility" },
                  { key: "security", label: "Security" },
                  { key: "legal", label: "Legal & Policies" },
                  { key: "quality", label: "Site Quality" },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setSelectedModule(m.key)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      selectedModule === m.key
                        ? "bg-slate-800 text-white font-semibold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Region Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 mr-1 font-medium">Region:</span>
                {[
                  { key: "all", label: "All Rules" },
                  { key: "india", label: "India (DPDP)" },
                  { key: "eu", label: "EU (GDPR)" },
                  { key: "us", label: "US (CCPA)" },
                ].map((reg) => (
                  <button
                    key={reg.key}
                    onClick={() => setRegionFilter(reg.key as any)}
                    className={`px-2.5 py-1 rounded-md transition-all text-[11px] ${
                      regionFilter === reg.key
                        ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 font-semibold"
                        : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    {reg.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 border-t border-slate-800/60 pt-2.5">
              Regional filters highlight rules under that specific legal framework. Your legal obligations depend on where your users and business reside, not simply where the website server is located.
            </p>
          </div>

          {/* Full Findings Inventory */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Findings Inventory & AI Fixing Kit
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing {filteredFindings.length} checks matching active filters.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {evidence.length} Evidence Records Captured
              </span>
            </div>

            <div className="space-y-4">
              {filteredFindings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  evidenceList={evidence}
                  targetUrl={reportData.targetUrl}
                  isLocked={false}
                />
              ))}
            </div>
          </div>

          {/* Limitations & Verification Notice */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950/60 text-xs text-slate-400 space-y-2 leading-relaxed">
            <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
              Compliance & Verification Notice
            </h4>
            <p>
              This report is generated automatically by Vibe Compliance based on passive, public snapshot observations. It does not constitute formal legal counsel, regulatory certification, or a guarantee of immunity from enforcement.
            </p>
            <p>
              Items marked as <code>unable_to_verify</code> indicate that public evidence could not be definitively observed from the front-end (for instance, bot protection, client-side dynamic rendering, or missing public pages). Some findings require business owner confirmation or manual verification.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

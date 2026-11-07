"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FreeScanPreview } from "@vibe/contracts";
import { APP_CONFIG } from "@/lib/constants";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ScoreGauge } from "@/components/ScoreGauge";
import { ExposureCard } from "@/components/ExposureCard";
import { FindingCard } from "@/components/FindingCard";

export default function FreeResultsPreviewPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = use(params);
  const router = useRouter();

  const [preview, setPreview] = useState<FreeScanPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Paid report unlock state
  const [unlockEmail, setUnlockEmail] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPreview() {
      try {
        const res = await fetch(`/api/scan/${scanId}/preview`);
        if (!res.ok) {
          if (res.status === 202) {
            // Still in progress, redirect back to progress page
            router.push(`/scan/${scanId}`);
            return;
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to load scan preview.");
        }

        const data: FreeScanPreview = await res.json();
        setPreview(data);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }

    fetchPreview();
  }, [scanId, router]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);

    if (!unlockEmail || !unlockEmail.includes("@")) {
      setUnlockError("Please enter a valid business or founder email address.");
      return;
    }

    setUnlocking(true);

    try {
      const res = await fetch(`/api/scan/${scanId}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unlockEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to unlock report.");
      }

      // Navigate to the full report using the returned report URL (containing token)
      router.push(data.reportUrl);
    } catch (err: any) {
      setUnlockError(err.message || "Failed to process report unlock.");
      setUnlocking(false);
    }
  };

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
            <p className="text-sm text-slate-400">Loading verified preview results...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Header />
        <main className="flex-1 py-20">
          <div className="max-w-2xl mx-auto px-4 text-center space-y-4">
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
              {error || "Report preview could not be loaded."}
            </div>
            <Link
              href="/#scan-form"
              className="inline-block px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white"
            >
              Run a New Scan
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const { statusCounts, severityCounts, topFindings, exposureRange } = preview;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />

      <main className="flex-1 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Top Banner: URL & Summary Notice */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900/60">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded border border-indigo-500/20">
                  Free Scan Summary
                </span>
                <span className="text-xs text-slate-500">
                  Audited {new Date(preview.scannedAt).toLocaleDateString()}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white mt-1 break-all">
                {preview.targetUrl}
              </h1>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <Link
                href={`/report/${scanId}`}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-600/30 transition-all flex items-center gap-1.5"
              >
                <span>View Full Report & AI Fixing Kit</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Score & Status Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Score Card */}
            <div className="lg:col-span-1 p-8 rounded-2xl border border-slate-800 bg-slate-900/40 text-center space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Overall Launch Readiness
              </span>
              <ScoreGauge score={preview.score} size="lg" />
              <div className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-4">
                Score strictly accounts for applicable issues. Checks marked as{" "}
                <code className="text-slate-300">not_applicable</code> do not deduct points, and{" "}
                <code className="text-slate-300">unable_to_verify</code> checks are never treated as
                passed.
              </div>
            </div>

            {/* Status & Severity Counts */}
            <div className="lg:col-span-2 space-y-6">
              {/* Four Statuses Invariant Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
                  <span className="text-2xl font-extrabold text-emerald-400 block">
                    {statusCounts.passed}
                  </span>
                  <span className="text-xs font-semibold text-slate-300">Passed</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Verified Safe</span>
                </div>

                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-center">
                  <span className="text-2xl font-extrabold text-rose-400 block">
                    {statusCounts.issue_found}
                  </span>
                  <span className="text-xs font-semibold text-slate-300">Issues Found</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Affects Score</span>
                </div>

                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center">
                  <span className="text-2xl font-extrabold text-amber-400 block">
                    {statusCounts.unable_to_verify}
                  </span>
                  <span className="text-xs font-semibold text-slate-300">Unable to Verify</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Missing Evidence</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-center">
                  <span className="text-2xl font-extrabold text-slate-400 block">
                    {statusCounts.not_applicable}
                  </span>
                  <span className="text-xs font-semibold text-slate-300">Not Applicable</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Out of Scope</span>
                </div>
              </div>

              {/* Severity Breakdown */}
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Issue Severity Distribution
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/20 text-xs font-semibold text-red-400">
                    {severityCounts.critical} Critical
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-orange-600/10 border border-orange-500/20 text-xs font-semibold text-orange-400">
                    {severityCounts.high} High
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-amber-600/10 border border-amber-500/20 text-xs font-semibold text-amber-400">
                    {severityCounts.medium} Medium
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-sky-600/10 border border-sky-500/20 text-xs font-semibold text-sky-400">
                    {severityCounts.low} Low
                  </span>
                </div>
              </div>

              {/* Financial Exposure Card */}
              <ExposureCard exposure={exposureRange} />
            </div>
          </div>

          {/* Top Priority Preview Findings (Allowlisted 5-10 findings) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Top Priority Diagnostic Findings
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing top {topFindings.length} highest-impact findings from the automated scan.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                {statusCounts.issue_found} Total Issues Observed
              </span>
            </div>

            <div className="space-y-3">
              {topFindings.length > 0 ? (
                topFindings.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    targetUrl={preview.targetUrl}
                    isLocked={true}
                  />
                ))
              ) : (
                <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/30 text-center text-slate-400 text-sm">
                  No critical issues detected in top preview. Review complete report for full inventory.
                </div>
              )}
            </div>
          </div>

          {/* Paywall & Unlock Section */}
          <div
            id="unlock-section"
            className="rounded-3xl border border-slate-800 bg-gradient-to-b from-indigo-950/30 via-slate-900/60 to-slate-900/80 p-8 sm:p-12 text-center space-y-6 shadow-xl"
          >
            {/* Development Mode Instant Free Access */}
            <div className="p-5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-2xl mx-auto">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 inline-block">
                  Development Mode • Free Access
                </span>
                <p className="text-xs text-emerald-100 font-medium">
                  Directly inspect all diagnostic findings, evidence locators, and the AI Fixing Kit without paying.
                </p>
              </div>
              <Link
                href={`/report/${scanId}`}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-sm transition-all text-center whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5"
              >
                <span>View Full Detailed Report</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
              <span>Full Scan Report & AI Fixing Kit</span>
              <span>•</span>
              <span>{APP_CONFIG.launchPriceLabel} One-Time</span>
            </div>

            <div className="max-w-2xl mx-auto space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Get the Complete Scan Report & AI Fixing Kit
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Unlock all {APP_CONFIG.checksCount}+ checks, exact DOM evidence locators, and structured prompts ready to paste directly into Cursor, Claude Code, Antigravity, or hand to your developer.
              </p>
            </div>

            {/* Value checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left pt-2">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-indigo-400 font-semibold text-xs block">All 40+ Checks</span>
                <p className="text-xs text-slate-400">
                  Full findings across privacy, cookie consent, accessibility, security, and policies.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-purple-400 font-semibold text-xs block">AI Fixing Kit</span>
                <p className="text-xs text-slate-400">
                  Ready-to-use prompts with acceptance criteria and constraints for your coding agent.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-sky-400 font-semibold text-xs block">Executive PDF & Rescan</span>
                <p className="text-xs text-slate-400">
                  Printable audit document for your team or clients, plus 1 free rescan within {APP_CONFIG.rescanWindowDays} days.
                </p>
              </div>
            </div>

            {/* Unlock Form */}
            <form onSubmit={handleUnlock} className="max-w-md mx-auto space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={unlockEmail}
                  onChange={(e) => setUnlockEmail(e.target.value)}
                  placeholder="Enter email for report token & delivery"
                  disabled={unlocking}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={unlocking}
                  className="px-6 py-3 rounded-xl font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                >
                  {unlocking ? (
                    <span>Unlocking...</span>
                  ) : (
                    <>
                      <span>Get Full Report ({APP_CONFIG.launchPriceLabel})</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              {unlockError && (
                <p className="text-xs text-rose-400 text-left">{unlockError}</p>
              )}

              <p className="text-[11px] text-slate-500">
                Secured token access. We never store raw payment credentials or raw tokens.
              </p>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

"use client";

import { useState } from "react";
import type { FindingRecord, EvidenceRecord } from "@vibe/contracts";
import { generateFixingPrompt } from "@vibe/fixes";
import { StatusBadge, SeverityBadge } from "./StatusBadge";

interface FindingCardProps {
  finding: FindingRecord;
  evidenceList?: EvidenceRecord[];
  targetUrl?: string;
  isLocked?: boolean;
}

export function FindingCard({
  finding,
  evidenceList = [],
  targetUrl,
  isLocked = false,
}: FindingCardProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [copied, setCopied] = useState(false);

  // Find supporting evidence records linked to this finding
  const supportingEvidence = evidenceList.filter((e) =>
    finding.evidenceIds.includes(e.id)
  );

  // Derive location string from evidence
  const firstWithUrl = supportingEvidence.find((e) => Boolean(e.pageUrl));
  const firstWithLocator = supportingEvidence.find((e) => Boolean(e.sourceLocator));
  const locationText =
    firstWithUrl?.pageUrl && firstWithLocator?.sourceLocator
      ? `${firstWithUrl.pageUrl} (Element: ${firstWithLocator.sourceLocator})`
      : firstWithUrl?.pageUrl
      ? firstWithUrl.pageUrl
      : firstWithLocator?.sourceLocator
      ? `Selector: ${firstWithLocator.sourceLocator}`
      : "Global website layout / navigation";

  // Generate the prompt using the AI Fixing Kit generator
  const fixingPrompt = generateFixingPrompt(finding, supportingEvidence, { targetUrl });

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(fixingPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy prompt to clipboard", err);
    }
  };

  const isIssue = finding.status === "issue_found";

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isIssue
          ? "border-slate-800 bg-slate-900/50 hover:border-slate-700"
          : "border-slate-800/60 bg-slate-950/40"
      } p-5 sm:p-6 space-y-4`}
    >
      {/* 1. Header Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
            {finding.checkId}
          </span>
          <StatusBadge status={finding.status} />
          {isIssue && finding.severity && (
            <SeverityBadge severity={finding.severity} />
          )}
          {finding.requiresHumanReview && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Needs human review
            </span>
          )}
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>Confidence: {Math.round(finding.confidence * 100)}%</span>
        </div>
      </div>

      {/* 2. What did we find? */}
      <div>
        <h4 className="text-base font-semibold text-white tracking-tight">
          {finding.title}
        </h4>
        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
          {finding.summary}
        </p>
      </div>

      {/* 3. Where did we find it? (Only show when relevant) */}
      {isIssue && (
        <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
          <span className="text-slate-500 font-medium shrink-0">Where:</span>
          <span className="font-mono text-[11px] text-slate-300 break-all">
            {locationText}
          </span>
        </div>
      )}

      {/* 4. Locked state for free preview */}
      {isLocked && isIssue && (
        <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-indigo-300">
            <svg
              className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>
              Detailed DOM evidence locators, regulatory citations, and AI Fixing Kit prompt are included in the full report.
            </span>
          </div>
          <a
            href="#unlock-section"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 whitespace-nowrap shrink-0"
          >
            Unlock report →
          </a>
        </div>
      )}

      {/* 5. Unlocked AI Fixing Kit Deliverable */}
      {!isLocked && isIssue && (
        <div className="pt-3 border-t border-slate-800/80 space-y-3">
          {/* Quick Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded border border-purple-500/20">
                AI Fixing Kit
              </span>
              <span className="text-xs text-slate-400">
                Prompt for Cursor, Claude Code, Antigravity, or Copilot
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyPrompt}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  copied
                    ? "bg-emerald-600 text-white"
                    : "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30"
                }`}
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Copied prompt</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                      />
                    </svg>
                    <span>Copy prompt for AI agent</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setShowPrompt(!showPrompt)}
                className="px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 transition-colors"
              >
                {showPrompt ? "Collapse prompt" : "Inspect prompt"}
              </button>
            </div>
          </div>

          {/* Expanded Prompt Viewer */}
          {showPrompt && (
            <div className="rounded-xl bg-slate-950 border border-slate-800/90 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-800/60">
                <span>Structured Prompt Preview</span>
                <span className="font-mono text-[10px]">Ready to paste into your coding agent</span>
              </div>
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                {fixingPrompt}
              </pre>
            </div>
          )}

          {/* Expandable Technical Evidence Records */}
          {supportingEvidence.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowEvidence(!showEvidence)}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 transition-colors"
              >
                <span>{showEvidence ? "Hide" : "Show"} technical evidence details ({supportingEvidence.length})</span>
                <svg
                  className={`w-3.5 h-3.5 transform transition-transform ${showEvidence ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showEvidence && (
                <div className="mt-2.5 space-y-2">
                  {supportingEvidence.map((ev, i) => (
                    <div
                      key={ev.id || i}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Evidence Type: {ev.evidenceType}</span>
                        {ev.pageUrl && <span className="text-slate-500">{ev.pageUrl}</span>}
                      </div>
                      {ev.sourceLocator && (
                        <div className="text-slate-400">
                          Locator: <span className="text-indigo-300">{ev.sourceLocator}</span>
                        </div>
                      )}
                      {ev.structuredValue && Object.keys(ev.structuredValue).length > 0 && (
                        <div className="text-slate-300 bg-slate-900/90 p-2 rounded-lg overflow-x-auto text-[10px]">
                          {JSON.stringify(ev.structuredValue, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

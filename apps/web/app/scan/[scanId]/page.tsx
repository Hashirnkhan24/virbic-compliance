"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface ScanEventRecord {
  id: string;
  scanId: string;
  stage: string;
  message: string;
  timestamp: string;
}

interface ScanStatusResponse {
  id: string;
  targetUrl: string;
  targetHost: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  currentStage: string;
  score?: number;
  events: ScanEventRecord[];
  errorMessage?: string;
  createdAt: string;
}

const STAGES_ORDER = [
  { key: "url_validation", label: "URL & SSRF Safety Guard" },
  { key: "network_probes", label: "DNS & TLS Protocol Probes" },
  { key: "crawling", label: "Discovery Crawling (12 Pages)" },
  { key: "browser_capture", label: "Browser Capture & DOM Rendering" },
  { key: "consent_testing", label: "Consent & Cookie Isolation" },
  { key: "detectors_running", label: "Deterministic Check Suite" },
  { key: "rules_evaluating", label: "Rules Engine & Readiness Scoring" },
  { key: "generating_reports", label: "Report & PDF Packaging" },
];

export default function ScanProgressPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = use(params);
  const router = useRouter();

  const [scanData, setScanData] = useState<ScanStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState(2000); // 2s baseline polling

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isActive = true;

    async function pollScanStatus() {
      try {
        const res = await fetch(`/api/scan/${scanId}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(`Scan with ID ${scanId} was not found.`);
          }
          throw new Error("Unable to fetch scan status.");
        }

        const data: ScanStatusResponse = await res.json();
        if (!isActive) return;

        setScanData(data);

        // If completed, navigate to results page
        if (data.status === "completed") {
          setTimeout(() => {
            router.push(`/scan/${scanId}/results`);
          }, 800);
          return;
        }

        // If failed, stop polling
        if (data.status === "failed") {
          return;
        }

        // Adaptive polling with slight backoff on identical state
        timeoutId = setTimeout(pollScanStatus, pollInterval);
      } catch (err: any) {
        if (!isActive) return;
        setError(err.message);
        // Exponential backoff up to 8s on network glitches
        const nextInterval = Math.min(pollInterval * 1.5, 8000);
        setPollInterval(nextInterval);
        timeoutId = setTimeout(pollScanStatus, nextInterval);
      }
    }

    pollScanStatus();

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [scanId, router, pollInterval]);

  // Determine stage progress percentage
  const currentStageKey = scanData?.currentStage ?? "initializing";
  const stageIndex = STAGES_ORDER.findIndex((s) => s.key === currentStageKey);
  const progressPercent =
    scanData?.status === "completed"
      ? 100
      : stageIndex >= 0
      ? Math.round(((stageIndex + 1) / STAGES_ORDER.length) * 95)
      : 15;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />

      <main className="flex-1 py-12 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Header & Target Info */}
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              Live Engine Execution
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Scanning Website
            </h1>
            <p className="text-sm font-mono text-slate-400 break-all">
              {scanData?.targetUrl || "Connecting to target..."}
            </p>
          </div>

          {/* Connection Error Card */}
          {!scanData && error && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 space-y-2 text-xs text-amber-300">
              <div className="font-bold text-sm text-white">Connection Delay</div>
              <p>{error}. Retrying connection...</p>
            </div>
          )}

          {/* Failed Scan Card */}
          {scanData?.status === "failed" && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Scan Execution Terminated</h3>
                  <p className="text-xs text-rose-300">
                    {scanData.errorMessage || "The scan encountered an unrecoverable safety or network boundary."}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Link
                  href="/#scan-form"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
                >
                  Try Another Target URL
                </Link>
                <Link
                  href="/"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Return to Home
                </Link>
              </div>
            </div>
          )}

          {/* Active Progress Card */}
          {scanData?.status !== "failed" && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-6">
              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    Executing Diagnostics Pipeline
                  </span>
                  <span>{progressPercent}% Complete</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Stage Indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {STAGES_ORDER.map((stage, idx) => {
                  const isPast = stageIndex > idx || scanData?.status === "completed";
                  const isCurrent = stageIndex === idx && scanData?.status !== "completed";

                  return (
                    <div
                      key={stage.key}
                      className={`p-3 rounded-lg border text-xs flex items-center gap-3 transition-colors ${
                        isPast
                          ? "bg-slate-950/40 border-slate-800 text-slate-300"
                          : isCurrent
                          ? "bg-indigo-950/40 border-indigo-500/50 text-white"
                          : "bg-slate-950/20 border-slate-900 text-slate-600"
                      }`}
                    >
                      <div className="shrink-0">
                        {isPast ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : isCurrent ? (
                          <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </div>
                        )}
                      </div>
                      <span className="font-medium">{stage.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Genuine Real-time Event Stream */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              Observed Engine Event Stream
            </h3>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-2 font-mono text-[11px]">
              {scanData?.events && scanData.events.length > 0 ? (
                scanData.events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5 text-slate-300"
                  >
                    <span className="text-slate-500 shrink-0">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-indigo-400 shrink-0 font-semibold">[{ev.stage}]</span>
                    <span className="text-slate-300 break-all">{ev.message}</span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500 text-xs">
                  Initializing engine pipeline...
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

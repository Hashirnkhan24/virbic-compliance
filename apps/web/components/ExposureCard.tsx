import type { ExposureSummary } from "@vibe/contracts";

interface ExposureCardProps {
  exposure: ExposureSummary;
}

export function ExposureCard({ exposure }: ExposureCardProps) {
  if (!exposure || !exposure.hasExposure) {
    return (
      <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-400 text-xs">
        <div className="flex items-center gap-2 text-emerald-400 font-medium mb-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          No direct financial exposure models triggered
        </div>
        <p className="text-slate-400">
          None of the issues observed on this site currently match a confirmed statutory penalty model or paid commercial exposure threshold.
        </p>
      </div>
    );
  }

  // Format currency in Indian Lakhs/Crores
  const formatInr = (val: number) => {
    if (val >= 10_000_000) {
      return `₹${(val / 10_000_000).toFixed(1)} Cr`;
    }
    if (val >= 100_000) {
      return `₹${(val / 100_000).toFixed(1)} Lakh`;
    }
    return `₹${val.toLocaleString("en-IN")}`;
  };

  const hasDirectCost = exposure.minDirectCostInr > 0 || exposure.maxDirectCostInr > 0;
  const hasStatutoryMax = exposure.statutoryMaxInr > 0;

  // Format regimes into human-friendly names
  const regimeNames: Record<string, string> = {
    india: "India (DPDP Act)",
    eu: "European Union (GDPR)",
    us: "United States (CCPA / State Privacy)",
  };

  const formattedRegimes = exposure.applicableRegimes
    .map((r) => regimeNames[r.toLowerCase()] || r.toUpperCase())
    .join(", ");

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-7 space-y-6">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
            Financial & Regulatory Overview
          </span>
        </div>
        <h3 className="text-lg font-bold text-white tracking-tight">
          Estimated resolution cost & statutory penalty caps
        </h3>
        <p className="text-xs text-slate-400">
          Based on your confirmed user regions:{" "}
          <span className="text-slate-200 font-medium">{formattedRegimes}</span>.
          (Hosting location alone does not govern legal applicability.)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Estimated Developer Fix Cost */}
        <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
          <span className="text-xs font-semibold text-slate-300 block">
            Estimated Developer Effort to Fix
          </span>
          <div className="text-2xl font-bold text-white">
            {hasDirectCost ? (
              `${formatInr(exposure.minDirectCostInr)} – ${formatInr(exposure.maxDirectCostInr)}`
            ) : (
              <span className="text-base font-normal text-slate-400">
                Cannot be reliably estimated
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Typical engineering or agency time required to implement the fixes identified in this scan.
          </p>
        </div>

        {/* Statutory Regulatory Ceiling */}
        <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
          <span className="text-xs font-semibold text-slate-300 block">
            Maximum Legal Penalty Cap
          </span>
          <div className="text-2xl font-bold text-rose-300">
            {hasStatutoryMax ? (
              `Up to ${formatInr(exposure.statutoryMaxInr)}`
            ) : (
              <span className="text-base font-normal text-slate-400">
                No statutory penalty model applies
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            The legal maximum written into the applicable statutes. This is a legislative ceiling, not an automatic or expected penalty.
          </p>
        </div>
      </div>

      {/* Transparent Explanation Note */}
      <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/60 text-[11px] text-slate-400 flex items-start gap-2.5">
        <svg
          className="w-4 h-4 text-slate-400 shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="leading-relaxed">
          <strong>How these figures work:</strong> Statutory figures represent official legislative ceilings under laws like DPDP or GDPR, never summed across correlated issues. Fix costs represent benchmarked developer time. Neither figure constitutes legal advice or an assessment of enforcement likelihood.
        </span>
      </div>
    </div>
  );
}

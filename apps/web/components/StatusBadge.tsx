import type { CheckStatus, Severity } from "@vibe/contracts";

interface StatusBadgeProps {
  status: CheckStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "passed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Passed
        </span>
      );
    case "issue_found":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          Issue Found
        </span>
      );
    case "not_applicable":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Not Applicable
        </span>
      );
    case "unable_to_verify":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Unable to Verify
        </span>
      );
    default:
      return null;
  }
}

interface SeverityBadgeProps {
  severity: Severity | null | undefined;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  if (!severity) return null;

  switch (severity) {
    case "critical":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30">
          Critical Risk
        </span>
      );
    case "high":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-orange-600/20 text-orange-400 border border-orange-500/30">
          High Risk
        </span>
      );
    case "medium":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-600/20 text-amber-400 border border-amber-500/30">
          Medium Risk
        </span>
      );
    case "low":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-sky-600/20 text-sky-400 border border-sky-500/30">
          Low Risk
        </span>
      );
    case "info":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-600/20 text-slate-300 border border-slate-500/30">
          Observation
        </span>
      );
    default:
      return null;
  }
}

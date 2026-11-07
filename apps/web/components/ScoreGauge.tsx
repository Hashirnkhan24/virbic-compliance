interface ScoreGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function ScoreGauge({ score, size = "md", showLabel = true }: ScoreGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  // Determine color and status text
  let colorClass = "text-emerald-400 stroke-emerald-500";
  let bgClass = "bg-emerald-500/10 border-emerald-500/20";
  let label = "High Launch Readiness";
  let subtitle = "Low critical launch risk observed";

  if (clampedScore < 50) {
    colorClass = "text-rose-400 stroke-rose-500";
    bgClass = "bg-rose-500/10 border-rose-500/20";
    label = "Significant Risks Observed";
    subtitle = "Remediation recommended prior to public launch";
  } else if (clampedScore < 75) {
    colorClass = "text-amber-400 stroke-amber-500";
    bgClass = "bg-amber-500/10 border-amber-500/20";
    label = "Pre-Launch Review Advised";
    subtitle = "Moderate issues found across core compliance checks";
  } else if (clampedScore < 90) {
    colorClass = "text-indigo-400 stroke-indigo-500";
    bgClass = "bg-indigo-500/10 border-indigo-500/20";
    label = "Good Launch Readiness";
    subtitle = "Minor issues detected; ready for final review";
  }

  // Dimensions
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  const sizeClasses = {
    sm: "w-28 h-28",
    md: "w-40 h-40",
    lg: "w-52 h-52",
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className={`relative ${sizeClasses[size]} flex items-center justify-center`}>
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 128 128">
          {/* Background circle */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            className="stroke-slate-800"
            strokeWidth="10"
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            className={`${colorClass} transition-all duration-1000 ease-out`}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            {clampedScore}
          </span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            / 100 Score
          </span>
        </div>
      </div>

      {showLabel && (
        <div className="mt-4">
          <div
            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${bgClass} ${colorClass.split(" ")[0]}`}
          >
            {label}
          </div>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs">{subtitle}</p>
        </div>
      )}
    </div>
  );
}

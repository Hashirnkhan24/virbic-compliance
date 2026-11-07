export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950/80 text-slate-400 text-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base">Vibe Compliance Checker</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Engine v1.0.0
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              URL-first pre-launch & pre-handover website risk scanner. Designed for SaaS founders
              verifying launch readiness and web development agencies preparing client handovers.
            </p>
            <div className="text-[11px] text-slate-500 space-y-1 pt-2">
              <p>
                <strong>Important Legal & Regulatory Notice:</strong> This scanner is an automated
                diagnostic tool and does NOT provide legal advice, regulatory certification,
                compliance guarantees, or a comprehensive cybersecurity penetration test.
              </p>
              <p>
                Every finding references observed evidence. Missing or blocked evidence is marked as{" "}
                <code className="text-slate-400">unable_to_verify</code> and is never interpreted as
                passed.
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
              Scan Modules (Wave 1)
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="text-slate-400">Privacy & Consent (DPDP, GDPR)</li>
              <li className="text-slate-400">Cookie Banner & Tracker Blocker</li>
              <li className="text-slate-400">Web Accessibility (WCAG 2.1 AA)</li>
              <li className="text-slate-400">Security Headers & SSL/TLS</li>
              <li className="text-slate-400">Legal Policies & Grievance Contact</li>
              <li className="text-slate-400">Third-Party Scripts & Assets</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
              Governance
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="text-slate-400">India: DPDP Act 2023 & IT Act</span>
              </li>
              <li>
                <span className="text-slate-400">European Union: GDPR & ePrivacy</span>
              </li>
              <li>
                <span className="text-slate-400">United States: CCPA/CPRA & FTC</span>
              </li>
              <li className="pt-2 text-[11px] text-slate-500">
                Statutory maximums and direct cost models are sourced from official legislation and
                never summed across correlated risks.
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800/60 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} Vibe Compliance Scanner. Built with Next.js App Router.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              All 41 Wave 1 Checks Active
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

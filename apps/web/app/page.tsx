import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { UrlSubmitForm } from "@/components/UrlSubmitForm";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-32 border-b border-slate-800/60">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))]" />
          
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              40 Pre-Launch Checks • AI Fixing Kit Included
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Pre-Launch Website Risk Audit
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400 bg-clip-text text-transparent">
                With Ready-To-Use AI Fixing Prompts
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Find privacy, consent, accessibility, security, and policy risks before you launch.
              Hand structured, step-by-step prompts straight to Cursor, Claude Code, Antigravity, or your developer.
            </p>

            <div id="scan-form" className="pt-4">
              <UrlSubmitForm />
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>No signup or credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Zero DOM pollution / passive crawling</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Evidence-backed scoring (0–100)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Who It's For Section */}
        <section id="who-its-for" className="py-20 border-b border-slate-800/60 bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                Audience & Workflows
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-white">
                One Shared Engine. Two Tailored Perspectives.
              </h2>
              <p className="text-sm text-slate-400">
                Whether you are launching your own SaaS or handing over a completed site to a client,
                the engine runs the same evidence-backed checks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* SaaS Founder Card */}
              <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all space-y-5">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">SaaS Founder Launch Report</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Eliminate compliance blockers before launching on Product Hunt, onboarding customers, or submitting to Stripe and Razorpay.
                  </p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span><strong>Payment Gateway Readiness:</strong> Verify mandatory refund, shipping, contact, and terms policies required for Stripe and Razorpay onboarding.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold">✓</span>
                    <span><strong>AI Fixing Kit:</strong> Ready-to-paste prompts for Cursor, Claude Code, or Antigravity with acceptance criteria and constraints.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span><strong>Security & Secret Leaks:</strong> Flag accidental public API keys, missing security headers, and exposed source maps.</span>
                  </li>
                </ul>
              </div>

              {/* Agency Handover Card */}
              <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all space-y-5">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Agency Client Handover Report</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Deliver a documented, professional audit at final milestone signoff to prove quality, prevent scope disputes, and protect client relationships.
                  </p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">✓</span>
                    <span><strong>Pre-Handover Verification:</strong> Catch broken links, missing alt tags, contrast issues, and dummy placeholder text.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">✓</span>
                    <span><strong>Formal Sign-Off Documentation:</strong> Export branded Chromium PDF with audit timestamp and ruleset version for contracts.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">✓</span>
                    <span><strong>Boundary Distinction:</strong> Clearly separate technical site quality observations from client-responsibility legal policies.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 border-b border-slate-800/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Engine Architecture
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-white">
                How The Scan Operates
              </h2>
              <p className="text-sm text-slate-400">
                Built on the principle: <em>Capture once, snapshot many, score strictly from evidence</em>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
                <span className="text-2xl font-black text-indigo-500">01</span>
                <h4 className="font-bold text-white text-base">SSRF & URL Guard</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Target URL is validated with strict DNS resolution to prevent internal network leaks, metadata endpoint probing, and credential injection.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
                <span className="text-2xl font-black text-sky-500">02</span>
                <h4 className="font-bold text-white text-base">Headless Browser Capture</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Crawls public pages and spins isolated browser sessions to observe real DOM, network requests, security headers, cookies, and consent banners.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
                <span className="text-2xl font-black text-emerald-500">03</span>
                <h4 className="font-bold text-white text-base">Deterministic Detectors</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  41 checks evaluate the snapshot. Statuses are strictly <code>passed</code>, <code>issue_found</code>, <code>not_applicable</code>, or <code>unable_to_verify</code>.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
                <span className="text-2xl font-black text-amber-500">04</span>
                <h4 className="font-bold text-white text-base">Evidence-Backed Scoring</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Weighted score (0–100) calculated solely from applicable issues. Missing evidence never means pass. Source-backed statutory exposure attached.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Limitations & Scope Section */}
        <section id="limitations" className="py-20 bg-slate-900/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
                Transparent Boundaries
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-white">
                Automated Scanning Scope & Limitations
              </h2>
              <p className="text-sm text-slate-400">
                We believe in total honesty about what automated tools can and cannot prove.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Not Legal Advice or Regulatory Certification
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  This scanner identifies observable patterns, missing policy clauses, unmanaged cookies, and accessibility flags. It cannot replace qualified legal counsel, privacy officer signoff, or an official audit.
                </p>
              </div>

              <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Passive Diagnostics Only
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The scanner does not submit contact forms, perform credential stuffing, bypass paywalls, test authenticated dashboards, or conduct destructive penetration testing.
                </p>
              </div>

              <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Jurisdiction Depends on User Confirmation, Not IP Geolocation
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  A website hosted on AWS US-East may serve users in Mumbai or Berlin. We never infer legal applicability purely from server IP; customer-confirmed target regions govern which laws apply.
                </p>
              </div>

              <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  No False Passes: Missing Evidence Means Unable to Verify
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  If Cloudflare challenges our crawler, or a page times out, the check status becomes <code>unable_to_verify</code>. We never assume missing evidence equals compliance.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

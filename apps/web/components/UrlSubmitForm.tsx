"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { Jurisdiction } from "@vibe/contracts";

export function UrlSubmitForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>(["india"]);
  const [authAcknowledged, setAuthAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleJurisdiction = (jur: Jurisdiction) => {
    if (jurisdictions.includes(jur)) {
      if (jurisdictions.length > 1) {
        setJurisdictions(jurisdictions.filter((j) => j !== jur));
      }
    } else {
      setJurisdictions([...jurisdictions, jur]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let cleanUrl = url.trim();
    if (!cleanUrl) {
      setError("Please enter a website URL.");
      return;
    }

    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = `https://${cleanUrl}`;
    }

    if (!authAcknowledged) {
      setError("You must confirm authorisation to scan this website.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: cleanUrl,
          authorisationAcknowledged: true,
          jurisdictions,
          mode: "passive",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to initiate scan.");
      }

      // Redirect to live progress page
      router.push(`/scan/${data.scanId}`);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/30 text-left space-y-6"
    >
      <div>
        <label htmlFor="target-url" className="block text-sm font-semibold text-slate-200 mb-2">
          Target Website URL
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
          </div>
          <input
            id="target-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="example.com or https://app.yoursite.com"
            disabled={loading}
            className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono transition-all"
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Passive scanner crawls up to 12 same-origin public pages. No forms submitted, no credentials used.
        </p>
      </div>

      <div>
        <span className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2.5">
          Select Applicable Regulatory Regimes
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <label
            className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
              jurisdictions.includes("india")
                ? "bg-indigo-600/15 border-indigo-500 text-white"
                : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <input
              type="checkbox"
              checked={jurisdictions.includes("india")}
              onChange={() => toggleJurisdiction("india")}
              className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="text-xs">
              <span className="font-semibold block text-slate-200">India</span>
              <span className="text-[10px] text-slate-400">DPDP Act, IT Act</span>
            </div>
          </label>

          <label
            className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
              jurisdictions.includes("eu")
                ? "bg-indigo-600/15 border-indigo-500 text-white"
                : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <input
              type="checkbox"
              checked={jurisdictions.includes("eu")}
              onChange={() => toggleJurisdiction("eu")}
              className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="text-xs">
              <span className="font-semibold block text-slate-200">European Union</span>
              <span className="text-[10px] text-slate-400">GDPR, ePrivacy</span>
            </div>
          </label>

          <label
            className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
              jurisdictions.includes("us")
                ? "bg-indigo-600/15 border-indigo-500 text-white"
                : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <input
              type="checkbox"
              checked={jurisdictions.includes("us")}
              onChange={() => toggleJurisdiction("us")}
              className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="text-xs">
              <span className="font-semibold block text-slate-200">United States</span>
              <span className="text-[10px] text-slate-400">CCPA/CPRA, FTC</span>
            </div>
          </label>
        </div>
      </div>

      <div className="pt-1">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={authAcknowledged}
            onChange={(e) => setAuthAcknowledged(e.target.checked)}
            className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-xs text-slate-400 leading-normal">
            I confirm I am authorised to initiate diagnostic compliance scanning on this website. I
            understand this is a passive diagnostic tool and not legal advice or a compliance guarantee.
          </span>
        </label>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
          <svg className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Initiating Engine & URL Guard...</span>
          </>
        ) : (
          <>
            <span>Launch Free Compliance Scan</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </>
        )}
      </button>
    </form>
  );
}

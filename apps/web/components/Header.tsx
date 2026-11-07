import Link from "next/link";
import { APP_CONFIG } from "@/lib/constants";

export function Header() {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight text-white">
                {APP_CONFIG.name}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {APP_CONFIG.checksCount} Pre-launch checks
              </span>
            </div>
            <span className="text-xs text-slate-400 block">
              {APP_CONFIG.tagline}
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-xs text-slate-300 font-medium">
          <Link href="/#how-it-works" className="hover:text-white transition-colors">
            How it works
          </Link>
          <Link href="/#who-its-for" className="hover:text-white transition-colors">
            Who it's for
          </Link>
          <Link href="/#limitations" className="hover:text-white transition-colors">
            Limitations
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/#scan-form"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-600/30 transition-all"
          >
            Run free scan
          </Link>
        </div>
      </div>
    </header>
  );
}

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { UrlSubmitForm } from "@/components/UrlSubmitForm";

export default function ScanSubmissionPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />

      <main className="flex-1 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            <span>Launch Readiness Diagnostic</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Initiate Website Compliance & Risk Scan
          </h1>

          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Enter your public website or staging URL. Our URL Guard validates destination safety
            before beginning passive multi-page capture.
          </p>

          <div className="pt-6">
            <UrlSubmitForm />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

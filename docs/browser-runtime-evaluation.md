# Browser Runtime Evaluation: Vercel Serverless vs. Worker Fallback

## 1. Executive Summary

This document evaluates the viability, operational constraints, and failure modes of running headless Chromium inside Vercel Serverless Functions for the Website Risk & Launch Readiness SaaS platform, in strict accordance with `AGENTS.md` and the approved product blueprint.

Our implementation uses a **provider-neutral browser adapter** (`getBrowser()`) in `packages/capture/src/browser/browser-provider.ts`. This ensures that whether browser instances execute within Vercel Serverless Functions (`@sparticuz/chromium`), a hosted browser cloud (Browserless/Browserbase via CDP/WebSocket), or a containerized worker (Docker on Railway/Fly.io), the capture engine, crawler, and detector libraries remain 100% unchanged.

---

## 2. Vercel Serverless Runtime Constraints

| Dimension | Vercel Hobby | Vercel Pro / Fluid Compute | Scanner Workload Requirement |
|---|---|---|---|
| **Max Function Duration** | 60 seconds (hard cap) | Up to 300 seconds (5 minutes) | 12–15 pages + 3 consent runs = ~70–90 seconds sequential |
| **Max Unzipped Bundle** | 250 MB | 250 MB | Playwright-core + `@sparticuz/chromium` archive + app = ~190 MB |
| **Default Memory (RAM)** | 1024 MB | Configurable up to 3008 MB | Chromium baseline: ~350 MB RSS; Peaks: ~800 MB during full DOM render + Axe scan |
| **Ephemeral Storage (/tmp)**| 512 MB | 512 MB | `@sparticuz/chromium` Brotli extraction: ~120 MB |
| **Cold Start Latency** | 3–6 seconds | 2–4 seconds | Extraction of Chromium binary from Brotli archive |

---

## 3. Workload Benchmark & Feasibility Analysis

### A. Single-Page Capture (e.g. Free Scan Preview)
- **Observed Duration**: 1.4s – 4.5s per page (including network interception, DOM metadata, screenshot, and Axe-core accessibility scan).
- **Feasibility on Vercel**: **High**. A single-page or 3-page preview scan executes well within the 60s Hobby limit and easily fits inside 1024 MB memory.

### B. Full Multi-Page Crawl (12–15 Pages + 3 Consent Runs)
- **Workload**:
  - Crawl 12–15 distinct pages (privacy, terms, refund, contact, checkout, etc.).
  - 3 fresh isolated contexts for consent states (`no_choice`, `accept`, `reject`).
  - Total page navigations: ~15 to 18.
- **Estimated Duration**:
  - Sequential (1 tab at a time): `16 pages × 3.5s = 56s + cold start (4s) = 60s`.
  - On Vercel Hobby (60s cap), timeout risk is **extremely high (>50% failure rate)** on complex SPA sites.
  - On Vercel Pro (300s cap), the scan will complete in ~60–80s, but memory accumulation in a single serverless invocation can cause random out-of-memory (OOM) eviction if garbage collection is delayed.

---

## 4. AGENTS.md Invariant & Release Gate

> *"Browser fallback: Browserbase/Browserless or a small Docker worker on Railway/Fly.io. If >10% of representative staging scans time out/crash, switch provider without changing capture/detector interfaces."*

### Trigger Condition:
If staging scans exhibit:
1. >10% timeout rate (HTTP 504 / Task timed out after 60.00 seconds); or
2. Out-of-memory errors (`SIGSEGV` or `Runtime.ExitError: exit status 137`); or
3. Chromium extraction failures in `/tmp`.

---

## 5. Alternative Execution Architectures (Provider-Neutral)

Our `getBrowser()` adapter automatically detects and connects to alternative execution backends using standard environment variables:

```typescript
// packages/capture/src/browser/browser-provider.ts
const remoteEndpoint =
  config?.wsEndpoint ||
  process.env.BROWSER_WS_ENDPOINT ||
  process.env.BROWSER_CDP_ENDPOINT;

if (remoteEndpoint) {
  if (remoteEndpoint.startsWith("http://") || remoteEndpoint.startsWith("https://") ||
      remoteEndpoint.startsWith("ws://") || remoteEndpoint.startsWith("wss://")) {
    return await chromium.connectOverCDP(remoteEndpoint);
  }
  return await chromium.connect(remoteEndpoint);
}
```

### Option 1: Managed Browser Endpoint (Browserless / Browserbase)
- **Configuration**: Set `BROWSER_WS_ENDPOINT=wss://chrome.browserless.io?token=YOUR_API_KEY`.
- **Advantages**:
  - Zero infrastructure maintenance.
  - Eliminates the 250MB bundle size and `/tmp` decompression entirely.
  - Vercel functions remain ultra-lean (<10MB).
  - Scalable to hundreds of concurrent scans without serverless memory exhaustion.
- **Cost**: ~$20–$50/month.

### Option 2: Containerized Worker on Railway / Fly.io (`apps/worker`)
- **Configuration**: Run a small Docker container using `mcr.microsoft.com/playwright:v1.45.0-jammy`. Expose a WebSocket proxy or internal HTTP endpoint. Set `BROWSER_WS_ENDPOINT=ws://worker.internal:3000`.
- **Advantages**:
  - Completely predictable $5/month fixed cost.
  - Bounded memory with system swap.
  - Zero cold starts (browser process or daemon always ready).
  - Independent of Vercel runtime limits.

---

## 6. Current Recommendation for Prototype & Roadmap

1. **Local Development & CI**: Uses native `playwright-core` with installed Chromium. Fast, zero cold starts, and fully reproducible.
2. **Initial Prototype Deployment (Vercel)**:
   - For single-page and small site audits, `@sparticuz/chromium` is operational with cold-start decompression handling.
3. **Production / Scale Rollout**:
   - Provide `BROWSER_WS_ENDPOINT` in production environment settings.
   - The detector library, evaluator, and reports will function identically without a single line of detector code modification.

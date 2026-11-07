# Website Risk & Launch Readiness SaaS (Monorepo)

Production-ready website risk scanning platform built with Next.js App Router, TypeScript, and a modular architecture.

---

## Architecture & Monorepo Structure

This project is organized as a `pnpm` monorepo adhering strictly to the *"Capture Once, Snapshot Many"* architecture:

```
├── apps/
│   └── web/            # Next.js App Router (UI, Marketing, and API Routes)
├── packages/
│   ├── contracts/      # Shared Zod schemas (API, Snapshots, Results)
│   ├── db/             # Drizzle ORM schemas, Neon connection & migrations
│   ├── capture/        # URL guard, Crawler, Browser runner & Consent runner
│   ├── detectors/      # Pure detector functions for all 75 checks
│   ├── rules/          # Check registry, evaluators, wave flags
│   ├── exposure/       # Source-backed statutory & operational risk models
│   ├── fixes/          # Reviewed remediation templates
│   ├── reports/        # HTML & Chromium print-to-PDF generation
│   └── ai/             # Minimal, quote-verified LLM adapter (Wave 3 paid only)
└── docs/               # Blueprint specifications and AGENTS.md instructions
```

---

## Prerequisites

- **Node.js**: `v20.x` or `v22.x`
- **pnpm**: `v10.x` or `v11.x`

---

## Local Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `apps/web/.env.local`:
   ```bash
   cp .env.example apps/web/.env.local
   ```

3. **Run Type Checks across all workspaces:**
   ```bash
   pnpm typecheck
   ```

4. **Run Linter across all workspaces:**
   ```bash
   pnpm lint
   ```

5. **Start Development Server:**
   ```bash
   pnpm dev
   ```
   The application will be live at `http://localhost:3000`.

---

## Verification Endpoints

- **Health Check API**: `http://localhost:3000/api/health`
  Returns:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-11-05T07:01:57.416Z",
    "uptime": 20.46,
    "version": "0.1.0",
    "environment": "development"
  }
  ```

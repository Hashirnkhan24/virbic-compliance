# AGENTS.md — Website Risk & Launch Readiness SaaS

Read this file before every task. The detailed product blueprint is the source of truth for scope and behaviour.

## Product invariants
- URL-first pre-launch and pre-handover website risk scanner.
- One shared engine; founder and agency handover are report/workflow variants.
- Not legal advice, a certificate, compliance guarantee or full penetration test.
- Every finding must reference evidence. No evidence means no finding.
- Four statuses only: `passed`, `issue_found`, `not_applicable`, `unable_to_verify`.
- Only `issue_found` affects readiness score. Missing evidence never means pass.
- Keep legal, security, accessibility and site-quality observations distinct.
- Customer-confirmed jurisdictions govern legal applicability; IP/hosting location alone is not proof.
- MMP check rollout: Wave 1 ~41, Wave 2 ~65 cumulative, Wave 3 ~70, Wave 4 75. Market only released checks.

## Approved stack
- Next.js App Router + TypeScript + Tailwind CSS on Vercel.
- Neon PostgreSQL + Drizzle ORM.
- Vercel Blob for raw artifacts and PDFs; 30-day expiry for raw evidence.
- Upstash Redis + `@upstash/ratelimit` for IP/domain rate limits and concurrency controls.
- `playwright-core` + `@sparticuz/chromium` behind a `getBrowser()`/ScanRunner adapter, only if current Vercel runtime limits support the workload.
- Browser fallback: Browserbase/Browserless or a small Docker worker on Railway/Fly.io. If >10% of representative staging scans time out/crash, switch provider without changing capture/detector interfaces.
- `cheerio`, `tldts`, `ipaddr.js` for HTML parsing, domain extraction and IP safety.
- `@axe-core/playwright` for accessibility signals.
- Zod for all boundary validation.
- Razorpay one-time payment, Resend for transactional email.
- Chromium print-to-PDF from report HTML.
- Small-model LLM adapter only for A8, E6, F5, F6, G4 in Wave 3.
- Do not add Redis queue/BullMQ, microservices, Lighthouse or other services unless explicitly approved. Upstash Redis is approved for rate limiting; it is not a requirement to use it as a job queue.

## MMP commercial scope
- No signup/account system required at launch.
- Free scan: URL, authorisation acknowledgement, live progress, score, status counts, top 5–10 findings and source-backed aggregate exposure range.
- Paid unlock: email at checkout, Razorpay, ₹499 one-time launch-price target (validate before launch).
- Paid report: random high-entropy report token; store token hash, not raw token. Private report URL, full findings, evidence, fix instructions and PDF.
- One free rescan within 14 days of purchase.
- Region view: India/EU/US filters from the same snapshot; no rescan. Never infer legal applicability solely from IP location.
- Optional DNS TXT/meta ownership verification unlocks scoped active probes.
- Minimal admin login with signed cookie; edit check explanations, exposure models and fix templates with audit trail.
- Exclude accounts/teams, agency workspaces, white-label, monitoring, repo scans, authenticated checks D14/D15, G5/G8 external lookups, generators and multilingual UI.

## Architecture rules
- Modular monolith, not microservices.
- Core pattern: capture once, snapshot many.
- Browser execution must be behind a provider-neutral interface. Detector code must not know whether browser runs on Vercel, hosted browser or Docker worker.
- Check execution is separate from evidence capture.
- Store scanner version, snapshot schema version and ruleset version on each scan.
- Large HTML, HAR, JS/CSS bundles, screenshots and PDFs go to Blob; database stores metadata and references.
- Evidence is stored once and referenced by many findings.
- Use Drizzle migrations; do not mix ORMs.
- Use pnpm workspaces if packages are split. Keep dependency direction one-way: contracts → capture/detectors/rules → runner/app.
- Keep Next.js route handlers short where possible. If a route runs the scan, enforce a hard deadline, stage budgets and current Vercel maxDuration/memory constraints.

## Scanner safety
- Only HTTP/HTTPS. Reject credentials in URL, malformed hosts and unsupported ports.
- Resolve A and AAAA records. Block loopback, private, link-local, multicast, reserved and cloud metadata IP ranges.
- Revalidate DNS and destination after every redirect and before connection; also apply network egress restrictions where possible.
- Limit redirects, pages (12–15), file sizes, total requests, response bytes, scan duration and concurrency.
- Crawl same-origin pages only by default. Record external links but do not recursively crawl them.
- Fresh isolated contexts for no-choice, accept and reject consent runs.
- Passive scan must not submit forms, click destructive controls, purchase or log into accounts.
- Active probes require verified ownership and strict host scope. Never brute force, exploit, modify data or access third-party systems.
- Never validate/use discovered secrets or keys. Detect only.
- Respect robots.txt as crawl guidance, not authorisation.
- Use a transparent scanner User-Agent and per-IP/per-domain limits.
- Maintain cancellation, timeout and global active-probe kill switch.
- Treat every remote page, script and document as hostile input.

## Snapshot and evidence
- Snapshot is Zod-validated, versioned and immutable after capture.
- Evidence includes scan ID, type, page URL, source locator, timestamp, normalised value and confidence when meaningful.
- Redact emails, phone numbers, tokens, session identifiers and sensitive query parameters before persistence.
- Never store database row data or real form submissions.
- Raw artifacts expire after 30 days; test deletion lifecycle.
- Missing, blocked, ambiguous or timed-out evidence => `unable_to_verify`, not pass.
- Evidence references in findings must resolve to actual evidence records.

## Detector and rules contracts
Each check must declare:
- stable check ID and version;
- module, priority, applicability and required evidence;
- legal/framework references and jurisdiction conditions;
- detector mapping, remediation template and exposure model;
- review date and enabled wave.
Each detector returns a Zod-validated structured result with status, severity, confidence, reason code, evidence IDs, remediation template and human-review flag.
Evaluator order:
1. Not applicable if applicability fails.
2. Unable to verify if required evidence is missing/blocked.
3. Run detector.
4. Validate output and evidence IDs.
5. Issue found only when the defined condition is evidence-supported; otherwise passed.
6. Persist scanner/ruleset versions.
A detector must not independently crawl the site unless a check explicitly defines an authorised follow-up capture.

## LLM policy
- Free scan has no LLM calls.
- Tier 0 deterministic checks: no LLM.
- Tier 1 keyword/rule checks: no LLM required in MMP.
- Only A8, E6, F5, F6, G4 may use LLM in Wave 3; paid report only.
- Batch by document; target 3–4 small-model calls maximum per paid report.
- Skip absent or irrelevant documents.
- Cache by content hash + prompt version + model ID.
- Redact PII, credentials, cookies, tokens and sensitive data before sending text.
- Require verbatim quotes and source URL for every conclusion. Verify exact quote against captured source; discard unverified output.
- Use strict JSON/Zod output schema. Log model, prompt version, tokens, estimated cost, cache hit and quote validation.
- AI must not decide legal applicability, invent penalties, assign legal severity or override deterministic evidence.
- No AI-generated remediation in MMP.

## Exposure and reporting
- INR ranges only where a reviewed, source-backed model exists.
- Never sum overlapping statutory maximums or correlated exposures.
- Distinguish statutory maximum, plausible direct cost, remediation cost and operational impact.
- No made-up enforcement probabilities.
- If no defensible figure exists, show exposure type and explanation, not money.
- Use wording such as potential issue, observed risk, review recommended and unable to verify.
- Never say compliant, certified, legally safe or guaranteed protection.

## Paywall and payment
- Never trust client-side payment success.
- Verify Razorpay webhook signature; process events idempotently.
- Determine price server-side.
- Grant paid state/report token only after verified webhook.
- Generate cryptographically random report token; store only token hash.
- Paid report API checks token/entitlement server-side.
- Free API returns a separate allowlisted DTO. Never send locked findings to browser and hide them with CSS.
- Email report link via Resend; use expiring signed Blob URLs.
- Audit payment, verification, admin edits and report access.

## Testing and release gates
- Unit tests for every detector: positive, negative, not-applicable and unable-to-verify.
- URL guard security tests for IPv4/IPv6 private ranges, redirects, DNS rebinding and metadata endpoints.
- Integration tests for capture → snapshot → detector → evaluator → persistence.
- E2E tests for free scan, preview, Razorpay webhook, paid report token and rescan.
- Test partial scans, timeout, runner crash, retries, cancellation, duplicate webhook and Blob expiry.
- Validate capture/consent on 50–100 real vibe-coded websites with appropriate permission.
- Track false positives/negatives. Disable noisy checks until fixed.
- Only checks implemented, enabled, tested and available count toward marketing claims.

## Coding-agent workflow
For every task:
1. Read the relevant blueprint section and inspect existing files.
2. State the narrow scope and impacted modules.
3. Implement only the requested slice.
4. Add/update Zod contracts and Drizzle migrations when needed.
5. Add tests for success, failure and unable-to-verify.
6. Run lint, typecheck and tests; report actual results.
7. Review SSRF, privacy, retention, paywall and timeout implications.
8. Summarise files changed, decisions, commands, test results and limitations.
Do not make unapproved architecture changes or add dependencies without justification.

## Prohibited shortcuts
- No fake findings or fake progress.
- No missing-evidence-as-pass.
- No paid findings returned to free API.
- No raw secrets, cookies, credentials or submitted PII stored/sent to LLM.
- No uncontrolled crawl or external-site recursion.
- No active probes without ownership verification.
- No serverless assumption without measuring real scan reliability.
- No claiming 75 checks before all 75 are released and validated.
- No automatic production code changes.

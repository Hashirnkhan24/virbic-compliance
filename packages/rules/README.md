# @vibe/rules

Rules Engine, Launch Readiness Scoring, and Evaluator for the Website Risk & Launch Readiness Scanner.

## Features

- **Enriched Check Registry**: Manages check metadata, priorities, legal references, and exposure mappings for Wave 1 (~41 checks).
- **Applicability Evaluation**: Strictly evaluates jurisdiction rules using confirmed customer choices (never infers legal obligations from IP address or hosting).
- **Evidence Validation**: Validates that all findings reference actual, resolvable evidence records with tamper-evident hashes. Missing evidence demotes issues to `unable_to_verify`.
- **Launch Readiness Scoring**: Deterministic 0–100 score with calibrated deductions per severity and confidence weighting.
- **Finding Prioritisation**: Multi-factor ranking to surface the highest-risk issues for free previews and paid reports.
- **Exposure Summarisation**: Integrates source-backed statutory exposure models with non-additive statutory caps.
- **Immutable Ruleset Versioning**: Attaches ruleset versions and timestamps to every evaluation.

For the mathematical formula and limitations, see [SCORING.md](./SCORING.md).

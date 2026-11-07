/**
 * @vibe/rules — Rules Engine & Launch Readiness Scoring
 *
 * Converts raw detector outputs into prioritised findings with a 0–100 readiness score.
 *
 * Architecture:
 *   contracts → detectors/exposure → rules → app
 *
 * This module owns:
 *   - Check registry (enriched metadata per check)
 *   - Applicability evaluation (jurisdiction-aware, never IP-based)
 *   - Evidence validation (every finding must reference resolvable evidence)
 *   - Severity mapping (weighted scoring)
 *   - Confidence handling (thresholds and adjustments)
 *   - Score calculation (documented formula)
 *   - Finding prioritisation (severity × confidence ordering)
 *   - Ruleset versioning (immutable per evaluation)
 */

export { RULESET_VERSION } from "./versioning";
export type { RulesetMetadata } from "./versioning";
export { CheckRegistry, WAVE_1_REGISTRY } from "./registry";
export type { CheckRegistryEntry } from "./registry";
export { ApplicabilityEvaluator } from "./applicability";
export type { ApplicabilityContext, ApplicabilityResult } from "./applicability";
export { EvidenceValidator } from "./evidence-validator";
export type { EvidenceValidationResult } from "./evidence-validator";
export {
  SEVERITY_WEIGHTS,
  SEVERITY_DEDUCTION_MAP,
  getSeverityWeight,
  getSeverityDeduction,
} from "./severity";
export {
  CONFIDENCE_THRESHOLDS,
  applyConfidenceAdjustment,
  meetsConfidenceThreshold,
} from "./confidence";
export { ScoreCalculator } from "./score";
export type { ScoreBreakdown, ScoredFinding } from "./score";
export { FindingPrioritiser } from "./prioritisation";
export type { PrioritisedFinding } from "./prioritisation";
export { RulesEngine } from "./engine";
export type { RulesEngineConfig, EvaluationResult } from "./engine";

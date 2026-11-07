/**
 * Ruleset Versioning
 *
 * Every evaluation run records the exact ruleset version used.
 * This enables reproducible scoring and audit trails.
 *
 * Version format: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes to scoring formula or check semantics
 * - MINOR: New checks added or severity recalibration
 * - PATCH: Bug fixes in evaluator logic
 */

/** Current ruleset version. Bump on every release that changes evaluation behaviour. */
export const RULESET_VERSION = "1.0.0" as const;

/** Immutable metadata recorded with every evaluation. */
export interface RulesetMetadata {
  /** Ruleset version used for this evaluation run */
  readonly rulesetVersion: string;
  /** Scanner version that produced the detector outputs */
  readonly scannerVersion: string;
  /** ISO 8601 timestamp of when the evaluation was performed */
  readonly evaluatedAt: string;
  /** Total number of registered checks at evaluation time */
  readonly totalRegisteredChecks: number;
  /** Total number of checks actually evaluated (after filtering) */
  readonly checksEvaluated: number;
  /** Snapshot schema version the detectors ran against */
  readonly snapshotSchemaVersion: string;
}

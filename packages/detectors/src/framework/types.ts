import type {
  SiteSnapshot,
  DetectorOutput,
  EvidenceType,
  EvidenceRecord,
  Jurisdiction,
} from "@vibe/contracts";

export type CheckModule =
  | "privacy"
  | "cookies"
  | "accessibility"
  | "security"
  | "legal"
  | "consumer"
  | "ip"
  | "quality"
  | "third_party";

export type CheckWave = "W1" | "W2" | "W3" | "W4";

export interface DetectionContext {
  scanId: string;
  jurisdictions?: Jurisdiction[];
  evidenceCollector: IEvidenceCollector;
  logger?: (level: "info" | "warn" | "error", message: string, meta?: any) => void;
}

export interface IEvidenceCollector {
  registerEvidence(
    type: EvidenceType,
    structuredValue: Record<string, any>,
    options?: {
      sourceLocator?: string;
      pageUrl?: string;
      blobKey?: string;
    }
  ): string;
  getEvidenceRecords(): EvidenceRecord[];
  getEvidenceById(id: string): EvidenceRecord | undefined;
}

export interface CheckDefinition {
  id: string; // e.g. "A1", "D5"
  version: string; // e.g. "1.0.0"
  title: string;
  description: string;
  module: CheckModule;
  wave: CheckWave;
  requiredEvidence: EvidenceType[];
  applicability?: (snapshot: SiteSnapshot, context: DetectionContext) => boolean;
  run: (
    snapshot: SiteSnapshot,
    context: DetectionContext
  ) => Promise<DetectorOutput> | DetectorOutput;
}

export interface CheckExecutionResult {
  checkId: string;
  version: string;
  output: DetectorOutput;
  executionDurationMs: number;
  executedAt: string;
  skippedReason?: string;
}

export interface DetectionSuiteResult {
  scanId: string;
  scannerVersion: string;
  rulesetVersion: string;
  totalChecksEvaluated: number;
  statusCounts: {
    passed: number;
    issue_found: number;
    not_applicable: number;
    unable_to_verify: number;
  };
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  results: Record<string, CheckExecutionResult>;
  collectedEvidence: EvidenceRecord[];
  totalDurationMs: number;
}

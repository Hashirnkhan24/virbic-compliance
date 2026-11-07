import type {
  ConsentRun,
  ConsentButton,
} from "@vibe/contracts";
import type { UrlGuardConfig } from "../url-guard";

export type ConsentScenario = "no_choice" | "accept" | "reject";
export type ConsentRunStatus = "completed" | "unable_to_verify" | "no_banner_found";

export interface ConsentBannerObservation {
  detected: boolean;
  cmpName?: string;
  bannerText?: string;
  availableButtons: ConsentButton[];
  containerSelector?: string;
}

export interface ConsentTestingOptions {
  timeoutMs?: number;
  settleDelayMs?: number;
  takeScreenshots?: boolean;
  customUserAgent?: string;
  urlGuardConfig?: UrlGuardConfig;
}

export interface ConsentTestingResult {
  targetUrl: string;
  bannerDetected: boolean;
  cmpName?: string;
  bannerText?: string;
  availableButtons: ConsentButton[];
  noChoice: ConsentRun;
  accept: ConsentRun;
  reject: ConsentRun;
  testedAt: string;
  executionDurationMs: number;
  warnings: string[];
}

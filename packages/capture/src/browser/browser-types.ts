import type {
  PageObservation,
  NetworkObservation,
  CookieObservation,
  AssetObservation,
  AxeViolation,
  HeaderObservation,
  PageType,
} from "@vibe/contracts";

export interface BrowserProviderConfig {
  wsEndpoint?: string;
  executablePath?: string;
  headless?: boolean;
  args?: string[];
}

export interface PageCaptureOptions {
  timeoutMs?: number;
  waitForNetworkIdle?: boolean;
  takeScreenshot?: boolean;
  runAccessibilityScan?: boolean;
  scenario?: "pre_consent" | "post_accept" | "post_reject";
  pageType?: PageType;
  discoveredFromUrl?: string;
  customUserAgent?: string;
  viewport?: { width: number; height: number };
}

export interface FormInputObservation {
  name?: string;
  type: string;
  required: boolean;
  autocomplete?: string;
}

export interface FormObservation {
  id?: string;
  name?: string;
  action?: string;
  method: string;
  inputs: FormInputObservation[];
  hasPasswordField: boolean;
  hasPaymentFields: boolean;
  hasEmailField: boolean;
  hasConsentCheckbox: boolean;
}

export interface PageErrorObservation {
  type: "console_error" | "page_error";
  message: string;
  location?: string;
  timestamp: string;
}

export interface ScreenshotData {
  base64: string;
  mimeType: "image/png" | "image/jpeg";
  sizeBytes: number;
}

export interface RawPageCapture {
  url: string;
  finalUrl: string;
  httpStatus: number;
  pageType: PageType;
  pageObservation: PageObservation;
  htmlContent: string;
  networkRequests: NetworkObservation[];
  responseHeaders: HeaderObservation[];
  cookies: CookieObservation[];
  assets: AssetObservation[];
  forms: FormObservation[];
  accessibilityViolations: AxeViolation[];
  errors: PageErrorObservation[];
  screenshot?: ScreenshotData;
  warnings: string[];
  capturedAt: string;
}

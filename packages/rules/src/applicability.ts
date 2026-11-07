/**
 * Applicability Evaluator
 *
 * Determines whether a check is applicable given the scan context.
 * Uses customer-confirmed jurisdictions — NEVER infers legal applicability
 * from IP address, hosting location, or server geolocation alone.
 *
 * Evaluator order (from AGENTS.md):
 *   1. Not applicable if applicability fails.
 *   2. Unable to verify if required evidence is missing/blocked.
 *   3. Run detector.
 *   4. Validate output and evidence IDs.
 *   5. Issue found only when evidence-supported; otherwise passed.
 *   6. Persist scanner/ruleset versions.
 */

import type { Jurisdiction, SiteSnapshot } from "@vibe/contracts";
import type { CheckRegistryEntry } from "./registry";

/** Context required for applicability evaluation. */
export interface ApplicabilityContext {
  /**
   * Jurisdictions confirmed by the customer / user at scan time.
   * This is the ONLY source for jurisdiction-based applicability.
   *
   * INVARIANT: Never populated from:
   *   - IP address geolocation
   *   - Hosting provider location
   *   - DNS/CDN server location
   *   - TLD inference (e.g., .in does NOT prove India applicability)
   */
  readonly confirmedJurisdictions: Jurisdiction[];

  /**
   * Whether the scanned site has e-commerce signals
   * (payment forms, checkout pages, product listings).
   */
  readonly hasEcommerceSignals: boolean;

  /**
   * Whether the scanned site collects personal data
   * (forms, login, contact, newsletter signup).
   */
  readonly collectsPersonalData: boolean;

  /**
   * Whether consent banner/mechanism was detected.
   */
  readonly hasConsentMechanism: boolean;
}

/** Result of an applicability check. */
export interface ApplicabilityResult {
  /** Whether the check is applicable */
  readonly applicable: boolean;
  /** Reason code explaining the decision */
  readonly reasonCode: string;
  /** Human-readable explanation */
  readonly reason: string;
}

/**
 * Extracts applicability context from a SiteSnapshot.
 * This is a pure function — no side effects, no network calls.
 */
export function extractApplicabilityContext(
  snapshot: SiteSnapshot,
  confirmedJurisdictions: Jurisdiction[]
): ApplicabilityContext {
  const hasEcommerceSignals = snapshot.pages.some(
    (p) =>
      p.hasPaymentForm ||
      p.pageType === "checkout" ||
      p.pageType === "pricing"
  );

  const collectsPersonalData = snapshot.pages.some(
    (p) =>
      p.hasLoginForm ||
      p.hasContactForm ||
      p.pageType === "login" ||
      p.pageType === "signup"
  );

  const hasConsentMechanism =
    snapshot.consentRuns.noChoice?.bannerDetected === true ||
    snapshot.consentRuns.accept?.bannerDetected === true;

  return {
    confirmedJurisdictions,
    hasEcommerceSignals,
    collectsPersonalData,
    hasConsentMechanism,
  };
}

/**
 * Evaluates whether a specific check is applicable given the context.
 *
 * Rules:
 * 1. Jurisdiction: If check has jurisdiction constraints, at least one
 *    must match the customer-confirmed list.
 * 2. Module-specific: Some checks only apply to e-commerce sites,
 *    sites collecting personal data, etc.
 * 3. Not applicable checks must NOT reduce the readiness score.
 */
export class ApplicabilityEvaluator {
  /**
   * Evaluate a single check's applicability.
   */
  public evaluate(
    entry: CheckRegistryEntry,
    context: ApplicabilityContext
  ): ApplicabilityResult {
    // Rule 1: Jurisdiction applicability
    // INVARIANT: Never infer from IP/hosting location
    if (entry.jurisdictions.length > 0) {
      const hasMatchingJurisdiction = entry.jurisdictions.some((j) =>
        context.confirmedJurisdictions.includes(j)
      );
      if (!hasMatchingJurisdiction) {
        return {
          applicable: false,
          reasonCode: "JURISDICTION_NOT_APPLICABLE",
          reason: `Check "${entry.id}" requires jurisdiction(s) [${entry.jurisdictions.join(", ")}] but confirmed jurisdiction(s) are [${context.confirmedJurisdictions.join(", ")}].`,
        };
      }
    }

    // Rule 2: E-commerce-specific checks
    if (entry.id === "E2" && !context.hasEcommerceSignals) {
      return {
        applicable: false,
        reasonCode: "NO_ECOMMERCE_SIGNALS",
        reason: `Check "${entry.id}" (${entry.title}) is only applicable to sites with e-commerce/payment functionality.`,
      };
    }

    // Rule 3: Consent-related checks need cookie/tracking context
    // Note: B1 (banner presence) is always applicable — the absence of a banner IS the issue.
    // But B3 (reject prominence) and B4 (reject blocks trackers) require a banner to exist.
    if ((entry.id === "B3" || entry.id === "B4") && !context.hasConsentMechanism) {
      return {
        applicable: false,
        reasonCode: "NO_CONSENT_MECHANISM",
        reason: `Check "${entry.id}" (${entry.title}) requires a consent mechanism to evaluate.`,
      };
    }

    // Rule 4: Form consent checks need forms
    if (entry.id === "A6" && !context.collectsPersonalData) {
      return {
        applicable: false,
        reasonCode: "NO_PERSONAL_DATA_COLLECTION",
        reason: `Check "${entry.id}" (${entry.title}) is only applicable to sites collecting personal data via forms.`,
      };
    }

    return {
      applicable: true,
      reasonCode: "APPLICABLE",
      reason: `Check "${entry.id}" is applicable to the current scan context.`,
    };
  }

  /**
   * Filter a list of checks to only those that are applicable.
   */
  public filterApplicable(
    entries: CheckRegistryEntry[],
    context: ApplicabilityContext
  ): { applicable: CheckRegistryEntry[]; notApplicable: Array<{ entry: CheckRegistryEntry; result: ApplicabilityResult }> } {
    const applicable: CheckRegistryEntry[] = [];
    const notApplicable: Array<{ entry: CheckRegistryEntry; result: ApplicabilityResult }> = [];

    for (const entry of entries) {
      const result = this.evaluate(entry, context);
      if (result.applicable) {
        applicable.push(entry);
      } else {
        notApplicable.push({ entry, result });
      }
    }

    return { applicable, notApplicable };
  }
}

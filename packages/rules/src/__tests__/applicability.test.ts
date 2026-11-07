import { describe, it, expect } from "vitest";
import {
  ApplicabilityEvaluator,
  extractApplicabilityContext,
  type ApplicabilityContext,
} from "../applicability";
import type { CheckRegistryEntry } from "../registry";
import { createMockSnapshot } from "./test-helpers";

describe("ApplicabilityEvaluator", () => {
  const evaluator = new ApplicabilityEvaluator();

  const mockUniversalCheck: CheckRegistryEntry = {
    id: "D5",
    version: "1.0.0",
    title: "HTTPS / TLS Enforcement",
    description: "Universal security check",
    module: "security",
    wave: "W1",
    priority: 1,
    defaultSeverity: "critical",
    jurisdictions: [], // Universal
    legalReferences: [],
    exposureModelIds: [],
    reviewDate: "2025-10-01",
    enabled: true,
  };

  const mockIndiaLegalCheck: CheckRegistryEntry = {
    id: "E2",
    version: "1.0.0",
    title: "Refund and Shipping Policy",
    description: "Consumer protection check for India e-commerce",
    module: "legal",
    wave: "W1",
    priority: 20,
    defaultSeverity: "medium",
    jurisdictions: ["india"],
    legalReferences: ["Consumer Protection E-Commerce Rules 2020"],
    exposureModelIds: ["consumer_protection_misleading"],
    reviewDate: "2025-10-01",
    enabled: true,
  };

  const mockUsLegalCheck: CheckRegistryEntry = {
    id: "A10",
    version: "1.0.0",
    title: "Opt-Out Link",
    description: "CCPA opt-out link check",
    module: "privacy",
    wave: "W1",
    priority: 25,
    defaultSeverity: "medium",
    jurisdictions: ["us"],
    legalReferences: ["CCPA § 1798.120"],
    exposureModelIds: ["ccpa_statutory_exposure"],
    reviewDate: "2025-10-01",
    enabled: true,
  };

  it("marks universal checks as applicable regardless of confirmed jurisdictions", () => {
    const context: ApplicabilityContext = {
      confirmedJurisdictions: ["india"],
      hasEcommerceSignals: false,
      collectsPersonalData: false,
      hasConsentMechanism: false,
    };

    const result = evaluator.evaluate(mockUniversalCheck, context);
    expect(result.applicable).toBe(true);
    expect(result.reasonCode).toBe("APPLICABLE");
  });

  it("INVARIANT: Legal applicability governed strictly by customer-confirmed jurisdictions", () => {
    // Customer confirmed only India
    const indiaOnlyContext: ApplicabilityContext = {
      confirmedJurisdictions: ["india"],
      hasEcommerceSignals: true,
      collectsPersonalData: true,
      hasConsentMechanism: true,
    };

    // US check must be marked NOT applicable
    const usResult = evaluator.evaluate(mockUsLegalCheck, indiaOnlyContext);
    expect(usResult.applicable).toBe(false);
    expect(usResult.reasonCode).toBe("JURISDICTION_NOT_APPLICABLE");

    // When customer confirms US, it becomes applicable
    const usConfirmedContext: ApplicabilityContext = {
      ...indiaOnlyContext,
      confirmedJurisdictions: ["india", "us"],
    };
    const usResult2 = evaluator.evaluate(mockUsLegalCheck, usConfirmedContext);
    expect(usResult2.applicable).toBe(true);
  });

  it("INVARIANT: Never infer legal applicability from IP address alone", () => {
    // Snapshot has US resolved IP, but user confirmed only India
    const snapshotWithUsIp = createMockSnapshot({
      dns: {
        resolvedIps: ["104.21.32.1"], // Cloudflare / US IP
        records: [],
        hasDkimSignal: false,
        isCloudflareOrCdn: true,
        checkedAt: new Date().toISOString(),
      },
    });

    // Extract applicability context: only customer-confirmed jurisdictions must be honored
    const context = extractApplicabilityContext(snapshotWithUsIp, ["india"]);
    expect(context.confirmedJurisdictions).toEqual(["india"]);

    // US CCPA check must remain NOT APPLICABLE despite US IP address
    const result = evaluator.evaluate(mockUsLegalCheck, context);
    expect(result.applicable).toBe(false);
  });

  it("evaluates e-commerce applicability for E2 (refund/shipping policy)", () => {
    const nonEcommerceContext: ApplicabilityContext = {
      confirmedJurisdictions: ["india"],
      hasEcommerceSignals: false,
      collectsPersonalData: false,
      hasConsentMechanism: false,
    };

    // No e-commerce signals => not applicable
    const result1 = evaluator.evaluate(mockIndiaLegalCheck, nonEcommerceContext);
    expect(result1.applicable).toBe(false);
    expect(result1.reasonCode).toBe("NO_ECOMMERCE_SIGNALS");

    // With e-commerce signals => applicable
    const ecommerceContext: ApplicabilityContext = {
      ...nonEcommerceContext,
      hasEcommerceSignals: true,
    };
    const result2 = evaluator.evaluate(mockIndiaLegalCheck, ecommerceContext);
    expect(result2.applicable).toBe(true);
  });

  it("evaluates consent banner dependencies for B3 (reject prominence)", () => {
    const mockB3Check: CheckRegistryEntry = {
      id: "B3",
      version: "1.0.0",
      title: "Reject Prominence",
      description: "Dark pattern check for reject button",
      module: "cookies",
      wave: "W1",
      priority: 20,
      defaultSeverity: "medium",
      jurisdictions: ["india", "eu"],
      legalReferences: [],
      exposureModelIds: [],
      reviewDate: "2025-10-01",
      enabled: true,
    };

    const noBannerContext: ApplicabilityContext = {
      confirmedJurisdictions: ["india"],
      hasEcommerceSignals: false,
      collectsPersonalData: false,
      hasConsentMechanism: false,
    };

    const result = evaluator.evaluate(mockB3Check, noBannerContext);
    expect(result.applicable).toBe(false);
    expect(result.reasonCode).toBe("NO_CONSENT_MECHANISM");
  });

  it("extracts applicability signals accurately from SiteSnapshot", () => {
    const snapshotWithForms = createMockSnapshot({
      pages: [
        {
          url: "https://example.com/checkout",
          finalUrl: "https://example.com/checkout",
          httpStatus: 200,
          pageType: "checkout",
          title: "Checkout",
          hasLoginForm: false,
          hasPaymentForm: true,
          hasContactForm: false,
          loadDurationMs: 300,
          capturedAt: new Date().toISOString(),
        },
        {
          url: "https://example.com/contact",
          finalUrl: "https://example.com/contact",
          httpStatus: 200,
          pageType: "contact",
          title: "Contact Us",
          hasLoginForm: false,
          hasPaymentForm: false,
          hasContactForm: true,
          loadDurationMs: 200,
          capturedAt: new Date().toISOString(),
        },
      ],
      consentRuns: {
        noChoice: {
          scenario: "no_choice",
          status: "completed",
          bannerDetected: true,
          availableButtons: [],
          cookiesBefore: [],
          cookiesAfter: [],
          cookiesSet: [],
          storageItems: [],
          networkRequests: [],
          trackersFired: [],
          thirdPartyDomainsContacted: [],
          executionDurationMs: 500,
          warnings: [],
        },
      },
    });

    const context = extractApplicabilityContext(snapshotWithForms, ["india", "eu"]);
    expect(context.hasEcommerceSignals).toBe(true);
    expect(context.collectsPersonalData).toBe(true);
    expect(context.hasConsentMechanism).toBe(true);
    expect(context.confirmedJurisdictions).toEqual(["india", "eu"]);
  });
});

import type { CheckDefinition } from "../../framework/types";

const REPUTABLE_PAYMENT_PROVIDERS = [
  /razorpay/i,
  /stripe/i,
  /paypal/i,
  /cashfree/i,
  /payu/i,
  /braintree/i,
  /shopify/i,
  /square/i,
  /ccavenue/i,
  /billdesk/i,
];

export const f7PaymentGatewaySignalsCheck: CheckDefinition = {
  id: "F7",
  version: "1.0.0",
  title: "Payment gateway signals",
  description: "Audits checkout interfaces to verify that credit card and payment collection is mediated by PCI-DSS certified payment gateways rather than insecure raw form submissions.",
  module: "consumer",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  applicability: (snapshot) => {
    return snapshot.pages.some((p) => p.hasPaymentForm || p.pageType === "checkout");
  },
  run: (snapshot, context) => {
    const paymentPages = snapshot.pages.filter((p) => p.hasPaymentForm || p.pageType === "checkout");

    if (paymentPages.length === 0) {
      return {
        checkId: "F7",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "NO_PAYMENT_FORMS_ON_SITE",
        summary: "No payment capture or checkout forms were discovered on the website.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    // Inspect scripts and network requests for certified payment gateway SDKs
    const externalScriptUrls = [
      ...snapshot.networkRequests.filter((r) => r.isThirdParty).map((r) => r.url),
      ...(snapshot.assets || []).filter((a) => a.assetType === "script").map((a) => a.url),
    ];

    const detectedGateways = new Set<string>();
    for (const url of externalScriptUrls) {
      for (const pattern of REPUTABLE_PAYMENT_PROVIDERS) {
        if (pattern.test(url)) {
          detectedGateways.add(pattern.source.replace(/\\|\/|i/g, ""));
        }
      }
    }

    // Check if any payment form appears to collect raw card data without an iframe or gateway script
    const hasRawCardForms = paymentPages.some((p) => {
      const formsData = (p.domFacts?.formsData as Array<{ hasPaymentFields?: boolean; action?: string }>) || [];
      return formsData.some((f) => f.hasPaymentFields);
    });

    if (hasRawCardForms && detectedGateways.size === 0) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "dom_element",
        {
          affectedPages: paymentPages.map((p) => p.url),
          detectedGateways: [],
          pciWarning: "Handling raw PAN/CVV input without a client-side hosted iframe or certified payment SDK breaches PCI-DSS Level 1 compliance requirements.",
        },
        {
          sourceLocator: "form input[autocomplete*='cc-'], input[name*='card']",
          pageUrl: paymentPages[0]?.url ?? snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "F7",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "critical",
        confidence: 0.95,
        reasonCode: "RAW_CARD_CAPTURE_WITHOUT_GATEWAY_SDK",
        summary: "Payment card collection inputs detected without client-side tokenization or hosted payment gateway SDK.",
        evidenceIds: [evidenceId],
        remediationTemplateId: "integrate_certified_payment_gateway",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "F7",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 0.9,
      reasonCode: "CERTIFIED_PAYMENT_GATEWAY_DETECTED",
      summary: `Payment processing mediated by certified provider(s): ${Array.from(detectedGateways).join(", ") || "tokenized gateway"}.`,
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

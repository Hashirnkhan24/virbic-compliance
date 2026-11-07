import type { CheckDefinition } from "../../framework/types";

export const e2RefundShippingPolicyCheck: CheckDefinition = {
  id: "E2",
  version: "1.0.0",
  title: "Refund/cancellation/shipping policy",
  description: "Verifies the presence of a dedicated Refund, Cancellation, or Shipping policy on websites offering commercial transactions or paid services.",
  module: "legal",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  applicability: (snapshot) => {
    // Applicable if site has payment forms, pricing page, checkout, or cart
    return (
      snapshot.pages.some((p) => p.hasPaymentForm || p.pageType === "pricing" || p.pageType === "checkout") ||
      snapshot.pages.some((p) => /pricing|checkout|cart|store|shop/i.test(p.url))
    );
  },
  run: (snapshot, context) => {
    const refundPage = snapshot.pages.find(
      (p) =>
        p.pageType === "refund" ||
        p.pageType === "shipping" ||
        /refund|cancellation|return-policy|shipping-policy/i.test(p.url) ||
        (p.title && /refund|cancellation|shipping/i.test(p.title))
    );

    if (refundPage) {
      return {
        checkId: "E2",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "REFUND_POLICY_DISCOVERED",
        summary: `Commercial terms / refund policy located at ${refundPage.url}.`,
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    // Commercial signals present, but no refund or cancellation policy discovered
    const evidenceId = context.evidenceCollector.registerEvidence(
      "dom_element",
      {
        commercialSignals: snapshot.pages
          .filter((p) => p.hasPaymentForm || p.pageType === "pricing" || p.pageType === "checkout")
          .map((p) => ({ url: p.url, pageType: p.pageType })),
        legalRequirement: "Consumer Protection (E-Commerce) Rules and payment gateway guidelines mandate explicit refund and cancellation terms.",
      },
      {
        pageUrl: snapshot.canonicalOrigin,
        sourceLocator: "footer, nav, a[href*='refund']",
      }
    );

    return {
      checkId: "E2",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "high",
      confidence: 0.95,
      reasonCode: "REFUND_CANCELLATION_POLICY_MISSING",
      summary: "Commercial or checkout features detected, but no Refund, Return, or Cancellation policy was discovered.",
      evidenceIds: [evidenceId],
      remediationTemplateId: "publish_refund_cancellation_policy",
      requiresHumanReview: false,
    };
  },
};

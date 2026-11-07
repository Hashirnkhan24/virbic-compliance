import type { CheckDefinition } from "../../framework/types";

export const a1PrivacyPolicyCheck: CheckDefinition = {
  id: "A1",
  version: "1.0.0",
  title: "Privacy policy exists and is linked",
  description: "Verifies that the website has a dedicated, accessible privacy policy page.",
  module: "privacy",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  run: (snapshot, context) => {
    // 1. Look for a classified privacy page in snapshot.pages
    const privacyPage = snapshot.pages.find(
      (p) =>
        p.pageType === "privacy" ||
        p.url.toLowerCase().includes("privacy") ||
        (p.title && p.title.toLowerCase().includes("privacy policy"))
    );

    if (privacyPage) {
      return {
        checkId: "A1",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "PRIVACY_POLICY_FOUND",
        summary: `Privacy policy page identified at ${privacyPage.url}.`,
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    // 2. Not found: register evidence and report issue
    const evidenceId = context.evidenceCollector.registerEvidence(
      "dom_element",
      {
        targetHost: snapshot.targetHost,
        pagesScanned: snapshot.pages.map((p) => ({ url: p.url, pageType: p.pageType })),
        reason: "No privacy policy page or navigation link was discovered across scanned pages.",
      },
      {
        sourceLocator: "nav, footer, a[href*='privacy']",
        pageUrl: snapshot.canonicalOrigin,
      }
    );

    return {
      checkId: "A1",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "high",
      confidence: 1.0,
      reasonCode: "PRIVACY_POLICY_MISSING",
      summary: "No dedicated Privacy Policy page or footer link was discovered on the website.",
      evidenceIds: [evidenceId],
      remediationTemplateId: "create_privacy_policy",
      requiresHumanReview: false,
    };
  },
};

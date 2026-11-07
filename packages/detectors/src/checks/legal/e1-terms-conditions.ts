import type { CheckDefinition } from "../../framework/types";

export const e1TermsConditionsCheck: CheckDefinition = {
  id: "E1",
  version: "1.0.0",
  title: "Terms and Conditions exist",
  description: "Verifies that the website publishes binding Terms and Conditions / User Agreement.",
  module: "legal",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  run: (snapshot, context) => {
    const termsPage = snapshot.pages.find(
      (p) =>
        p.pageType === "terms" ||
        p.url.toLowerCase().includes("terms") ||
        (p.title && p.title.toLowerCase().includes("terms"))
    );

    if (termsPage) {
      return {
        checkId: "E1",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "TERMS_AND_CONDITIONS_FOUND",
        summary: `Terms and conditions page identified at ${termsPage.url}.`,
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    const eid = context.evidenceCollector.registerEvidence(
      "dom_element",
      {
        targetHost: snapshot.targetHost,
        pagesScanned: snapshot.pages.map((p) => ({ url: p.url, pageType: p.pageType })),
      },
      {
        sourceLocator: "a[href*='terms']",
        pageUrl: snapshot.canonicalOrigin,
      }
    );

    return {
      checkId: "E1",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "medium",
      confidence: 1.0,
      reasonCode: "TERMS_AND_CONDITIONS_MISSING",
      summary: "No dedicated Terms of Service or User Agreement page was discovered.",
      evidenceIds: [eid],
      remediationTemplateId: "create_terms_conditions",
      requiresHumanReview: false,
    };
  },
};

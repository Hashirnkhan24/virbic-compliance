import type { CheckDefinition } from "../../framework/types";

export const a6FormConsentCheck: CheckDefinition = {
  id: "A6",
  version: "1.0.0",
  title: "Consent at data-collecting forms",
  description: "Verifies that user data-collecting forms (e.g. contact or signup) include explicit consent or policy links.",
  module: "privacy",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  applicability: (snapshot) => {
    // Only applicable if the site has forms collecting contact or account data
    return snapshot.pages.some((p) => p.hasContactForm || p.hasLoginForm);
  },
  run: (snapshot, context) => {
    const offendingPages = snapshot.pages.filter((p) => {
      if ((!p.hasContactForm && !p.hasLoginForm) || p.hasPaymentForm) return false;
      const formsData = (p.domFacts?.formsData as Array<{ hasConsentCheckbox?: boolean; hasEmailField?: boolean }>) || [];
      if (formsData.length > 0) {
        return formsData.some((f) => f.hasEmailField && !f.hasConsentCheckbox);
      }
      return true;
    });

    if (offendingPages.length === 0) {
      return {
        checkId: "A6",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "FORM_CONSENT_PRESENT",
        summary: "Personal data collection forms include consent checkboxes or explicit policy disclosures.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    // Inspect if any of these pages have forms without consent notices
    const evidenceIds: string[] = [];
    for (const page of offendingPages) {
      const eid = context.evidenceCollector.registerEvidence(
        "dom_element",
        {
          url: page.url,
          hasContactForm: page.hasContactForm,
          hasLoginForm: page.hasLoginForm,
          formsCount: (page.domFacts as any)?.formsCount ?? 1,
        },
        {
          sourceLocator: "form",
          pageUrl: page.url,
        }
      );
      evidenceIds.push(eid);
    }

    return {
      checkId: "A6",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "medium",
      confidence: 0.9,
      reasonCode: "FORM_CONSENT_MISSING",
      summary: `Found ${offendingPages.length} page(s) with personal data forms lacking explicit privacy consent notices.`,
      evidenceIds,
      remediationTemplateId: "add_form_consent_checkbox",
      requiresHumanReview: false,
    };
  },
};

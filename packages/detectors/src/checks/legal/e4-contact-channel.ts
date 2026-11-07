import type { CheckDefinition } from "../../framework/types";

export const e4ContactChannelCheck: CheckDefinition = {
  id: "E4",
  version: "1.0.0",
  title: "Working contact channel",
  description: "Verifies that the website provides a discoverable contact page, support email, or contact form.",
  module: "legal",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  run: (snapshot, context) => {
    const contactPage = snapshot.pages.find(
      (p) =>
        p.pageType === "contact" ||
        p.hasContactForm ||
        p.url.toLowerCase().includes("contact")
    );

    if (contactPage) {
      return {
        checkId: "E4",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "CONTACT_CHANNEL_FOUND",
        summary: `Contact channel identified at ${contactPage.url}.`,
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    const eid = context.evidenceCollector.registerEvidence(
      "dom_element",
      {
        targetHost: snapshot.targetHost,
        pagesScanned: snapshot.pages.map((p) => p.url),
      },
      {
        sourceLocator: "a[href*='contact']",
        pageUrl: snapshot.canonicalOrigin,
      }
    );

    return {
      checkId: "E4",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "medium",
      confidence: 1.0,
      reasonCode: "CONTACT_CHANNEL_MISSING",
      summary: "No direct contact page, support channel, or inquiry form was found.",
      evidenceIds: [eid],
      remediationTemplateId: "add_contact_channel",
      requiresHumanReview: false,
    };
  },
};

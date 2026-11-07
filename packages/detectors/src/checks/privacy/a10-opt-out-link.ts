import type { CheckDefinition } from "../../framework/types";

export const a10OptOutLinkCheck: CheckDefinition = {
  id: "A10",
  version: "1.0.0",
  title: "Do Not Sell/Share link",
  description: "Verifies the presence of a 'Do Not Sell or Share My Personal Information' or 'Your Privacy Choices' link when marketing trackers or third-party cookies are present.",
  module: "privacy",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  run: (snapshot, context) => {
    // Check if site deploys third-party advertising/tracking cookies or scripts
    const hasMarketingOrAdTrackers =
      snapshot.cookies.some((c) => c.isThirdParty) ||
      (snapshot.consentRuns.noChoice?.trackersFired?.length ?? 0) > 0 ||
      snapshot.networkRequests.some(
        (r) =>
          r.isThirdParty &&
          (r.url.includes("doubleclick") ||
            r.url.includes("facebook.net") ||
            r.url.includes("adservice") ||
            r.url.includes("criteo") ||
            r.url.includes("tiktok"))
      );

    // Look for opt-out links across captured pages
    let optOutLinkFound = false;
    let foundPageUrl = "";

    for (const page of snapshot.pages) {
      const pageContent = (
        (page.title || "") + " " +
        (page.metaDescription || "") + " " +
        JSON.stringify(page.domFacts || {})
      ).toLowerCase();

      if (
        pageContent.includes("do not sell") ||
        pageContent.includes("do-not-sell") ||
        pageContent.includes("your privacy choices") ||
        pageContent.includes("privacy choices") ||
        pageContent.includes("opt-out") ||
        pageContent.includes("opt out") ||
        pageContent.includes("dnsmpi")
      ) {
        optOutLinkFound = true;
        foundPageUrl = page.url;
        break;
      }
    }

    if (optOutLinkFound) {
      return {
        checkId: "A10",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "OPT_OUT_LINK_FOUND",
        summary: `Opt-out / 'Do Not Sell or Share My Personal Information' choice link identified on ${foundPageUrl}.`,
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    if (!hasMarketingOrAdTrackers) {
      return {
        checkId: "A10",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 0.9,
        reasonCode: "NO_AD_TRACKERS_NO_OPT_OUT_REQUIRED",
        summary: "No third-party ad networks or cross-context behavioral tracking cookies detected; opt-out link is not mandated.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    // Third-party ad tracking present, but no opt-out link discovered
    const evidenceId = context.evidenceCollector.registerEvidence(
      "dom_element",
      {
        hasMarketingOrAdTrackers,
        pagesInspected: snapshot.pages.map((p) => p.url),
        reason: "Third-party ad networks or tracking cookies were detected, but no 'Do Not Sell or Share' or 'Your Privacy Choices' link was found.",
      },
      {
        pageUrl: snapshot.canonicalOrigin,
        sourceLocator: "footer, a[href*='opt-out'], a[href*='privacy-choices']",
      }
    );

    return {
      checkId: "A10",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "medium",
      confidence: 0.95,
      reasonCode: "DO_NOT_SELL_LINK_MISSING",
      summary: "Third-party marketing or ad trackers were detected, but no 'Do Not Sell or Share My Personal Information' or 'Your Privacy Choices' link was discovered.",
      evidenceIds: [evidenceId],
      remediationTemplateId: "add_do_not_sell_link",
      requiresHumanReview: false,
    };
  },
};

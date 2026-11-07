import type { CheckDefinition } from "../../framework/types";

export const b1CookieBannerCheck: CheckDefinition = {
  id: "B1",
  version: "1.0.0",
  title: "Cookie banner present",
  description: "Verifies that websites deploying third-party cookies or trackers present a cookie consent banner.",
  module: "cookies",
  wave: "W1",
  requiredEvidence: ["cookie"],
  run: (snapshot, context) => {
    const bannerDetected =
      snapshot.consentRuns.noChoice?.bannerDetected ||
      snapshot.consentRuns.accept?.bannerDetected ||
      snapshot.consentRuns.reject?.bannerDetected ||
      false;

    const hasThirdPartyCookiesOrTrackers =
      snapshot.cookies.some((c) => c.isThirdParty) ||
      (snapshot.consentRuns.noChoice?.trackersFired?.length ?? 0) > 0;

    if (bannerDetected) {
      return {
        checkId: "B1",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "COOKIE_BANNER_DETECTED",
        summary: "Consent management banner detected on the website.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    if (!hasThirdPartyCookiesOrTrackers) {
      // No trackers and no banner is acceptable
      return {
        checkId: "B1",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 0.95,
        reasonCode: "NO_TRACKERS_NO_BANNER_NEEDED",
        summary: "No third-party cookies or ad trackers were detected; cookie banner is not strictly required.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    // Third-party trackers present but NO banner found
    const evidenceId = context.evidenceCollector.registerEvidence(
      "cookie",
      {
        bannerDetected: false,
        thirdPartyCookies: snapshot.cookies.filter((c) => c.isThirdParty).map((c) => c.name),
        trackersFired: snapshot.consentRuns.noChoice?.trackersFired || [],
      },
      {
        sourceLocator: "consent_banner",
        pageUrl: snapshot.canonicalOrigin,
      }
    );

    return {
      checkId: "B1",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "high",
      confidence: 1.0,
      reasonCode: "COOKIE_BANNER_MISSING",
      summary: "Third-party trackers or cookies are loaded, but no cookie consent banner was discovered.",
      evidenceIds: [evidenceId],
      remediationTemplateId: "install_cookie_consent_banner",
      requiresHumanReview: false,
    };
  },
};

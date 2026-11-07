import type { CheckDefinition } from "../../framework/types";

export const b2PreconsentTrackersCheck: CheckDefinition = {
  id: "B2",
  version: "1.0.0",
  title: "Trackers fire before consent",
  description: "Detects advertising or tracking cookies and scripts that execute before the user has given consent.",
  module: "cookies",
  wave: "W1",
  requiredEvidence: ["cookie", "network_request"],
  run: (snapshot, context) => {
    const preConsentTrackers = snapshot.consentRuns.noChoice?.trackersFired ?? [];
    const preConsentCookies = snapshot.cookies.filter(
      (c) => c.observedScenario === "pre_consent" && c.isThirdParty
    );

    if (preConsentTrackers.length === 0 && preConsentCookies.length === 0) {
      return {
        checkId: "B2",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "NO_PRECONSENT_TRACKERS",
        summary: "No third-party trackers or ad cookies fired prior to user consent.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    const evidenceId = context.evidenceCollector.registerEvidence(
      "network_request",
      {
        trackersFired: preConsentTrackers,
        preConsentCookies: preConsentCookies.map((c) => ({
          name: c.name,
          domain: c.domain,
          secure: c.secure,
        })),
        scenario: "no_choice",
      },
      {
        sourceLocator: "network",
        pageUrl: snapshot.canonicalOrigin,
      }
    );

    return {
      checkId: "B2",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "critical",
      confidence: 1.0,
      reasonCode: "TRACKERS_FIRED_BEFORE_CONSENT",
      summary: `Detected ${preConsentTrackers.length} tracking call(s) and ${preConsentCookies.length} third-party cookie(s) firing prior to consent.`,
      evidenceIds: [evidenceId],
      remediationTemplateId: "block_preconsent_tags",
      requiresHumanReview: false,
    };
  },
};

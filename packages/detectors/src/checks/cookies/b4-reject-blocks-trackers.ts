import type { CheckDefinition } from "../../framework/types";

export const b4RejectBlocksTrackersCheck: CheckDefinition = {
  id: "B4",
  version: "1.0.0",
  title: "Reject really blocks trackers",
  description: "Verifies that clicking 'Reject' or 'Decline' genuinely blocks non-essential cookies and trackers.",
  module: "cookies",
  wave: "W1",
  requiredEvidence: ["cookie"],
  applicability: (snapshot) => {
    // Only applicable if a banner is present
    return (
      Boolean(snapshot.consentRuns.reject?.bannerDetected) ||
      Boolean(snapshot.consentRuns.noChoice?.bannerDetected)
    );
  },
  run: (snapshot, context) => {
    const rejectRun = snapshot.consentRuns.reject;

    if (!rejectRun) {
      return {
        checkId: "B4",
        checkVersion: "1.0.0",
        status: "unable_to_verify",
        severity: null,
        confidence: 0.5,
        reasonCode: "REJECT_RUN_DATA_MISSING",
        summary: "Could not evaluate reject parity because the reject session did not complete.",
        evidenceIds: [],
        requiresHumanReview: true,
      };
    }

    if (rejectRun.status === "unable_to_verify") {
      return {
        checkId: "B4",
        checkVersion: "1.0.0",
        status: "unable_to_verify",
        severity: null,
        confidence: 0.5,
        reasonCode: "REJECT_CONTROL_NOT_VERIFIABLE",
        summary: "The consent banner did not offer a working reject or preferences mechanism.",
        evidenceIds: [],
        requiresHumanReview: true,
      };
    }

    const postRejectTrackers = rejectRun.trackersFired ?? [];
    const postRejectCookies = rejectRun.cookiesSet.filter((c) => c.isThirdParty);

    if (postRejectTrackers.length > 0 || postRejectCookies.length > 0) {
      // Deceptive / Phantom Reject: Trackers still fire after user rejects!
      const evidenceId = context.evidenceCollector.registerEvidence(
        "network_request",
        {
          actionTaken: rejectRun.bannerActionTaken,
          leakedTrackers: postRejectTrackers,
          leakedCookies: postRejectCookies.map((c) => c.name),
        },
        {
          sourceLocator: "consent_reject",
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "B4",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "critical",
        confidence: 1.0,
        reasonCode: "PHANTOM_REJECT_DETECTED",
        summary: "Deceptive consent implementation: trackers or third-party cookies continue firing even after clicking Reject.",
        evidenceIds: [evidenceId],
        remediationTemplateId: "fix_reject_consent_state",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "B4",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "REJECT_SUCCESSFULLY_BLOCKS",
      summary: "Reject control successfully prevented non-essential trackers and cookies from firing.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

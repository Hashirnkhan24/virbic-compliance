import type { CheckDefinition } from "../../framework/types";

export const b3RejectProminenceCheck: CheckDefinition = {
  id: "B3",
  version: "1.0.0",
  title: "Reject as easy as Accept",
  description: "Verifies whether rejecting cookies is as easy as accepting them on the consent banner, preventing asymmetric dark patterns.",
  module: "cookies",
  wave: "W1",
  requiredEvidence: ["cookie"],
  run: (snapshot, context) => {
    const consentRun = snapshot.consentRuns.noChoice || snapshot.consentRuns.accept;

    if (!consentRun || !consentRun.bannerDetected) {
      const hasCookies = snapshot.cookies.length > 0;
      if (!hasCookies) {
        return {
          checkId: "B3",
          checkVersion: "1.0.0",
          status: "not_applicable",
          severity: null,
          confidence: 1.0,
          reasonCode: "NO_COOKIE_BANNER_TO_EVALUATE",
          summary: "No consent banner was detected on the website.",
          evidenceIds: [],
          requiresHumanReview: false,
        };
      }

      return {
        checkId: "B3",
        checkVersion: "1.0.0",
        status: "unable_to_verify",
        severity: null,
        confidence: 0.8,
        reasonCode: "BANNER_NOT_DETECTED_FOR_SYMMETRY_CHECK",
        summary: "Unable to verify reject button symmetry because no cookie banner was surfaced during the scan.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    const buttons = consentRun.availableButtons || [];
    const hasAcceptButton = buttons.some(
      (b) => b.type === "accept" || /accept|agree|allow/i.test(b.text)
    );
    const hasRejectButton = buttons.some(
      (b) => b.type === "reject" || /reject|decline|deny|refuse|disagree/i.test(b.text)
    );

    if (hasAcceptButton && !hasRejectButton) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "cookie",
        {
          bannerText: consentRun.bannerText,
          availableButtons: buttons.map((b) => ({ label: b.text, actionType: b.type })),
          defect: "The consent banner contains an Accept button but lacks an equal first-layer Reject button.",
        },
        {
          pageUrl: snapshot.canonicalOrigin,
          sourceLocator: "consent-banner-controls",
        }
      );

      return {
        checkId: "B3",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 0.95,
        reasonCode: "REJECT_LESS_PROMINENT_THAN_ACCEPT",
        summary: "The cookie banner presents an Accept button without an equivalent, immediate Reject button on the first layer.",
        evidenceIds: [evidenceId],
        remediationTemplateId: "provide_equal_reject_button",
        requiresHumanReview: false,
      };
    }

    if (hasAcceptButton && hasRejectButton) {
      return {
        checkId: "B3",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "REJECT_EQUALLY_PROMINENT",
        summary: "Consent banner provides both Accept and Reject choices with symmetrical ease of access.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "B3",
      checkVersion: "1.0.0",
      status: "unable_to_verify",
      severity: null,
      confidence: 0.75,
      reasonCode: "AMBIGUOUS_BANNER_BUTTONS",
      summary: "Cookie banner buttons could not be unambiguously categorized as Accept or Reject.",
      evidenceIds: [],
      requiresHumanReview: true,
    };
  },
};

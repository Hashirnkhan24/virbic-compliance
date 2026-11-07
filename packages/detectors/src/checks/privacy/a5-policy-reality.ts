import type { CheckDefinition } from "../../framework/types";

export const a5PolicyRealityCheck: CheckDefinition = {
  id: "A5",
  version: "1.0.0",
  title: "Policy matches reality",
  description: "Cross-checks observed network trackers and third-party scripts against disclosures in the privacy policy.",
  module: "privacy",
  wave: "W1",
  requiredEvidence: ["dom_element", "network_request"],
  run: (snapshot, context) => {
    // 1. Collect all detected trackers
    const trackersFired = new Set<string>();
    for (const tracker of snapshot.consentRuns.noChoice?.trackersFired || []) {
      trackersFired.add(tracker);
    }
    for (const tracker of snapshot.consentRuns.accept?.trackersFired || []) {
      trackersFired.add(tracker);
    }
    for (const req of snapshot.networkRequests) {
      if (req.isThirdParty && (req.resourceType === "script" || req.resourceType === "fetch" || req.resourceType === "xhr")) {
        try {
          const host = new URL(req.url).hostname;
          if (
            host.includes("google-analytics") ||
            host.includes("googletagmanager") ||
            host.includes("facebook.net") ||
            host.includes("clarity.ms") ||
            host.includes("hotjar") ||
            host.includes("tiktok")
          ) {
            trackersFired.add(host);
          }
        } catch {
          // ignore invalid URLs
        }
      }
    }

    if (trackersFired.size === 0) {
      return {
        checkId: "A5",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "NO_TRACKERS_TO_DISCLOSE",
        summary: "No third-party advertising or analytics trackers were detected on the site.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    // 2. Locate privacy policy page
    const privacyPage = snapshot.pages.find(
      (p) =>
        p.pageType === "privacy" ||
        p.url.toLowerCase().includes("privacy") ||
        (p.title && p.title.toLowerCase().includes("privacy"))
    );

    if (!privacyPage) {
      return {
        checkId: "A5",
        checkVersion: "1.0.0",
        status: "unable_to_verify",
        severity: null,
        confidence: 0.8,
        reasonCode: "PRIVACY_POLICY_NOT_FOUND",
        summary: "Unable to verify policy-to-reality consistency because no dedicated Privacy Policy page was found.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    // 3. Inspect policy content/facts
    const pageText = (
      (privacyPage.title || "") + " " +
      (privacyPage.metaDescription || "") + " " +
      JSON.stringify(privacyPage.domFacts || {})
    ).toLowerCase();

    const mentionsAnalyticsOrCookies =
      pageText.includes("cookie") ||
      pageText.includes("analytic") ||
      pageText.includes("tracking") ||
      pageText.includes("third-party") ||
      pageText.includes("third party") ||
      pageText.includes("google") ||
      pageText.includes("pixel");

    if (!mentionsAnalyticsOrCookies) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "dom_element",
        {
          policyUrl: privacyPage.url,
          observedTrackers: Array.from(trackersFired),
          reason: "Third-party trackers were observed firing, but the privacy policy contains no disclosures regarding analytics, cookies, or third-party trackers.",
        },
        {
          pageUrl: privacyPage.url,
          sourceLocator: "privacy-policy-text",
        }
      );

      return {
        checkId: "A5",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 0.9,
        reasonCode: "UNDECLARED_TRACKERS_IN_POLICY",
        summary: `Observed ${trackersFired.size} third-party tracker(s), but privacy policy lacks disclosures for tracking, cookies, or analytics services.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "update_privacy_policy_tracker_disclosure",
        requiresHumanReview: true,
      };
    }

    return {
      checkId: "A5",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 0.9,
      reasonCode: "POLICY_TRACKER_DISCLOSURE_CONSISTENT",
      summary: `Privacy policy acknowledges tracking, cookies, or third-party service providers consistent with observed trackers.`,
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

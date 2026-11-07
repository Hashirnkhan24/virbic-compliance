import type { CheckDefinition } from "../../framework/types";

const IP_LEAK_PATTERNS = [
  { name: "Google Fonts", pattern: /fonts\.(googleapis|gstatic)\.com/i },
  { name: "Gravatar", pattern: /gravatar\.com/i },
  { name: "External Icon CDN", pattern: /(cdnjs\.cloudflare|use\.fontawesome|cdn\.jsdelivr)/i },
];

export const b7IpLeakResourcesCheck: CheckDefinition = {
  id: "B7",
  version: "1.0.0",
  title: "Third-party resources leaking IPs",
  description: "Detects third-party fonts and CDNs that transmit visitor IP addresses to external servers on initial page load without consent.",
  module: "cookies",
  wave: "W1",
  requiredEvidence: ["network_request"],
  run: (snapshot, context) => {
    // Check initial requests (no-choice run or overall initial network requests)
    const initialRequests =
      snapshot.consentRuns.noChoice?.networkRequests && snapshot.consentRuns.noChoice.networkRequests.length > 0
        ? snapshot.consentRuns.noChoice.networkRequests
        : snapshot.networkRequests;

    const detectedLeaks = new Map<string, string[]>(); // provider -> urls

    for (const req of initialRequests) {
      if (!req.isThirdParty) continue;

      for (const pattern of IP_LEAK_PATTERNS) {
        if (pattern.pattern.test(req.url)) {
          const list = detectedLeaks.get(pattern.name) || [];
          if (list.length < 3) list.push(req.url);
          detectedLeaks.set(pattern.name, list);
        }
      }
    }

    if (detectedLeaks.size === 0) {
      return {
        checkId: "B7",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "STATIC_ASSETS_SELF_HOSTED",
        summary: "Web fonts and static assets are self-hosted; no unconsented IP transfers to external asset CDNs were observed.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    const providerNames = Array.from(detectedLeaks.keys());
    const evidenceId = context.evidenceCollector.registerEvidence(
      "network_request",
      {
        leakingProviders: Array.from(detectedLeaks.entries()).map(([name, sampleUrls]) => ({
          provider: name,
          sampleUrls,
        })),
        legalContext: "Connecting to remote third-party CDNs transfers client IP addresses prior to user consent (e.g. Munich LG Google Fonts ruling).",
      },
      {
        pageUrl: snapshot.canonicalOrigin,
        sourceLocator: "link[rel='stylesheet'], @import font requests",
      }
    );

    return {
      checkId: "B7",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "low",
      confidence: 0.95,
      reasonCode: "UNCONSENTED_IP_TRANSMISSION_EXTERNAL_HOSTS",
      summary: `Initial page load contacts third-party services (${providerNames.join(", ")}), transmitting visitor IP addresses without prior consent.`,
      evidenceIds: [evidenceId],
      remediationTemplateId: "self_host_google_fonts",
      requiresHumanReview: false,
    };
  },
};

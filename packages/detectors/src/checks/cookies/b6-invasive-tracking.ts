import type { CheckDefinition } from "../../framework/types";

const REPLAY_PROVIDERS = [
  { name: "Microsoft Clarity", pattern: /clarity\.ms/i },
  { name: "Hotjar", pattern: /hotjar\.(com|io)/i },
  { name: "FullStory", pattern: /fullstory\.com/i },
  { name: "LogRocket", pattern: /logrocket\.(io|com)/i },
  { name: "Mouseflow", pattern: /mouseflow\.com/i },
  { name: "Smartlook", pattern: /smartlook\.com/i },
  { name: "Lucky Orange", pattern: /luckyorange\.net/i },
  { name: "Contentsquare", pattern: /contentsquare\.net/i },
  { name: "Inspectlet", pattern: /inspectlet\.com/i },
];

export const b6InvasiveTrackingCheck: CheckDefinition = {
  id: "B6",
  version: "1.0.0",
  title: "Session replay/invasive tracking",
  description: "Detects the presence of session replay and keystroke-logging tools that capture fine-grained user interactions.",
  module: "cookies",
  wave: "W1",
  requiredEvidence: ["network_request"],
  run: (snapshot, context) => {
    const detectedProviders = new Map<string, string>(); // name -> url

    // Check pre-consent requests and assets
    const allUrls = [
      ...snapshot.networkRequests.map((r) => r.url),
      ...(snapshot.assets || []).map((a) => a.url),
      ...(snapshot.consentRuns.noChoice?.networkRequests || []).map((r) => r.url),
      ...(snapshot.consentRuns.noChoice?.trackersFired || []),
    ];

    for (const url of allUrls) {
      for (const provider of REPLAY_PROVIDERS) {
        if (provider.pattern.test(url) && !detectedProviders.has(provider.name)) {
          detectedProviders.set(provider.name, url);
        }
      }
    }

    if (detectedProviders.size === 0) {
      return {
        checkId: "B6",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "NO_INVASIVE_SESSION_REPLAY_DETECTED",
        summary: "No session replay or biometric keystroke logging technologies were detected.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    const providerList = Array.from(detectedProviders.keys());
    const evidenceId = context.evidenceCollector.registerEvidence(
      "network_request",
      {
        detectedProviders: Array.from(detectedProviders.entries()).map(([name, url]) => ({
          provider: name,
          endpoint: url,
        })),
        warning: "Session replay tools record DOM mutations, mouse movements, and user inputs, carrying high regulatory risk if PII is not masked.",
      },
      {
        pageUrl: snapshot.canonicalOrigin,
        sourceLocator: "network/scripts",
      }
    );

    return {
      checkId: "B6",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "high",
      confidence: 1.0,
      reasonCode: "SESSION_REPLAY_TOOL_DETECTED",
      summary: `Detected session replay and screen recording tool(s): ${providerList.join(", ")}. These capture sensitive user interaction data.`,
      evidenceIds: [evidenceId],
      remediationTemplateId: "disclose_or_remove_session_replay",
      requiresHumanReview: false,
    };
  },
};

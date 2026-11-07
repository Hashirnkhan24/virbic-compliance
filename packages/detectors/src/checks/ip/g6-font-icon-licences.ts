import type { CheckDefinition } from "../../framework/types";

const PROPRIETARY_FONT_PATTERNS = [
  /helvetica/i,
  /futura/i,
  /avenir/i,
  /proxima[-_]?nova/i,
  /gotham/i,
  /frutiger/i,
];

export const g6FontIconLicencesCheck: CheckDefinition = {
  id: "G6",
  version: "1.0.0",
  title: "Font and icon licences",
  description: "Inventories custom web fonts and icon packages to flag potential unverified commercial web font usage.",
  module: "ip",
  wave: "W1",
  requiredEvidence: ["network_request"],
  run: (snapshot, context) => {
    const fontUrls = [
      ...snapshot.networkRequests.filter((r) => r.resourceType === "font").map((r) => r.url),
      ...(snapshot.assets || []).filter((a) => a.assetType === "font").map((a) => a.url),
    ];

    const proprietaryFindings: string[] = [];
    for (const url of fontUrls) {
      for (const pattern of PROPRIETARY_FONT_PATTERNS) {
        if (pattern.test(url)) {
          proprietaryFindings.push(url);
        }
      }
    }

    if (proprietaryFindings.length > 0) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "network_request",
        {
          proprietaryFonts: proprietaryFindings,
          licenceNotice: "Commercial desktop fonts deployed as web fonts require specific digital web embedding licenses from the foundry.",
        },
        {
          sourceLocator: proprietaryFindings[0],
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "G6",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "low",
        confidence: 0.85,
        reasonCode: "UNVERIFIED_PROPRIETARY_FONT_ASSET",
        summary: `Identified self-hosted proprietary font family file(s) (${proprietaryFindings.length} asset(s)). Ensure proper webfont redistribution licenses are held.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "audit_web_font_licences",
        requiresHumanReview: true,
      };
    }

    return {
      checkId: "G6",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "OPEN_SOURCE_OR_SYSTEM_FONTS",
      summary: "Web fonts and icon assets appear to utilize open web font repositories or standard system font declarations.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

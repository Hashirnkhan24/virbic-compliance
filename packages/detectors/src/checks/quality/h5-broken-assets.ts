import type { CheckDefinition } from "../../framework/types";

export const h5BrokenAssetsCheck: CheckDefinition = {
  id: "H5",
  version: "1.0.0",
  title: "Broken images/assets",
  description: "Detects broken images, stylesheets, fonts, or media assets that fail to load with HTTP 4xx/5xx errors.",
  module: "quality",
  wave: "W1",
  requiredEvidence: ["network_request"],
  run: (snapshot, context) => {
    const brokenAssets = (snapshot.assets || []).filter((a) => a.isBroken || a.httpStatus >= 400);

    if (brokenAssets.length === 0) {
      return {
        checkId: "H5",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "NO_BROKEN_ASSETS",
        summary: "All audited images, stylesheets, and static assets returned successful HTTP status codes.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    const eid = context.evidenceCollector.registerEvidence(
      "network_request",
      {
        brokenCount: brokenAssets.length,
        brokenSamples: brokenAssets.slice(0, 5).map((a) => ({
          url: a.url,
          status: a.httpStatus,
          assetType: a.assetType,
        })),
      },
      {
        sourceLocator: "img, link[rel='stylesheet'], font assets",
        pageUrl: snapshot.canonicalOrigin,
      }
    );

    return {
      checkId: "H5",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "low",
      confidence: 1.0,
      reasonCode: "BROKEN_ASSETS_DETECTED",
      summary: `Discovered ${brokenAssets.length} broken image(s) or static asset(s) returning HTTP error responses.`,
      evidenceIds: [eid],
      remediationTemplateId: "fix_broken_assets",
      requiresHumanReview: false,
    };
  },
};

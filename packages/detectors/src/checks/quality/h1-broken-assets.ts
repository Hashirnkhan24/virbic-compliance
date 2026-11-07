import type { CheckDefinition } from "../../framework/types";

export const h1BrokenAssetsCheck: CheckDefinition = {
  id: "H1",
  version: "1.0.0",
  title: "Broken links and 404s",
  description: "Audits site assets and internal navigation for broken 4xx or 5xx responses.",
  module: "quality",
  wave: "W1",
  requiredEvidence: ["script_token"],
  run: (snapshot, context) => {
    const brokenAssets = snapshot.assets.filter((a) => a.isBroken || a.httpStatus >= 400);

    if (brokenAssets.length === 0) {
      return {
        checkId: "H1",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "NO_BROKEN_ASSETS",
        summary: "All audited assets returned successful HTTP status codes.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    const eid = context.evidenceCollector.registerEvidence(
      "script_token",
      {
        brokenCount: brokenAssets.length,
        brokenSamples: brokenAssets.slice(0, 5).map((a) => ({
          url: a.url,
          status: a.httpStatus,
          assetType: a.assetType,
        })),
      },
      {
        sourceLocator: "assets",
        pageUrl: snapshot.canonicalOrigin,
      }
    );

    return {
      checkId: "H1",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "low",
      confidence: 1.0,
      reasonCode: "BROKEN_ASSETS_DETECTED",
      summary: `Discovered ${brokenAssets.length} broken asset(s) or link(s) returning HTTP error status.`,
      evidenceIds: [eid],
      remediationTemplateId: "fix_broken_assets",
      requiresHumanReview: false,
    };
  },
};

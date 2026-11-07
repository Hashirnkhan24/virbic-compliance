import type { CheckDefinition } from "../../framework/types";

export const d9SourceMapsCheck: CheckDefinition = {
  id: "D9",
  version: "1.0.0",
  title: "Source maps exposed",
  description: "Detects exposed JavaScript or CSS source map files (.map) that disclose original, unminified backend and frontend source code.",
  module: "security",
  wave: "W1",
  requiredEvidence: ["script_token"],
  run: (snapshot, context) => {
    const exposedMapUrls: string[] = [];

    // Check assets for sourcemaps
    for (const asset of snapshot.assets || []) {
      if (asset.assetType === "sourcemap" || (asset.url.endsWith(".map") && asset.httpStatus === 200)) {
        exposedMapUrls.push(asset.url);
      }
    }

    // Check successful network requests for .map files
    for (const req of snapshot.networkRequests) {
      if (req.url.endsWith(".js.map") || req.url.endsWith(".css.map")) {
        if (req.status === 200 && !exposedMapUrls.includes(req.url)) {
          exposedMapUrls.push(req.url);
        }
      }
    }

    if (exposedMapUrls.length > 0) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "script_token",
        {
          exposedMapCount: exposedMapUrls.length,
          sampleUrls: exposedMapUrls.slice(0, 5),
          securityImpact: "Exposed source maps allow attackers to reconstruct original application source code, comments, and internal paths.",
        },
        {
          sourceLocator: exposedMapUrls[0],
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "D9",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "low",
        confidence: 1.0,
        reasonCode: "SOURCE_MAP_EXPOSED_IN_PRODUCTION",
        summary: `Publicly accessible source map file(s) detected (${exposedMapUrls.length} file(s)). Disable source maps in production builds.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "disable_production_source_maps",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "D9",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "NO_PUBLIC_SOURCE_MAPS",
      summary: "Production JavaScript and CSS bundles do not leak public source map references.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

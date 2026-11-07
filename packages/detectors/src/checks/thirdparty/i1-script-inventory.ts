import type { CheckDefinition } from "../../framework/types";

export const i1ScriptInventoryCheck: CheckDefinition = {
  id: "I1",
  version: "1.0.0",
  title: "Third-party script inventory",
  description: "Inventories all third-party script origins and flags excessive external JavaScript execution dependencies.",
  module: "third_party",
  wave: "W1",
  requiredEvidence: ["script_token"],
  run: (snapshot, context) => {
    const thirdPartyDomains = new Set<string>();
    const scriptUrls: string[] = [];

    for (const req of snapshot.networkRequests) {
      if (req.isThirdParty && req.resourceType === "script") {
        try {
          const host = new URL(req.url).hostname;
          thirdPartyDomains.add(host);
          if (scriptUrls.length < 15) scriptUrls.push(req.url);
        } catch {}
      }
    }

    for (const asset of snapshot.assets || []) {
      if (asset.assetType === "script") {
        try {
          const host = new URL(asset.url).hostname;
          if (host !== snapshot.targetHost && !host.endsWith("." + snapshot.targetHost)) {
            thirdPartyDomains.add(host);
            if (scriptUrls.length < 15) scriptUrls.push(asset.url);
          }
        } catch {}
      }
    }

    const domainList = Array.from(thirdPartyDomains);

    // If more than 10 external third-party domains run arbitrary scripts
    if (domainList.length > 10) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "script_token",
        {
          totalThirdPartyOrigins: domainList.length,
          origins: domainList,
          sampleScripts: scriptUrls.slice(0, 5),
          securityRisk: "Excessive third-party scripts expand the site's attack surface, increase supply chain risk (Magecart), and degrade page performance.",
        },
        {
          sourceLocator: "script[src]",
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "I1",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 0.95,
        reasonCode: "EXCESSIVE_THIRD_PARTY_SCRIPTS",
        summary: `Site executes scripts from ${domainList.length} distinct third-party origins, presenting high supply-chain and performance risk.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "audit_and_consolidate_third_party_scripts",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "I1",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "THIRD_PARTY_SCRIPT_INVENTORY_ACCEPTABLE",
      summary: `Third-party script footprint is restrained (${domainList.length} external domain(s) observed).`,
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

import type { CheckDefinition } from "../../framework/types";

const SHARED_CDN_PATTERNS = [
  /cdn\.jsdelivr\.net/i,
  /cdnjs\.cloudflare\.com/i,
  /unpkg\.com/i,
  /stackpath\.bootstrapcdn\.com/i,
  /code\.jquery\.com/i,
];

export const i3ScriptIntegrityCheck: CheckDefinition = {
  id: "I3",
  version: "1.0.0",
  title: "Third-party script integrity and risk",
  description: "Verifies that external JavaScript libraries loaded from shared public CDNs declare Subresource Integrity (SRI) attributes to protect against CDN compromises.",
  module: "third_party",
  wave: "W1",
  requiredEvidence: ["script_token"],
  run: (snapshot, context) => {
    const unverifiedCdnScripts: string[] = [];

    // Check script assets in snapshot
    for (const asset of snapshot.assets || []) {
      if (asset.assetType === "script") {
        const isSharedCdn = SHARED_CDN_PATTERNS.some((p) => p.test(asset.url));
        if (isSharedCdn && !asset.hasSri) {
          unverifiedCdnScripts.push(asset.url);
        }
      }
    }

    // Check scripts in page domFacts
    for (const page of snapshot.pages) {
      const pageFacts = page.domFacts || {};
      const scripts = (pageFacts.scripts as Array<{ src?: string; integrity?: string }>) || [];

      for (const s of scripts) {
        const scriptSrc = s.src;
        if (!scriptSrc) continue;
        const isSharedCdn = SHARED_CDN_PATTERNS.some((p) => p.test(scriptSrc));
        if (isSharedCdn && (!s.integrity || s.integrity.trim() === "")) {
          if (!unverifiedCdnScripts.includes(scriptSrc)) {
            unverifiedCdnScripts.push(scriptSrc);
          }
        }
      }
    }

    if (unverifiedCdnScripts.length > 0) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "script_token",
        {
          unprotectedScriptCount: unverifiedCdnScripts.length,
          sampleScripts: unverifiedCdnScripts.slice(0, 5),
          securityNotice: "Subresource Integrity (SRI) prevents malicious code execution if an external CDN provider or edge mirror is compromised.",
        },
        {
          sourceLocator: unverifiedCdnScripts[0] ?? "script",
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "I3",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 1.0,
        reasonCode: "MISSING_SUBRESOURCE_INTEGRITY",
        summary: `Discovered ${unverifiedCdnScripts.length} public CDN script(s) loaded without cryptographic Subresource Integrity (SRI) verification hashes.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "implement_subresource_integrity",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "I3",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "SUBRESOURCE_INTEGRITY_COMPLIANT",
      summary: "All third-party CDN scripts implement cryptographic Subresource Integrity hashes or assets are self-hosted.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

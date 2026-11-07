import type { CheckDefinition } from "../../framework/types";

interface SecretPattern {
  name: string;
  pattern: RegExp;
  mask: (val: string) => string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "AWS Access Key ID",
    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
    mask: (v) => v.slice(0, 4) + "*".repeat(v.length - 4),
  },
  {
    name: "Stripe Live Secret Key",
    pattern: /\b(sk_live_[0-9a-zA-Z]{24,})\b/g,
    mask: (v) => v.slice(0, 8) + "*".repeat(v.length - 8),
  },
  {
    name: "GitHub Personal Access Token",
    pattern: /\b(ghp_[0-9a-zA-Z]{36})\b/g,
    mask: (v) => v.slice(0, 4) + "*".repeat(v.length - 4),
  },
  {
    name: "Slack Bot Token",
    pattern: /\b(xoxb-[0-9]{10,}-[0-9]{10,}-[0-9a-zA-Z]{20,})\b/g,
    mask: (v) => v.slice(0, 5) + "*".repeat(v.length - 5),
  },
  {
    name: "Private Key Block",
    pattern: /(-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----)/g,
    mask: () => "-----BEGIN [REDACTED PRIVATE KEY]-----",
  },
];

export const d1ExposedSecretsCheck: CheckDefinition = {
  id: "D1",
  version: "1.0.0",
  title: "Exposed API keys/secrets in JS",
  description: "Detects exposed administrative API keys, cloud credentials, and private secret tokens leaked in client-side bundles.",
  module: "security",
  wave: "W1",
  requiredEvidence: ["script_token"],
  run: (snapshot, context) => {
    const discoveredSecrets: Array<{ type: string; masked: string; source: string }> = [];

    // Check script contents / inline texts
    for (const page of snapshot.pages) {
      const pageFacts = page.domFacts || {};
      const scripts = (pageFacts.scripts as Array<{ src?: string; content?: string }>) || [];

      for (const s of scripts) {
        const textToScan = (s.content || "") + " " + (s.src || "");
        for (const rule of SECRET_PATTERNS) {
          const matches = textToScan.matchAll(rule.pattern);
          for (const match of matches) {
            const rawVal = match[1] || match[0];
            discoveredSecrets.push({
              type: rule.name,
              masked: rule.mask(rawVal),
              source: s.src || "inline <script>",
            });
          }
        }
      }
    }

    if (discoveredSecrets.length > 0) {
      // Invariant: NEVER store raw secrets; store masked tokens only!
      const evidenceId = context.evidenceCollector.registerEvidence(
        "script_token",
        {
          secretCount: discoveredSecrets.length,
          findings: discoveredSecrets,
          ruleNotice: "Values are masked for security. Immediate credential rotation is required.",
        },
        {
          sourceLocator: discoveredSecrets[0]?.source ?? "script",
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "D1",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "critical",
        confidence: 1.0,
        reasonCode: "EXPOSED_SECRET_IN_FRONTEND_CODE",
        summary: `Detected ${discoveredSecrets.length} high-entropy secret token(s) or API key(s) in frontend scripts. Immediate rotation is mandatory.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "revoke_and_rotate_exposed_secrets",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "D1",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "NO_EXPOSED_SECRETS_DETECTED",
      summary: "No exposed cloud API keys, private tokens, or server-side credentials were found in client bundles.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

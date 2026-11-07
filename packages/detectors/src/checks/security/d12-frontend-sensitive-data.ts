import type { CheckDefinition } from "../../framework/types";

const SENSITIVE_PATTERNS = [
  { name: "Database Connection String", pattern: /(mongodb|postgres|postgresql|mysql|redis):\/\/[^\s"']+/gi },
  { name: "Hardcoded Database Password", pattern: /(DB_PASSWORD|DATABASE_PASSWORD|POSTGRES_PASSWORD)\s*[:=]\s*["'][^"']+["']/gi },
  { name: "Internal Admin Token", pattern: /(ADMIN_SECRET|JWT_SECRET|INTERNAL_API_KEY)\s*[:=]\s*["'][^"']+["']/gi },
];

export const d12FrontendSensitiveDataCheck: CheckDefinition = {
  id: "D12",
  version: "1.0.0",
  title: "Sensitive data in frontend",
  description: "Detects internal database strings, backend passwords, and sensitive server configuration tokens leaked into client-side DOM or bundles.",
  module: "security",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  run: (snapshot, context) => {
    const findings: Array<{ type: string; snippet: string; pageUrl: string }> = [];

    for (const page of snapshot.pages) {
      const pageFacts = page.domFacts || {};
      const scripts = (pageFacts.scripts as Array<{ content?: string; src?: string }>) || [];
      const textToScan = [
        page.title || "",
        page.metaDescription || "",
        JSON.stringify(pageFacts),
        ...scripts.map((s) => s.content || ""),
      ].join(" ");

      for (const pattern of SENSITIVE_PATTERNS) {
        const matches = textToScan.matchAll(pattern.pattern);
        for (const match of matches) {
          const raw = match[0];
          // Redact password or credential portion
          const redacted = raw.replace(/:([^\/@]+)@/, ":[REDACTED]@");
          findings.push({
            type: pattern.name,
            snippet: redacted.slice(0, 40) + "...",
            pageUrl: page.url,
          });
        }
      }
    }

    if (findings.length > 0) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "dom_element",
        {
          findingsCount: findings.length,
          findings,
          notice: "Credentials redacted in evidence. Immediately purge these references from public build outputs.",
        },
        {
          sourceLocator: "DOM / script content",
          pageUrl: findings[0]?.pageUrl ?? snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "D12",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "critical",
        confidence: 1.0,
        reasonCode: "SENSITIVE_DATA_LEAK_IN_FRONTEND",
        summary: `Discovered ${findings.length} instance(s) of backend database strings or server passwords exposed in frontend assets.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "sanitize_frontend_build_artifacts",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "D12",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "NO_SENSITIVE_DATA_IN_FRONTEND",
      summary: "No database URIs, backend connection strings, or server environment passwords detected in client assets.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

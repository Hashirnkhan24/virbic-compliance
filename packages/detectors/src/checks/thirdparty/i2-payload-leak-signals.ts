import type { CheckDefinition } from "../../framework/types";

const SENSITIVE_QUERY_PATTERNS = [
  { name: "Email Parameter", pattern: /[?&](?:email|user_email|userEmail)=([^&#\s]+)/i },
  { name: "Password Parameter", pattern: /[?&](?:password|passwd|pwd)=([^&#\s]+)/i },
  { name: "Auth / Bearer Token", pattern: /[?&](?:access_token|authToken|api_key|token)=([^&#\s]+)/i },
  { name: "National ID / PAN", pattern: /[?&](?:ssn|aadhaar|pan_card|pan)=([^&#\s]+)/i },
];

export const i2PayloadLeakSignalsCheck: CheckDefinition = {
  id: "I2",
  version: "1.0.0",
  title: "Sensitive data sent to third parties",
  description: "Audits outgoing third-party network requests and query strings for inadvertent transmission of plain emails, passwords, or authentication tokens.",
  module: "third_party",
  wave: "W1",
  requiredEvidence: ["network_request"],
  run: (snapshot, context) => {
    const leakFindings: Array<{ type: string; thirdPartyUrl: string; reason: string }> = [];

    for (const req of snapshot.networkRequests) {
      if (!req.isThirdParty) continue;

      for (const pattern of SENSITIVE_QUERY_PATTERNS) {
        const match = req.url.match(pattern.pattern);
        if (match) {
          // Redact parameter value before saving
          const redactedUrl = req.url.replace(pattern.pattern, (m, val) => m.replace(val, "[REDACTED]"));
          leakFindings.push({
            type: pattern.name,
            thirdPartyUrl: redactedUrl,
            reason: `Query string transmits ${pattern.name} to external third-party destination.`,
          });
        }
      }

      // Check postDataRedacted if present
      if (req.postDataRedacted) {
        if (/password|passwd|user_secret/i.test(req.postDataRedacted)) {
          leakFindings.push({
            type: "POST Payload Secret",
            thirdPartyUrl: req.url,
            reason: "POST body transmitted to third-party endpoint appears to contain credential parameters.",
          });
        }
      }
    }

    if (leakFindings.length > 0) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "network_request",
        {
          leakCount: leakFindings.length,
          findings: leakFindings,
          regulatoryNotice: "Transmitting unhashed user credentials or email identifiers to third-party analytics/ad trackers constitutes an actionable privacy breach under DPDP and GDPR.",
        },
        {
          sourceLocator: leakFindings[0]?.thirdPartyUrl ?? "third-party request",
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "I2",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "critical",
        confidence: 0.95,
        reasonCode: "SENSITIVE_DATA_LEAKED_TO_THIRD_PARTY",
        summary: `Detected ${leakFindings.length} third-party transmission(s) exposing emails, tokens, or credential keys in query parameters.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "stop_pii_transmission_to_third_parties",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "I2",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "NO_PII_LEAKAGE_TO_THIRD_PARTIES",
      summary: "No plain user credentials, emails, or authorization tokens were observed in outgoing third-party network transmissions.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

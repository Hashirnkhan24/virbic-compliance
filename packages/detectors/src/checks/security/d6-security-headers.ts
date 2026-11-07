import type { CheckDefinition } from "../../framework/types";

export const d6SecurityHeadersCheck: CheckDefinition = {
  id: "D6",
  version: "1.0.0",
  title: "Security headers",
  description: "Audits essential HTTP security response headers: HSTS, CSP, X-Content-Type-Options, and X-Frame-Options.",
  module: "security",
  wave: "W1",
  requiredEvidence: ["header"],
  run: (snapshot, context) => {
    const headers = snapshot.responseHeaders;
    const headerMap = new Map<string, string>();
    for (const h of headers) {
      headerMap.set(h.name.toLowerCase(), h.value);
    }

    const missingHeaders: string[] = [];
    if (!headerMap.has("strict-transport-security")) {
      missingHeaders.push("Strict-Transport-Security");
    }
    if (!headerMap.has("x-content-type-options")) {
      missingHeaders.push("X-Content-Type-Options");
    }
    if (!headerMap.has("x-frame-options") && !headerMap.has("content-security-policy")) {
      missingHeaders.push("X-Frame-Options / CSP frame-ancestors");
    }

    if (missingHeaders.length === 0) {
      return {
        checkId: "D6",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "SECURITY_HEADERS_SATISFIED",
        summary: "Core HTTP security headers are properly configured.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    const eid = context.evidenceCollector.registerEvidence(
      "header",
      {
        missingHeaders,
        configuredHeaders: Array.from(headerMap.keys()),
      },
      {
        sourceLocator: "response_headers",
        pageUrl: snapshot.canonicalOrigin,
      }
    );

    return {
      checkId: "D6",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: missingHeaders.includes("Strict-Transport-Security") ? "high" : "medium",
      confidence: 1.0,
      reasonCode: "SECURITY_HEADERS_MISSING",
      summary: `Missing ${missingHeaders.length} essential security header(s): ${missingHeaders.join(", ")}.`,
      evidenceIds: [eid],
      remediationTemplateId: "configure_security_headers",
      requiresHumanReview: false,
    };
  },
};

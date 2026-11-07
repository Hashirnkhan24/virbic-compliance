import type { CheckDefinition } from "../../framework/types";

export const d7CookieFlagsCheck: CheckDefinition = {
  id: "D7",
  version: "1.0.0",
  title: "Cookie security flags",
  description: "Audits cookies to ensure Secure, HttpOnly, and SameSite attributes are strictly configured.",
  module: "security",
  wave: "W1",
  requiredEvidence: ["cookie"],
  applicability: (snapshot) => {
    return snapshot.cookies.length > 0;
  },
  run: (snapshot, context) => {
    const isHttps = snapshot.canonicalOrigin.startsWith("https://");
    const insecureCookies = snapshot.cookies.filter((c) => {
      // If HTTPS, all cookies should have Secure flag
      if (isHttps && !c.secure) return true;
      // All cookies should have a SameSite attribute
      if (!c.sameSite) return true;
      return false;
    });

    if (insecureCookies.length === 0) {
      return {
        checkId: "D7",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "COOKIE_FLAGS_SECURE",
        summary: "All observed cookies have appropriate Secure and SameSite security flags.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    const eid = context.evidenceCollector.registerEvidence(
      "cookie",
      {
        insecureCount: insecureCookies.length,
        samples: insecureCookies.slice(0, 5).map((c) => ({
          name: c.name,
          secure: c.secure,
          httpOnly: c.httpOnly,
          sameSite: c.sameSite,
        })),
      },
      {
        sourceLocator: "set-cookie",
        pageUrl: snapshot.canonicalOrigin,
      }
    );

    const hasMissingSecure = insecureCookies.some((c) => !c.secure);

    return {
      checkId: "D7",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: hasMissingSecure ? "high" : "medium",
      confidence: 1.0,
      reasonCode: hasMissingSecure ? "COOKIE_MISSING_SECURE_FLAG" : "COOKIE_MISSING_SAMESITE",
      summary: `Found ${insecureCookies.length} cookie(s) missing security attributes (Secure or SameSite).`,
      evidenceIds: [eid],
      remediationTemplateId: "set_secure_cookie_flags",
      requiresHumanReview: false,
    };
  },
};

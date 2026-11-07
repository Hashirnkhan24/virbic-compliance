import type { CheckDefinition } from "../../framework/types";

export const d5HttpsTlsCheck: CheckDefinition = {
  id: "D5",
  version: "1.0.0",
  title: "HTTPS / TLS enforcement and certificate validity",
  description: "Verifies that the website strictly enforces HTTPS and presents a valid, unexpired TLS certificate.",
  module: "security",
  wave: "W1",
  requiredEvidence: ["tls_cert"],
  run: (snapshot, context) => {
    const tls = snapshot.tls;

    if (!tls.enforcesHttps) {
      const eid = context.evidenceCollector.registerEvidence(
        "tls_cert",
        {
          targetHost: snapshot.targetHost,
          enforcesHttps: false,
          valid: tls.valid,
        },
        {
          sourceLocator: `port:443`,
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "D5",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "critical",
        confidence: 1.0,
        reasonCode: "HTTPS_NOT_ENFORCED",
        summary: "The website does not strictly enforce HTTPS connections across navigation.",
        evidenceIds: [eid],
        remediationTemplateId: "enable_https_redirect",
        requiresHumanReview: false,
      };
    }

    if (!tls.valid) {
      const eid = context.evidenceCollector.registerEvidence(
        "tls_cert",
        {
          targetHost: snapshot.targetHost,
          valid: false,
          issuer: tls.issuer,
          daysRemaining: tls.daysRemaining,
        },
        {
          sourceLocator: `tls:${snapshot.targetHost}`,
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "D5",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "critical",
        confidence: 1.0,
        reasonCode: "TLS_CERTIFICATE_INVALID",
        summary: "The TLS certificate is invalid, expired, or rejected by trust authorities.",
        evidenceIds: [eid],
        remediationTemplateId: "renew_tls_certificate",
        requiresHumanReview: false,
      };
    }

    if (tls.daysRemaining !== undefined && tls.daysRemaining < 14) {
      const eid = context.evidenceCollector.registerEvidence(
        "tls_cert",
        {
          targetHost: snapshot.targetHost,
          daysRemaining: tls.daysRemaining,
          validTo: tls.validTo,
        },
        {
          sourceLocator: `tls:${snapshot.targetHost}`,
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "D5",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "high",
        confidence: 1.0,
        reasonCode: "TLS_EXPIRING_SOON",
        summary: `The TLS certificate will expire in ${tls.daysRemaining} day(s).`,
        evidenceIds: [eid],
        remediationTemplateId: "renew_tls_certificate",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "D5",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "TLS_HEALTHY",
      summary: `Valid TLS certificate (${tls.protocol || "TLSv1.3"}) with ${tls.daysRemaining ?? "adequate"} days remaining.`,
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

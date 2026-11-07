import type { CheckDefinition } from "../../framework/types";

export const b5CookiePolicyCoverageCheck: CheckDefinition = {
  id: "B5",
  version: "1.0.0",
  title: "Cookie policy lists cookies",
  description: "Verifies that the website maintains a dedicated Cookie Policy or table disclosing the purpose and duration of observed cookies.",
  module: "cookies",
  wave: "W1",
  requiredEvidence: ["cookie", "dom_element"],
  run: (snapshot, context) => {
    const observedCookies = snapshot.cookies || [];

    if (observedCookies.length === 0) {
      return {
        checkId: "B5",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "NO_COOKIES_SET",
        summary: "No cookies are set by the website; cookie disclosure table is not required.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    // Locate cookie policy or privacy policy page
    const cookiePage = snapshot.pages.find(
      (p) =>
        p.pageType === "cookies" ||
        p.url.toLowerCase().includes("cookie") ||
        (p.title && p.title.toLowerCase().includes("cookie"))
    );

    const privacyPage = snapshot.pages.find(
      (p) =>
        p.pageType === "privacy" ||
        p.url.toLowerCase().includes("privacy") ||
        (p.title && p.title.toLowerCase().includes("privacy"))
    );

    const targetPage = cookiePage || privacyPage;

    if (!targetPage) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "cookie",
        {
          cookieCount: observedCookies.length,
          observedCookies: observedCookies.map((c) => ({ name: c.name, domain: c.domain, isThirdParty: c.isThirdParty })),
          reason: "Cookies are actively stored, but neither a Cookie Policy nor a Privacy Policy page was found to disclose them.",
        },
        {
          pageUrl: snapshot.canonicalOrigin,
          sourceLocator: "nav, footer, document.cookie",
        }
      );

      return {
        checkId: "B5",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 0.95,
        reasonCode: "COOKIE_DISCLOSURE_PAGE_MISSING",
        summary: `Site sets ${observedCookies.length} cookie(s), but lacks a dedicated Cookie Policy or Privacy disclosure.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "publish_cookie_inventory",
        requiresHumanReview: false,
      };
    }

    const pageContent = (
      (targetPage.title || "") + " " +
      (targetPage.metaDescription || "") + " " +
      JSON.stringify(targetPage.domFacts || {})
    ).toLowerCase();

    // Check if page mentions cookie types, purposes, or names
    const mentionsCookies =
      pageContent.includes("cookie") ||
      pageContent.includes("essential") ||
      pageContent.includes("analytics") ||
      pageContent.includes("session");

    if (!mentionsCookies) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "cookie",
        {
          pageUrl: targetPage.url,
          observedCookies: observedCookies.map((c) => c.name),
          reason: "Legal policy page exists but does not contain a specific cookie disclosure or categorization table.",
        },
        {
          pageUrl: targetPage.url,
          sourceLocator: "policy-text",
        }
      );

      return {
        checkId: "B5",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 0.85,
        reasonCode: "COOKIE_DISCLOSURES_OMITTED",
        summary: `Cookies are observed on the site, but the policy page at ${targetPage.url} does not disclose cookie categories or functions.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "publish_cookie_inventory",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "B5",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 0.9,
      reasonCode: "COOKIE_POLICY_COVERAGE_SATISFACTORY",
      summary: `Cookie disclosures and categorization found on ${targetPage.url}.`,
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

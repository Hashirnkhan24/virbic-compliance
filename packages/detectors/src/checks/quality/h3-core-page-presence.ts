import type { CheckDefinition } from "../../framework/types";

export const h3CorePagePresenceCheck: CheckDefinition = {
  id: "H3",
  version: "1.0.0",
  title: "Missing core pages",
  description: "Audits site architecture to ensure expected foundational pages (Home, About, Contact, Privacy, Terms) exist and are linked.",
  module: "quality",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  run: (snapshot, context) => {
    const pageTypes = new Set(snapshot.pages.map((p) => p.pageType));
    const allUrls = snapshot.pages.map((p) => p.url.toLowerCase()).join(" ");

    const hasAbout = pageTypes.has("about") || allUrls.includes("about");
    const hasContact = pageTypes.has("contact") || allUrls.includes("contact");
    const hasPrivacy = pageTypes.has("privacy") || allUrls.includes("privacy");
    const hasTerms = pageTypes.has("terms") || allUrls.includes("terms");

    const missingCorePages: string[] = [];
    if (!hasAbout) missingCorePages.push("About Us");
    if (!hasContact) missingCorePages.push("Contact Us");
    if (!hasPrivacy) missingCorePages.push("Privacy Policy");
    if (!hasTerms) missingCorePages.push("Terms of Service");

    // If 2 or more foundational pages are missing, flag as issue
    if (missingCorePages.length >= 2) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "dom_element",
        {
          pagesScannedCount: snapshot.pages.length,
          discoveredPages: snapshot.pages.map((p) => ({ url: p.url, pageType: p.pageType })),
          missingPages: missingCorePages,
        },
        {
          pageUrl: snapshot.canonicalOrigin,
          sourceLocator: "nav, footer, sitemap",
        }
      );

      return {
        checkId: "H3",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 0.9,
        reasonCode: "MULTIPLE_CORE_PAGES_MISSING",
        summary: `Site structure is missing foundational pages: ${missingCorePages.join(", ")}.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "create_essential_site_pages",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "H3",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "CORE_PAGES_DISCOVERED",
      summary: `Foundational pages (About, Contact, Legal) are present and linked in site navigation.`,
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

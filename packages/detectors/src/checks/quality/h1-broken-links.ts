import type { CheckDefinition } from "../../framework/types";

export const h1BrokenLinksCheck: CheckDefinition = {
  id: "H1",
  version: "1.0.0",
  title: "Broken links and 404s",
  description: "Audits discovered internal pages and navigation links for HTTP 404 Not Found or 5xx server error responses.",
  module: "quality",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  run: (snapshot, context) => {
    const brokenPages = snapshot.pages.filter((p) => p.httpStatus >= 400);

    if (brokenPages.length === 0) {
      return {
        checkId: "H1",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "ALL_PAGES_RESOLVE_SUCCESSFULLY",
        summary: "All discovered internal pages and navigation links returned successful HTTP status codes.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    const eid = context.evidenceCollector.registerEvidence(
      "dom_element",
      {
        brokenPageCount: brokenPages.length,
        brokenPages: brokenPages.map((p) => ({
          url: p.url,
          status: p.httpStatus,
          pageType: p.pageType,
        })),
      },
      {
        sourceLocator: "internal navigation links",
        pageUrl: snapshot.canonicalOrigin,
      }
    );

    return {
      checkId: "H1",
      checkVersion: "1.0.0",
      status: "issue_found",
      severity: "medium",
      confidence: 1.0,
      reasonCode: "BROKEN_INTERNAL_LINKS_DETECTED",
      summary: `Discovered ${brokenPages.length} internal page(s) returning HTTP 4xx/5xx error responses.`,
      evidenceIds: [eid],
      remediationTemplateId: "fix_broken_navigation_links",
      requiresHumanReview: false,
    };
  },
};

// Backwards compatibility alias
export const h1BrokenAssetsCheck = h1BrokenLinksCheck;

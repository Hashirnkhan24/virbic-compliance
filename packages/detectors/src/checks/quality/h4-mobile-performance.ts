import type { CheckDefinition } from "../../framework/types";

export const h4MobilePerformanceCheck: CheckDefinition = {
  id: "H4",
  version: "1.0.0",
  title: "Mobile and performance basics",
  description: "Evaluates baseline page load timing and responsive viewport configuration across discovered pages (without third-party Lighthouse dependencies).",
  module: "quality",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  run: (snapshot, context) => {
    const slowPages: Array<{ url: string; durationMs: number }> = [];
    const nonResponsivePages: string[] = [];

    for (const page of snapshot.pages) {
      if (page.loadDurationMs > 8000) {
        slowPages.push({ url: page.url, durationMs: page.loadDurationMs });
      }
      if (!page.viewport || !page.viewport.includes("width=device-width")) {
        nonResponsivePages.push(page.url);
      }
    }

    if (slowPages.length > 0 || nonResponsivePages.length > 0) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "dom_element",
        {
          slowPages,
          nonResponsivePages,
          thresholdNotice: "Page load times exceeding 8,000ms or missing device-width viewports degrade mobile conversion and bounce rates.",
        },
        {
          pageUrl: snapshot.canonicalOrigin,
          sourceLocator: "meta[name='viewport'], NavigationTiming",
        }
      );

      return {
        checkId: "H4",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 0.95,
        reasonCode: "SUBOPTIMAL_PAGE_PERFORMANCE_OR_VIEWPORT",
        summary: `Identified ${slowPages.length} slow loading page(s) (>8s) and ${nonResponsivePages.length} page(s) missing mobile viewports.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "optimize_asset_delivery_and_load_speed",
        requiresHumanReview: false,
      };
    }

    const avgDurationMs =
      snapshot.pages.reduce((acc, p) => acc + p.loadDurationMs, 0) / (snapshot.pages.length || 1);

    return {
      checkId: "H4",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "PERFORMANCE_AND_MOBILE_BASICS_MET",
      summary: `Pages respond within acceptable time limits (average ${Math.round(avgDurationMs)}ms) and configure responsive mobile viewports.`,
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

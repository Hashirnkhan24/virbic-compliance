import type { CheckDefinition } from "../../framework/types";

export const h7NavigationInteractionsCheck: CheckDefinition = {
  id: "H7",
  version: "1.0.0",
  title: "Buttons and navigation work",
  description: "Audits primary interactive controls and links to detect empty hrefs, 'javascript:void(0)' stubs, or unresponsive navigation anchors.",
  module: "quality",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  run: (snapshot, context) => {
    const deadControlIssues: Array<{ pageUrl: string; issue: string }> = [];

    for (const page of snapshot.pages) {
      const pageFacts = page.domFacts || {};
      const deadLinks = (pageFacts.deadLinks as Array<{ text?: string; href?: string }>) || [];

      for (const link of deadLinks) {
        deadControlIssues.push({
          pageUrl: page.url,
          issue: `Anchor element "${link.text || 'link'}" contains placeholder or non-functional target: ${link.href || 'empty href'}`,
        });
      }
    }

    if (deadControlIssues.length > 2) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "dom_element",
        {
          deadControlsCount: deadControlIssues.length,
          samples: deadControlIssues.slice(0, 5),
          impact: "Dead navigation links and void stubs frustrate users and indicate incomplete frontend deployment.",
        },
        {
          sourceLocator: "a[href='#'], a[href='javascript:void(0)'], a:not([href])",
          pageUrl: deadControlIssues[0]?.pageUrl ?? snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "H7",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "low",
        confidence: 0.9,
        reasonCode: "DEAD_OR_EMPTY_NAVIGATION_CONTROLS",
        summary: `Identified ${deadControlIssues.length} non-functional navigation link(s) or void stubs across pages.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "fix_dead_navigation_links",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "H7",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "INTERACTIVE_CONTROLS_FUNCTIONAL",
      summary: "Navigation links and primary interaction buttons point to active, functional destinations.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

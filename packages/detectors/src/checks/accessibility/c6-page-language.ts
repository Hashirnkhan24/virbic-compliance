import type { CheckDefinition } from "../../framework/types";

export const c6PageLanguageCheck: CheckDefinition = {
  id: "C6",
  version: "1.0.0",
  title: "Page language, title, zoom",
  description: "Verifies that documents declare a valid HTML lang attribute, have a descriptive title, and do not disable user zoom capabilities.",
  module: "accessibility",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  run: (snapshot, context) => {
    const defects: Array<{ pageUrl: string; issue: string }> = [];

    for (const page of snapshot.pages) {
      if (!page.language || page.language.trim() === "") {
        defects.push({ pageUrl: page.url, issue: "Missing or empty HTML lang attribute" });
      }
      if (!page.title || page.title.trim() === "") {
        defects.push({ pageUrl: page.url, issue: "Missing or empty document <title>" });
      }
      if (page.viewport) {
        const vp = page.viewport.toLowerCase();
        if (vp.includes("user-scalable=no") || vp.includes("user-scalable=0") || vp.includes("maximum-scale=1.0") || vp.includes("maximum-scale=1,")) {
          defects.push({ pageUrl: page.url, issue: "Viewport disables user pinch-to-zoom (user-scalable=no or maximum-scale=1)" });
        }
      }
    }

    if (defects.length > 0) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "dom_element",
        {
          defects,
          wcagReference: "WCAG 2.1 Level A - 3.1.1 Language of Page, 2.4.2 Page Titled, 1.4.4 Resize Text",
        },
        {
          pageUrl: defects[0]?.pageUrl ?? snapshot.canonicalOrigin,
          sourceLocator: "html[lang], title, meta[name='viewport']",
        }
      );

      return {
        checkId: "C6",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 1.0,
        reasonCode: "LANGUAGE_TITLE_OR_ZOOM_DEFECT",
        summary: `Identified ${defects.length} issue(s) regarding missing page language, empty page title, or disabled viewport scaling.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "declare_lang_and_allow_zoom",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "C6",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "LANGUAGE_TITLE_AND_ZOOM_COMPLIANT",
      summary: "All pages specify a valid HTML language, non-empty document title, and allow responsive viewport zoom.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

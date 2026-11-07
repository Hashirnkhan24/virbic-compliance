import type { CheckDefinition } from "../../framework/types";

export const c10TouchTargetsCheck: CheckDefinition = {
  id: "C10",
  version: "1.0.0",
  title: "Touch target size and responsive",
  description: "Verifies responsive mobile viewport configuration and that touch interactive targets provide sufficient size (WCAG 2.5.8 Target Size Minimum).",
  module: "accessibility",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  run: (snapshot, context) => {
    const defects: Array<{ pageUrl: string; issue: string }> = [];

    // 1. Check viewport tag presence across pages
    for (const page of snapshot.pages) {
      if (!page.viewport || !page.viewport.toLowerCase().includes("width=device-width")) {
        defects.push({
          pageUrl: page.url,
          issue: "Missing responsive mobile viewport tag (meta[name='viewport' content='width=device-width, initial-scale=1'])",
        });
      }
    }

    // 2. Check axe target-size violation if present
    const targetSizeViolation = (snapshot.accessibilityViolations || []).find(
      (v) => v.id === "target-size"
    );

    if (targetSizeViolation && targetSizeViolation.nodesCount > 0) {
      defects.push({
        pageUrl: snapshot.canonicalOrigin,
        issue: `${targetSizeViolation.nodesCount} element(s) with undersized touch targets (< 24x24 CSS pixels)`,
      });
    }

    if (defects.length > 0) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "dom_element",
        {
          defects,
          wcagReference: "WCAG 2.1 Level AA - 1.4.10 Reflow, WCAG 2.2 Level AA - 2.5.8 Target Size (Minimum)",
        },
        {
          pageUrl: defects[0]?.pageUrl ?? snapshot.canonicalOrigin,
          sourceLocator: "meta[name='viewport'], button, a",
        }
      );

      return {
        checkId: "C10",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 0.95,
        reasonCode: "TOUCH_TARGET_OR_VIEWPORT_DEFECT",
        summary: `Identified touch target or mobile responsiveness defect(s): ${defects.map((d) => d.issue).join("; ")}.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "configure_touch_targets_and_viewport",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "C10",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "TOUCH_TARGETS_RESPONSIVE_COMPLIANT",
      summary: "Mobile viewport configuration is valid and interactive touch targets meet sizing guidelines.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

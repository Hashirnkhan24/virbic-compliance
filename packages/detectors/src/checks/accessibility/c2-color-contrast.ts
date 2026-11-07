import type { CheckDefinition } from "../../framework/types";

export const c2ColorContrastCheck: CheckDefinition = {
  id: "C2",
  version: "1.0.0",
  title: "Colour contrast",
  description: "Verifies that text and interactive elements satisfy minimum WCAG AA contrast ratio requirements (4.5:1 for normal text, 3:1 for large text).",
  module: "accessibility",
  wave: "W1",
  requiredEvidence: ["axe_node"],
  run: (snapshot, context) => {
    const contrastViolation = (snapshot.accessibilityViolations || []).find(
      (v) => v.id === "color-contrast"
    );

    if (contrastViolation && contrastViolation.nodesCount > 0) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "axe_node",
        {
          ruleId: "color-contrast",
          impact: contrastViolation.impact || "serious",
          nodesCount: contrastViolation.nodesCount,
          selectorSample: contrastViolation.selectorSample,
          wcagReference: "WCAG 2.1 Level AA - 1.4.3 Contrast (Minimum)",
        },
        {
          sourceLocator: contrastViolation.selectorSample || "body",
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "C2",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 1.0,
        reasonCode: "COLOR_CONTRAST_DEFICIENT",
        summary: `Found ${contrastViolation.nodesCount} element(s) with insufficient color contrast ratio failing WCAG AA standards.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "fix_color_contrast",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "C2",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "COLOR_CONTRAST_COMPLIANT",
      summary: "All evaluated text and background combinations satisfy WCAG AA contrast requirements.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

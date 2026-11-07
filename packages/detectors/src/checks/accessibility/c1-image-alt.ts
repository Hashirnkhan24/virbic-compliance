import type { CheckDefinition } from "../../framework/types";

export const c1ImageAltCheck: CheckDefinition = {
  id: "C1",
  version: "1.0.0",
  title: "Image alt text",
  description: "Verifies that all visual images contain descriptive alternative text for screen readers.",
  module: "accessibility",
  wave: "W1",
  requiredEvidence: ["axe_node"],
  run: (snapshot, context) => {
    // Check if axe detected image-alt violation
    const axeAltViolation = snapshot.accessibilityViolations.find(
      (v) => v.id === "image-alt"
    );

    if (axeAltViolation) {
      const eid = context.evidenceCollector.registerEvidence(
        "axe_node",
        {
          ruleId: "image-alt",
          impact: axeAltViolation.impact,
          description: axeAltViolation.description,
          nodesCount: axeAltViolation.nodesCount,
          selectorSample: axeAltViolation.selectorSample,
        },
        {
          sourceLocator: axeAltViolation.selectorSample || "img:not([alt])",
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "C1",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 1.0,
        reasonCode: "IMAGE_MISSING_ALT_TEXT",
        summary: `Found ${axeAltViolation.nodesCount} image(s) lacking descriptive alternative text (alt attributes).`,
        evidenceIds: [eid],
        remediationTemplateId: "add_image_alt_attributes",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "C1",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "IMAGE_ALT_SATISFIED",
      summary: "All audited images possess valid alternative text attributes.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

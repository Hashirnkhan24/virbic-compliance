import type { CheckDefinition } from "../../framework/types";

export const c5HeadingLandmarksCheck: CheckDefinition = {
  id: "C5",
  version: "1.0.0",
  title: "Heading and landmark structure",
  description: "Ensures logical heading hierarchy (H1-H6 without skipping levels) and proper HTML5 landmark regions (main, nav, header).",
  module: "accessibility",
  wave: "W1",
  requiredEvidence: ["axe_node"],
  run: (snapshot, context) => {
    const structuralViolations = (snapshot.accessibilityViolations || []).filter((v) =>
      ["heading-order", "landmark-one-main", "region", "page-has-heading-one"].includes(v.id)
    );

    const totalNodes = structuralViolations.reduce((sum, v) => sum + v.nodesCount, 0);

    const primary = structuralViolations[0];
    if (totalNodes > 0 && primary) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "axe_node",
        {
          ruleId: primary.id,
          totalNodes,
          violations: structuralViolations.map((v) => ({
            id: v.id,
            nodesCount: v.nodesCount,
            selectorSample: v.selectorSample,
          })),
          wcagReference: "WCAG 2.1 Level A - 1.3.1 Info and Relationships, 2.4.6 Headings and Labels",
        },
        {
          sourceLocator: primary.selectorSample || "main",
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "C5",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "low",
        confidence: 0.95,
        reasonCode: "HEADING_OR_LANDMARK_DEFECT",
        summary: `Identified ${totalNodes} heading or landmark structure defect(s) hindering screen reader navigation.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "fix_heading_and_landmarks",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "C5",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "HEADING_LANDMARK_STRUCTURE_VALID",
      summary: "Page exhibits clean semantic landmark regions and valid heading hierarchy.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

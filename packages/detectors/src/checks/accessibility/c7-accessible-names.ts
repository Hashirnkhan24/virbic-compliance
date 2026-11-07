import type { CheckDefinition } from "../../framework/types";

export const c7AccessibleNamesCheck: CheckDefinition = {
  id: "C7",
  version: "1.0.0",
  title: "Buttons and links have names",
  description: "Verifies that every interactive button and link element exposes a discernable, accessible text name for assistive technology.",
  module: "accessibility",
  wave: "W1",
  requiredEvidence: ["axe_node"],
  run: (snapshot, context) => {
    const nameViolations = (snapshot.accessibilityViolations || []).filter((v) =>
      ["button-name", "link-name", "aria-command-name"].includes(v.id)
    );

    const totalNodes = nameViolations.reduce((sum, v) => sum + v.nodesCount, 0);

    const primary = nameViolations[0];
    if (totalNodes > 0 && primary) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "axe_node",
        {
          ruleId: primary.id,
          totalNodes,
          violations: nameViolations.map((v) => ({
            id: v.id,
            nodesCount: v.nodesCount,
            selectorSample: v.selectorSample,
          })),
          wcagReference: "WCAG 2.1 Level A - 4.1.2 Name, Role, Value",
        },
        {
          sourceLocator: primary.selectorSample || "button, a",
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "C7",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 1.0,
        reasonCode: "UNNAMED_INTERACTIVE_CONTROLS",
        summary: `Discovered ${totalNodes} button(s) or link(s) without accessible text or aria-label attributes.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "provide_accessible_names",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "C7",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "ACCESSIBLE_NAMES_PRESENT",
      summary: "All interactive buttons and navigation links present discernable accessible names.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

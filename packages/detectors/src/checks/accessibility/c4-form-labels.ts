import type { CheckDefinition } from "../../framework/types";

export const c4FormLabelsCheck: CheckDefinition = {
  id: "C4",
  version: "1.0.0",
  title: "Form labels and error messages",
  description: "Verifies that form inputs, textareas, and select elements have explicitly associated labels or accessible names.",
  module: "accessibility",
  wave: "W1",
  requiredEvidence: ["axe_node"],
  run: (snapshot, context) => {
    const labelViolations = (snapshot.accessibilityViolations || []).filter((v) =>
      ["label", "aria-input-field-name", "select-name", "label-title-only"].includes(v.id)
    );

    const totalOffendingNodes = labelViolations.reduce((sum, v) => sum + v.nodesCount, 0);

    const primaryViolation = labelViolations[0];
    if (totalOffendingNodes > 0 && primaryViolation) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "axe_node",
        {
          ruleId: primaryViolation.id,
          totalOffendingNodes,
          violations: labelViolations.map((v) => ({
            id: v.id,
            nodesCount: v.nodesCount,
            selectorSample: v.selectorSample,
          })),
          wcagReference: "WCAG 2.1 Level A - 3.3.2 Labels or Instructions, 1.3.1 Info and Relationships",
        },
        {
          sourceLocator: primaryViolation.selectorSample || "form input",
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "C4",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 1.0,
        reasonCode: "FORM_LABELS_MISSING",
        summary: `Discovered ${totalOffendingNodes} form input(s) lacking descriptive labels or accessible names.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "add_form_input_labels",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "C4",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "FORM_LABELS_PRESENT",
      summary: "All discovered form controls have accessible labels or ARIA descriptions.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

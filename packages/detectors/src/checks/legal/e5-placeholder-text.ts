import type { CheckDefinition } from "../../framework/types";

const PLACEHOLDER_PATTERNS = [
  /lorem\s+ipsum/i,
  /\[(?:insert\s+)?company(?:\s+name)?\]/i,
  /\[(?:insert\s+)?email(?:\s+address)?\]/i,
  /\[(?:insert\s+)?address\]/i,
  /\[your\s+company(?:\s+name)?\]/i,
  /yourcompany\.com/i,
  /todo:\s*(?:add|insert|update)\s*(?:terms|policy|privacy)/i,
];

export const e5PlaceholderTextCheck: CheckDefinition = {
  id: "E5",
  version: "1.0.0",
  title: "Placeholder/template text",
  description: "Detects unpopulated placeholder phrases ('Lorem ipsum', '[Company Name]', 'yourcompany.com') in public and legal pages.",
  module: "legal",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  run: (snapshot, context) => {
    const discoveredPlaceholders: Array<{ pageUrl: string; match: string }> = [];

    for (const page of snapshot.pages) {
      const pageText = [
        page.title || "",
        page.metaDescription || "",
        JSON.stringify(page.domFacts || {}),
      ].join(" ");

      for (const pattern of PLACEHOLDER_PATTERNS) {
        const match = pageText.match(pattern);
        if (match) {
          discoveredPlaceholders.push({
            pageUrl: page.url,
            match: match[0],
          });
        }
      }
    }

    if (discoveredPlaceholders.length > 0) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "dom_element",
        {
          placeholdersFound: discoveredPlaceholders,
          risk: "Unpopulated placeholder text compromises legal enforceability and suggests launch unreadiness.",
        },
        {
          sourceLocator: "body text / template",
          pageUrl: discoveredPlaceholders[0]?.pageUrl ?? snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "E5",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 0.95,
        reasonCode: "PLACEHOLDER_TEXT_IN_LEGAL_DOCUMENTS",
        summary: `Detected ${discoveredPlaceholders.length} unpopulated template or boilerplate placeholder(s) (e.g. "${discoveredPlaceholders[0]?.match ?? ""}") across site pages.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "replace_template_placeholder_text",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "E5",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "NO_PLACEHOLDER_TEXT_DETECTED",
      summary: "No generic boilerplate placeholders or unpopulated legal template tokens were identified.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

import type { CheckDefinition } from "../../framework/types";

export const c9MediaCaptionsCheck: CheckDefinition = {
  id: "C9",
  version: "1.0.0",
  title: "Media captions and autoplay",
  description: "Detects unmuted autoplaying media and checks that HTML5 video elements include caption or subtitle tracks.",
  module: "accessibility",
  wave: "W1",
  requiredEvidence: ["dom_element"],
  run: (snapshot, context) => {
    const mediaDefects: Array<{ pageUrl: string; issue: string }> = [];

    for (const page of snapshot.pages) {
      const pageFacts = page.domFacts || {};
      const mediaList = (pageFacts.media as Array<{ tag: string; autoplay?: boolean; muted?: boolean; hasCaptions?: boolean }>) || [];

      for (const m of mediaList) {
        if (m.autoplay && !m.muted) {
          mediaDefects.push({
            pageUrl: page.url,
            issue: "Media plays automatically without muted attribute, violating WCAG audio control standards.",
          });
        }
        if (m.tag === "video" && !m.hasCaptions) {
          mediaDefects.push({
            pageUrl: page.url,
            issue: "Video element lacks a track element with kind='captions' or kind='subtitles'.",
          });
        }
      }
    }

    if (mediaDefects.length > 0) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "dom_element",
        {
          defects: mediaDefects,
          wcagReference: "WCAG 2.1 Level A - 1.2.2 Captions (Prerecorded), 1.4.2 Audio Control",
        },
        {
          pageUrl: mediaDefects[0]?.pageUrl ?? snapshot.canonicalOrigin,
          sourceLocator: "video, audio[autoplay]",
        }
      );

      return {
        checkId: "C9",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "medium",
        confidence: 0.95,
        reasonCode: "UNMUTED_AUTOPLAY_OR_NO_CAPTIONS",
        summary: `Identified ${mediaDefects.length} media accessibility defect(s) including unmuted autoplay or missing caption tracks.`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "mute_autoplay_and_add_captions",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "C9",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "MEDIA_ACCESSIBILITY_COMPLIANT",
      summary: "No disruptive unmuted autoplay or uncaptioned video elements were detected.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

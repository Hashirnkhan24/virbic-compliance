import type { CheckDefinition } from "../../framework/types";

export const g9EmbeddedMediaCheck: CheckDefinition = {
  id: "G9",
  version: "1.0.0",
  title: "Third-party embedded media",
  description: "Inventories embedded third-party video and audio players (YouTube, Vimeo, Spotify) and checks for privacy-enhanced mode and TLS enforcement.",
  module: "ip",
  wave: "W1",
  requiredEvidence: ["network_request"],
  run: (snapshot, context) => {
    const embedRequests = snapshot.networkRequests.filter(
      (r) =>
        r.isThirdParty &&
        (r.url.includes("youtube.com/embed") ||
          r.url.includes("youtube-nocookie.com") ||
          r.url.includes("player.vimeo.com") ||
          r.url.includes("embed.spotify.com") ||
          r.url.includes("w.soundcloud.com"))
    );

    if (embedRequests.length === 0) {
      return {
        checkId: "G9",
        checkVersion: "1.0.0",
        status: "passed",
        severity: null,
        confidence: 1.0,
        reasonCode: "NO_THIRD_PARTY_MEDIA_EMBEDS",
        summary: "No third-party media players or external iframes were detected on the website.",
        evidenceIds: [],
        requiresHumanReview: false,
      };
    }

    // Check for standard YouTube tracking embeds instead of youtube-nocookie
    const standardYouTubeEmbeds = embedRequests.filter(
      (r) => r.url.includes("youtube.com/embed") && !r.url.includes("youtube-nocookie.com")
    );

    const insecureHttpEmbeds = embedRequests.filter((r) => r.url.startsWith("http://"));

    if (standardYouTubeEmbeds.length > 0 || insecureHttpEmbeds.length > 0) {
      const evidenceId = context.evidenceCollector.registerEvidence(
        "network_request",
        {
          totalEmbeds: embedRequests.length,
          standardYouTubeEmbeds: standardYouTubeEmbeds.map((r) => r.url),
          insecureHttpEmbeds: insecureHttpEmbeds.map((r) => r.url),
          recommendation: "Switch YouTube embeds to youtube-nocookie.com domain to eliminate pre-click tracking cookies.",
        },
        {
          sourceLocator: "iframe[src*='youtube.com'], iframe[src*='http://']",
          pageUrl: snapshot.canonicalOrigin,
        }
      );

      return {
        checkId: "G9",
        checkVersion: "1.0.0",
        status: "issue_found",
        severity: "low",
        confidence: 0.95,
        reasonCode: "MEDIA_EMBED_TRACKING_NOT_MINIMIZED",
        summary: `Detected ${embedRequests.length} third-party media embed(s), with tracking cookies not minimized (use youtube-nocookie.com).`,
        evidenceIds: [evidenceId],
        remediationTemplateId: "enable_privacy_enhanced_media_embeds",
        requiresHumanReview: false,
      };
    }

    return {
      checkId: "G9",
      checkVersion: "1.0.0",
      status: "passed",
      severity: null,
      confidence: 1.0,
      reasonCode: "MEDIA_EMBEDS_PRIVACY_ENHANCED",
      summary: "All third-party media embeds utilize HTTPS and privacy-enhanced embed endpoints.",
      evidenceIds: [],
      requiresHumanReview: false,
    };
  },
};

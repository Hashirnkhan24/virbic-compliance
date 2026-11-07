/**
 * Catalog of known tracking, analytics, and advertising network domains.
 * Derived from open privacy blocklists (EasyPrivacy, Disconnect, blueprint specifications).
 */
export interface TrackerRule {
  name: string;
  category: "analytics" | "advertising" | "session_replay" | "social";
  patterns: string[];
}

export const KNOWN_TRACKERS: TrackerRule[] = [
  {
    name: "Google Analytics / Tag Manager",
    category: "analytics",
    patterns: [
      "google-analytics.com",
      "googletagmanager.com",
      "analytics.google.com",
      "stats.g.doubleclick.net",
    ],
  },
  {
    name: "Google Ads / DoubleClick",
    category: "advertising",
    patterns: [
      "doubleclick.net",
      "googleadservices.com",
      "adservice.google.com",
      "pagead2.googlesyndication.com",
    ],
  },
  {
    name: "Meta / Facebook Pixel",
    category: "advertising",
    patterns: [
      "connect.facebook.net",
      "facebook.net/en_US/fbevents.js",
      "facebook.com/tr",
    ],
  },
  {
    name: "Microsoft Clarity",
    category: "session_replay",
    patterns: ["clarity.ms"],
  },
  {
    name: "Hotjar",
    category: "session_replay",
    patterns: ["hotjar.com", "hotjar.io", "static.hotjar.com"],
  },
  {
    name: "TikTok Pixel",
    category: "advertising",
    patterns: ["analytics.tiktok.com"],
  },
  {
    name: "LinkedIn Insight Tag",
    category: "advertising",
    patterns: ["snap.licdn.com", "linkedin.com/px"],
  },
  {
    name: "Twitter / X Ads",
    category: "advertising",
    patterns: ["static.ads-twitter.com", "ads-twitter.com"],
  },
  {
    name: "Criteo",
    category: "advertising",
    patterns: ["criteo.net", "criteo.com"],
  },
  {
    name: "The Trade Desk",
    category: "advertising",
    patterns: ["adsrvr.org"],
  },
  {
    name: "Mixpanel",
    category: "analytics",
    patterns: ["mixpanel.com", "api-js.mixpanel.com"],
  },
  {
    name: "Amplitude",
    category: "analytics",
    patterns: ["amplitude.com", "analytics.amplitude.com"],
  },
  {
    name: "Segment",
    category: "analytics",
    patterns: ["segment.io", "segment.com", "cdn.segment.com"],
  },
  {
    name: "Heap Analytics",
    category: "analytics",
    patterns: ["heap.io", "heapanalytics.com"],
  },
  {
    name: "FullStory",
    category: "session_replay",
    patterns: ["fullstory.com", "rs.fullstory.com"],
  },
  {
    name: "AdRoll",
    category: "advertising",
    patterns: ["adroll.com", "d.adroll.com"],
  },
  {
    name: "Pinterest Tag",
    category: "advertising",
    patterns: ["ct.pinterest.com"],
  },
  {
    name: "Taboola",
    category: "advertising",
    patterns: ["taboola.com", "trc.taboola.com"],
  },
  {
    name: "Outbrain",
    category: "advertising",
    patterns: ["outbrain.com"],
  },
];

/**
 * Checks if a given request URL matches a known tracking or advertising domain.
 */
export function isTrackerUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const full = (host + parsed.pathname).toLowerCase();

    for (const tracker of KNOWN_TRACKERS) {
      for (const pattern of tracker.patterns) {
        if (pattern.includes("/")) {
          if (full.includes(pattern)) return true;
        } else {
          if (host === pattern || host.endsWith(`.${pattern}`)) return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Identifies the tracker name for a given URL, or null if unknown.
 */
export function identifyTrackerName(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const full = (host + parsed.pathname).toLowerCase();

    for (const tracker of KNOWN_TRACKERS) {
      for (const pattern of tracker.patterns) {
        if (pattern.includes("/")) {
          if (full.includes(pattern)) return tracker.name;
        } else {
          if (host === pattern || host.endsWith(`.${pattern}`)) return tracker.name;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

import type { Page } from "playwright-core";
import type { ConsentButton } from "@vibe/contracts";
import type { ConsentBannerObservation } from "./consent-types";

interface KnownCmpConfig {
  name: string;
  containerSelectors: string[];
  acceptSelectors: string[];
  rejectSelectors: string[];
  preferencesSelectors: string[];
}

export const KNOWN_CMPS: KnownCmpConfig[] = [
  {
    name: "OneTrust",
    containerSelectors: [
      "#onetrust-banner-sdk",
      "#onetrust-consent-sdk",
      ".ot-sdk-container",
    ],
    acceptSelectors: [
      "#onetrust-accept-btn-handler",
      ".ot-accept-all",
      "button[id*='accept' i]",
    ],
    rejectSelectors: [
      "#onetrust-reject-all-handler",
      ".ot-reject-all",
      "button[id*='reject' i]",
    ],
    preferencesSelectors: [
      "#onetrust-pc-btn-handler",
      ".cookie-setting-link",
      "button[id*='pref' i]",
    ],
  },
  {
    name: "Cookiebot",
    containerSelectors: ["#CybotCookiebotDialog", "#CookiebotWidget"],
    acceptSelectors: [
      "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
      "#CybotCookiebotDialogBodyButtonAccept",
    ],
    rejectSelectors: [
      "#CybotCookiebotDialogBodyButtonDecline",
      "#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll",
    ],
    preferencesSelectors: [
      "#CybotCookiebotDialogBodyLevelButtonCustomize",
    ],
  },
  {
    name: "Complianz",
    containerSelectors: ["#cmplz-cookiebanner", ".cmplz-cookiebanner"],
    acceptSelectors: [".cmplz-btn.cmplz-accept", ".cmplz-accept"],
    rejectSelectors: [".cmplz-btn.cmplz-deny", ".cmplz-deny"],
    preferencesSelectors: [".cmplz-btn.cmplz-view-preferences"],
  },
  {
    name: "Termly",
    containerSelectors: ["#termly-code-snippet-support", "[data-id='termly-banner']"],
    acceptSelectors: ["[data-tid='banner-accept']"],
    rejectSelectors: ["[data-tid='banner-decline']"],
    preferencesSelectors: ["[data-tid='banner-preferences']"],
  },
  {
    name: "Klaro",
    containerSelectors: [".klaro"],
    acceptSelectors: [".cm-btn-success", ".cn-ok"],
    rejectSelectors: [".cm-btn-danger", ".cn-decline"],
    preferencesSelectors: [".cm-btn-info", ".cn-learn-more"],
  },
  {
    name: "Didomi",
    containerSelectors: ["#didomi-host", "#didomi-notice"],
    acceptSelectors: ["#didomi-notice-agree-button"],
    rejectSelectors: ["#didomi-notice-disagree-button"],
    preferencesSelectors: ["#didomi-notice-learn-more-button"],
  },
  {
    name: "Axeptio",
    containerSelectors: ["#axeptio_overlay", "#axeptio_main"],
    acceptSelectors: ["[id*='axeptio'] [class*='accept']", "button[id*='agree']"],
    rejectSelectors: ["[id*='axeptio'] [class*='close']", "button[id*='refuse']"],
    preferencesSelectors: ["[id*='axeptio'] [class*='edit']"],
  },
  {
    name: "Quantcast Choice",
    containerSelectors: [".qc-cmp2-container", "#qc-cmp2-container"],
    acceptSelectors: ["button[mode='primary']", ".qc-cmp2-buttons-desktop button:first-child"],
    rejectSelectors: ["button[mode='secondary']"],
    preferencesSelectors: ["button[mode='link']"],
  },
  {
    name: "Usercentrics",
    containerSelectors: ["#usercentrics-root", "[data-usercentrics]"],
    acceptSelectors: ["[data-testid='uc-accept-all-button']"],
    rejectSelectors: ["[data-testid='uc-deny-all-button']"],
    preferencesSelectors: ["[data-testid='uc-customize-button']"],
  },
];

const GENERIC_BANNER_SELECTORS = [
  "[id*='cookie' i]",
  "[class*='cookie' i]",
  "[id*='consent' i]",
  "[class*='consent' i]",
  "[id*='notice' i]",
  "[class*='notice' i]",
  "[role='dialog']",
  "[aria-modal='true']",
];

const CONSENT_KEYWORDS = [
  "cookie",
  "consent",
  "privacy",
  "tracking",
  "gdpr",
  "preferences",
  "experience on our site",
  "we use cookies",
];

/**
 * Classifies button text into a standardized consent action type.
 */
export function classifyButtonText(rawText: string): ConsentButton["type"] {
  const text = rawText.trim().toLowerCase();

  // Reject variations
  if (
    text.includes("reject all") ||
    text.includes("decline all") ||
    text.includes("deny all") ||
    text.includes("refuse all") ||
    text.includes("disallow all") ||
    text.includes("reject non-essential") ||
    text.includes("reject non essential") ||
    text.includes("non-essential") ||
    text.includes("only essential") ||
    text.includes("essential only") ||
    text.includes("necessary only") ||
    text.includes("only necessary") ||
    text.includes("continue without accepting") ||
    text === "reject" ||
    text === "decline" ||
    text === "deny" ||
    text === "refuse" ||
    text === "disallow" ||
    text === "no thanks" ||
    text === "don't accept" ||
    text === "save choices" ||
    text === "save preferences"
  ) {
    return "reject";
  }

  // Accept variations
  if (
    text.includes("accept all") ||
    text.includes("allow all") ||
    text.includes("agree all") ||
    text.includes("enable all") ||
    text.includes("i accept") ||
    text.includes("i agree") ||
    text.includes("accept cookies") ||
    text.includes("allow cookies") ||
    text === "accept" ||
    text === "allow" ||
    text === "agree" ||
    text === "ok" ||
    text === "got it" ||
    text === "understood" ||
    text === "yes" ||
    text === "confirm"
  ) {
    return "accept";
  }

  // Preferences variations
  if (
    text.includes("cookie settings") ||
    text.includes("settings") ||
    text.includes("customize") ||
    text.includes("preferences") ||
    text.includes("manage choices") ||
    text.includes("manage options") ||
    text.includes("more options") ||
    text.includes("learn more")
  ) {
    return "preferences";
  }

  // Close variations
  if (text === "x" || text === "close" || text === "dismiss") {
    return "close";
  }

  return "unknown";
}

/**
 * Evaluates the DOM to locate any CMP or consent banner, extracting
 * its container selector, banner text, and interactive buttons.
 */
export async function detectConsentBanner(
  page: Page
): Promise<ConsentBannerObservation> {
  return await page.evaluate(
    ({ knownCmps, genericSelectors, keywords }) => {
      // 1. Check Known CMPs first
      for (const cmp of knownCmps) {
        for (const selector of cmp.containerSelectors) {
          const el = document.querySelector(selector) as HTMLElement | null;
          if (el && el.offsetHeight > 0 && el.offsetWidth > 0) {
            const bannerText = (el.innerText || "").trim().slice(0, 2000);

            // Collect buttons inside CMP container
            const buttonEls = Array.from(
              el.querySelectorAll("button, a[role='button'], input[type='button'], input[type='submit']")
            ) as HTMLElement[];

            const availableButtons: Array<{
              text: string;
              type: "accept" | "reject" | "preferences" | "close" | "unknown";
              selector?: string;
            }> = [];

            for (let i = 0; i < buttonEls.length; i++) {
              const btn = buttonEls[i];
              if (!btn) continue;
              const text = (btn.innerText || btn.getAttribute("aria-label") || btn.getAttribute("value") || "").trim();
              if (!text) continue;

              // Check if button matches known CMP selectors
              let type: "accept" | "reject" | "preferences" | "close" | "unknown" = "unknown";
              if (cmp.acceptSelectors.some((s) => btn.matches(s))) {
                type = "accept";
              } else if (cmp.rejectSelectors.some((s) => btn.matches(s))) {
                type = "reject";
              } else if (cmp.preferencesSelectors.some((s) => btn.matches(s))) {
                type = "preferences";
              } else {
                // Heuristic fallback
                const lower = text.toLowerCase();
                if (lower.includes("reject") || lower.includes("decline") || lower.includes("necessary")) {
                  type = "reject";
                } else if (lower.includes("accept") || lower.includes("allow") || lower.includes("agree")) {
                  type = "accept";
                } else if (lower.includes("setting") || lower.includes("pref") || lower.includes("custom")) {
                  type = "preferences";
                } else if (lower === "x" || lower === "close") {
                  type = "close";
                }
              }

              // Build a unique CSS selector for this button if possible
              let btnSelector = selector + " button";
              if (btn.id) {
                btnSelector = `#${btn.id}`;
              } else if (btn.className && typeof btn.className === "string") {
                const firstClass = btn.className.split(" ")[0];
                if (firstClass) btnSelector = `${selector} .${firstClass}`;
              }

              availableButtons.push({
                text,
                type,
                selector: btnSelector,
              });
            }

            return {
              detected: true,
              cmpName: cmp.name,
              bannerText,
              availableButtons,
              containerSelector: selector,
            };
          }
        }
      }

      // 2. Check Generic Banner selectors
      for (const selector of genericSelectors) {
        const candidates = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
        for (const el of candidates) {
          // Verify visibility
          if (!el || el.offsetHeight < 20 || el.offsetWidth < 50) continue;
          const text = (el.innerText || "").trim();
          if (!text || text.length > 5000) continue;

          const lowerText = text.toLowerCase();
          const hasKeyword = keywords.some((kw: string) => lowerText.includes(kw));

          if (hasKeyword) {
            const buttonEls = Array.from(
              el.querySelectorAll("button, a[role='button'], input[type='button'], a[class*='btn' i]")
            ) as HTMLElement[];

            if (buttonEls.length === 0) continue;

            const availableButtons: Array<{
              text: string;
              type: "accept" | "reject" | "preferences" | "close" | "unknown";
              selector?: string;
            }> = [];

            for (const btn of buttonEls) {
              const btnText = (btn.innerText || btn.getAttribute("aria-label") || btn.getAttribute("value") || "").trim();
              if (!btnText) continue;

              const lower = btnText.toLowerCase();
              let type: "accept" | "reject" | "preferences" | "close" | "unknown" = "unknown";
              if (
                lower.includes("reject") ||
                lower.includes("decline") ||
                lower.includes("disallow") ||
                lower.includes("deny") ||
                lower.includes("essential only") ||
                lower.includes("only necessary")
              ) {
                type = "reject";
              } else if (
                lower.includes("accept") ||
                lower.includes("allow") ||
                lower.includes("agree") ||
                lower === "ok" ||
                lower === "got it"
              ) {
                type = "accept";
              } else if (
                lower.includes("setting") ||
                lower.includes("manage") ||
                lower.includes("custom") ||
                lower.includes("preference")
              ) {
                type = "preferences";
              } else if (lower === "x" || lower === "close") {
                type = "close";
              }

              let btnSelector: string | undefined;
              if (btn.id) {
                btnSelector = `#${btn.id}`;
              } else if (btn.className && typeof btn.className === "string") {
                const c = btn.className.split(" ")[0];
                if (c) btnSelector = `${selector} .${c}`;
              }

              availableButtons.push({
                text: btnText,
                type,
                selector: btnSelector,
              });
            }

            let containerSelector = selector;
            if (el.id) containerSelector = `#${el.id}`;

            return {
              detected: true,
              cmpName: "Generic Banner",
              bannerText: text.slice(0, 2000),
              availableButtons,
              containerSelector,
            };
          }
        }
      }

      // No banner detected
      return {
        detected: false,
        availableButtons: [],
      };
    },
    {
      knownCmps: KNOWN_CMPS,
      genericSelectors: GENERIC_BANNER_SELECTORS,
      keywords: CONSENT_KEYWORDS,
    }
  );
}

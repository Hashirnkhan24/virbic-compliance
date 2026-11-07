/**
 * Application Constants & Configuration
 *
 * Central source of truth for product pricing, metadata, and default entitlements.
 * Invariant: Never hardcode commercial prices across individual components.
 */

export const APP_CONFIG = {
  name: "Vibe Compliance",
  tagline: "Pre-launch website risk audit & AI fixing kit",
  description:
    "Audit your website for privacy, consent, accessibility, security, and legal policy risks before launch. Generate ready-to-use prompts for Cursor, Claude Code, Antigravity, or your developer.",
  launchPriceInr: 499,
  launchPriceLabel: "₹499",
  rescanWindowDays: 14,
  checksCount: 40,
} as const;

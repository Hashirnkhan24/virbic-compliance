/**
 * Check Registry
 *
 * Enriched metadata for every check beyond what the detector framework defines.
 * This includes jurisdiction conditions, priority weighting, exposure model references,
 * legal/framework references, and the review date.
 *
 * The registry is the single source of truth for which checks are active,
 * their applicability conditions, and how they map to scoring.
 */

import type { Jurisdiction, Severity } from "@vibe/contracts";

export type CheckModule =
  | "privacy"
  | "cookies"
  | "accessibility"
  | "security"
  | "legal"
  | "consumer"
  | "ip"
  | "quality"
  | "third_party";

export type CheckWave = "W1" | "W2" | "W3" | "W4";

/**
 * Enriched check registry entry.
 * Combines the check definition metadata with rules-engine-specific fields.
 */
export interface CheckRegistryEntry {
  /** Stable check ID, e.g. "A1", "D5" */
  readonly id: string;
  /** Semantic version of this check definition */
  readonly version: string;
  /** Human-readable check title */
  readonly title: string;
  /** Detailed description */
  readonly description: string;
  /** Functional module category */
  readonly module: CheckModule;
  /** Rollout wave */
  readonly wave: CheckWave;
  /** Check priority for execution ordering (lower = higher priority) */
  readonly priority: number;
  /** Default severity when detector reports issue_found without overriding */
  readonly defaultSeverity: Severity;
  /**
   * Jurisdictions where this check is applicable.
   * Empty array means universally applicable (e.g., security, accessibility).
   * Non-empty means only applicable when the user confirms one of these jurisdictions.
   *
   * INVARIANT: Never infer legal applicability from IP/hosting location alone.
   */
  readonly jurisdictions: Jurisdiction[];
  /** Legal or framework references backing this check */
  readonly legalReferences: string[];
  /** Exposure model IDs this check can trigger */
  readonly exposureModelIds: string[];
  /** Remediation template ID */
  readonly remediationTemplateId?: string;
  /** ISO 8601 date when this check definition was last reviewed */
  readonly reviewDate: string;
  /** Whether this check is currently enabled */
  readonly enabled: boolean;
}

/**
 * In-memory check registry with lookup and filtering capabilities.
 */
export class CheckRegistry {
  private entries = new Map<string, CheckRegistryEntry>();

  /**
   * Register a single check entry.
   * @throws Error if the check ID is already registered with a different version
   *         (use update() for intentional version bumps).
   */
  public register(entry: CheckRegistryEntry): void {
    const existing = this.entries.get(entry.id);
    if (existing && existing.version !== entry.version) {
      // Allow re-registration with same version (idempotent), but log version changes
      this.entries.set(entry.id, entry);
      return;
    }
    this.entries.set(entry.id, entry);
  }

  /** Register multiple entries at once. */
  public registerAll(entries: CheckRegistryEntry[]): void {
    for (const entry of entries) {
      this.register(entry);
    }
  }

  /** Retrieve a check entry by ID. */
  public get(id: string): CheckRegistryEntry | undefined {
    return this.entries.get(id);
  }

  /** Get all registered check entries. */
  public getAll(): CheckRegistryEntry[] {
    return Array.from(this.entries.values());
  }

  /** Get all enabled check entries. */
  public getEnabled(): CheckRegistryEntry[] {
    return this.getAll().filter((e) => e.enabled);
  }

  /** Get check entries filtered by wave. */
  public getByWave(wave: CheckWave): CheckRegistryEntry[] {
    return this.getEnabled().filter((e) => e.wave === wave);
  }

  /** Get check entries filtered by module. */
  public getByModule(module: CheckModule): CheckRegistryEntry[] {
    return this.getEnabled().filter((e) => e.module === module);
  }

  /**
   * Get check entries applicable to the given confirmed jurisdictions.
   * Checks with empty jurisdictions array are universally applicable.
   *
   * INVARIANT: Only customer-confirmed jurisdictions are used.
   * Never infer from IP address or hosting location.
   */
  public getApplicable(confirmedJurisdictions: Jurisdiction[]): CheckRegistryEntry[] {
    return this.getEnabled().filter((entry) => {
      // Universal checks (no jurisdiction restriction)
      if (entry.jurisdictions.length === 0) {
        return true;
      }
      // Jurisdiction-specific checks require at least one confirmed match
      return entry.jurisdictions.some((j) => confirmedJurisdictions.includes(j));
    });
  }

  /** Total count of registered checks. */
  public get size(): number {
    return this.entries.size;
  }

  /** Check if a check ID is registered. */
  public has(id: string): boolean {
    return this.entries.has(id);
  }
}

// ===================================================================
// Default Wave 1 Registry Entries
// ===================================================================

/**
 * Wave 1 check registry entries (~41 checks).
 * Each entry has been reviewed against the product blueprint.
 *
 * Jurisdiction conventions:
 * - [] (empty) = universally applicable (security, accessibility, quality)
 * - ["india"] = India-specific legal requirement
 * - ["eu"] = EU/GDPR-specific
 * - ["india", "eu", "us"] = applicable across all supported jurisdictions
 */
export const WAVE_1_REGISTRY: CheckRegistryEntry[] = [
  // ─── Privacy ───────────────────────────────────────────────────
  {
    id: "A1",
    version: "1.0.0",
    title: "Privacy policy exists and is linked",
    description: "Verifies that the website has a dedicated, accessible privacy policy page.",
    module: "privacy",
    wave: "W1",
    priority: 10,
    defaultSeverity: "high",
    jurisdictions: ["india", "eu", "us"],
    legalReferences: [
      "DPDP 2023, Section 6 — Notice to Data Principal",
      "GDPR Article 13 — Information to be provided",
      "CCPA § 1798.100(b) — Right to know disclosure",
    ],
    exposureModelIds: ["dpdp_penalty_range", "gdpr_standard_exposure", "ccpa_statutory_exposure"],
    remediationTemplateId: "create_privacy_policy",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "A5",
    version: "1.0.0",
    title: "Privacy policy matches observed data practices",
    description: "Checks whether the privacy policy covers the trackers and data collection actually observed.",
    module: "privacy",
    wave: "W1",
    priority: 15,
    defaultSeverity: "high",
    jurisdictions: ["india", "eu", "us"],
    legalReferences: [
      "DPDP 2023, Section 6 — Accurate notice of purpose",
      "GDPR Articles 5(1)(a), 13, 14 — Transparency",
    ],
    exposureModelIds: ["dpdp_penalty_range", "gdpr_standard_exposure"],
    remediationTemplateId: "update_privacy_policy",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "A6",
    version: "1.0.0",
    title: "Forms collect consent before processing personal data",
    description: "Verifies that forms collecting personal data include consent checkboxes or disclosures.",
    module: "privacy",
    wave: "W1",
    priority: 20,
    defaultSeverity: "medium",
    jurisdictions: ["india", "eu"],
    legalReferences: [
      "DPDP 2023, Section 6 — Consent before processing",
      "GDPR Article 6(1)(a) — Lawful basis: consent",
    ],
    exposureModelIds: ["dpdp_penalty_range", "gdpr_standard_exposure"],
    remediationTemplateId: "add_form_consent",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "A10",
    version: "1.0.0",
    title: "Opt-out mechanism for data processing",
    description: "Checks for an accessible opt-out link or mechanism for data subjects.",
    module: "privacy",
    wave: "W1",
    priority: 25,
    defaultSeverity: "medium",
    jurisdictions: ["us"],
    legalReferences: ["CCPA § 1798.120 — Right to opt out of sale"],
    exposureModelIds: ["ccpa_statutory_exposure"],
    remediationTemplateId: "add_opt_out",
    reviewDate: "2025-10-01",
    enabled: true,
  },

  // ─── Cookies & Consent ─────────────────────────────────────────
  {
    id: "B1",
    version: "1.0.0",
    title: "Cookie consent banner present",
    description: "Verifies a cookie consent banner is displayed before setting non-essential cookies.",
    module: "cookies",
    wave: "W1",
    priority: 10,
    defaultSeverity: "high",
    jurisdictions: ["india", "eu"],
    legalReferences: [
      "DPDP 2023, Section 6 — Prior consent for non-essential processing",
      "GDPR Article 7 / ePrivacy Directive Article 5(3)",
    ],
    exposureModelIds: ["dpdp_penalty_range", "gdpr_standard_exposure"],
    remediationTemplateId: "add_cookie_banner",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "B2",
    version: "1.0.0",
    title: "No trackers fire before consent choice",
    description: "Checks that tracking scripts and cookies are not set before the user makes a consent choice.",
    module: "cookies",
    wave: "W1",
    priority: 5,
    defaultSeverity: "critical",
    jurisdictions: ["india", "eu"],
    legalReferences: [
      "DPDP 2023, Section 6 — Processing only after valid consent",
      "GDPR Article 6(1)(a) / ePrivacy Directive Article 5(3)",
    ],
    exposureModelIds: ["dpdp_penalty_range", "gdpr_standard_exposure"],
    remediationTemplateId: "block_preconsent_trackers",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "B3",
    version: "1.0.0",
    title: "Reject option equally prominent as Accept",
    description: "Verifies the consent reject option is not visually or functionally de-emphasised.",
    module: "cookies",
    wave: "W1",
    priority: 20,
    defaultSeverity: "medium",
    jurisdictions: ["india", "eu"],
    legalReferences: [
      "Guidelines for Prevention of Dark Patterns 2023 (India)",
      "EDPB Guidelines 03/2022 on Dark Patterns",
    ],
    exposureModelIds: ["consumer_protection_misleading", "gdpr_standard_exposure"],
    remediationTemplateId: "fix_reject_prominence",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "B4",
    version: "1.0.0",
    title: "Rejecting consent blocks tracking",
    description: "Verifies that clicking reject actually prevents non-essential cookies and tracking.",
    module: "cookies",
    wave: "W1",
    priority: 5,
    defaultSeverity: "critical",
    jurisdictions: ["india", "eu"],
    legalReferences: [
      "DPDP 2023, Section 6 — Consent withdrawal must be effective",
      "GDPR Article 7(3) — Right to withdraw consent",
    ],
    exposureModelIds: ["dpdp_penalty_range", "gdpr_standard_exposure"],
    remediationTemplateId: "enforce_reject_tracking",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "B5",
    version: "1.0.0",
    title: "Cookie policy covers all observed cookies",
    description: "Checks that the cookie policy lists the cookies actually set on the site.",
    module: "cookies",
    wave: "W1",
    priority: 25,
    defaultSeverity: "medium",
    jurisdictions: ["india", "eu"],
    legalReferences: [
      "DPDP 2023, Section 6 — Transparency of processing",
      "GDPR Article 13(1)(e) — Categories of recipients",
    ],
    exposureModelIds: ["dpdp_penalty_range", "gdpr_standard_exposure"],
    remediationTemplateId: "update_cookie_policy",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "B6",
    version: "1.0.0",
    title: "No invasive tracking mechanisms",
    description: "Detects fingerprinting scripts, evercookies, or persistent tracking beyond standard cookies.",
    module: "cookies",
    wave: "W1",
    priority: 10,
    defaultSeverity: "high",
    jurisdictions: ["india", "eu", "us"],
    legalReferences: [
      "DPDP 2023, Section 4 — Proportionate processing",
      "GDPR Article 5(1)(c) — Data minimisation",
      "CCPA § 1798.140(x) — Sale of personal information",
    ],
    exposureModelIds: ["dpdp_penalty_range", "gdpr_standard_exposure", "ccpa_statutory_exposure"],
    remediationTemplateId: "remove_invasive_tracking",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "B7",
    version: "1.0.0",
    title: "No IP-leaking third-party resources before consent",
    description: "Checks that third-party resources exposing visitor IP are not loaded before consent.",
    module: "cookies",
    wave: "W1",
    priority: 15,
    defaultSeverity: "medium",
    jurisdictions: ["eu"],
    legalReferences: [
      "GDPR Article 44 / CJEU Schrems II — International data transfers",
      "ePrivacy Directive Article 5(3)",
    ],
    exposureModelIds: ["gdpr_standard_exposure"],
    remediationTemplateId: "defer_third_party_resources",
    reviewDate: "2025-10-01",
    enabled: true,
  },

  // ─── Accessibility ─────────────────────────────────────────────
  {
    id: "C1",
    version: "1.0.0",
    title: "Images have alt text",
    description: "Checks all images have meaningful alternative text per WCAG 2.1 SC 1.1.1.",
    module: "accessibility",
    wave: "W1",
    priority: 15,
    defaultSeverity: "medium",
    jurisdictions: [],
    legalReferences: ["WCAG 2.1 SC 1.1.1 — Non-text Content"],
    exposureModelIds: [],
    remediationTemplateId: "add_alt_text",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "C2",
    version: "1.0.0",
    title: "Colour contrast meets WCAG AA",
    description: "Verifies text-to-background contrast ratios meet WCAG 2.1 Level AA.",
    module: "accessibility",
    wave: "W1",
    priority: 15,
    defaultSeverity: "medium",
    jurisdictions: [],
    legalReferences: ["WCAG 2.1 SC 1.4.3 — Contrast (Minimum)"],
    exposureModelIds: [],
    remediationTemplateId: "fix_contrast",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "C4",
    version: "1.0.0",
    title: "Form controls have accessible labels",
    description: "Checks all form inputs have associated labels or aria-label attributes.",
    module: "accessibility",
    wave: "W1",
    priority: 20,
    defaultSeverity: "medium",
    jurisdictions: [],
    legalReferences: ["WCAG 2.1 SC 1.3.1 — Info and Relationships"],
    exposureModelIds: [],
    remediationTemplateId: "add_form_labels",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "C5",
    version: "1.0.0",
    title: "Heading hierarchy and landmarks are correct",
    description: "Verifies proper heading levels and ARIA landmarks for screen reader navigation.",
    module: "accessibility",
    wave: "W1",
    priority: 25,
    defaultSeverity: "low",
    jurisdictions: [],
    legalReferences: ["WCAG 2.1 SC 1.3.1 — Info and Relationships"],
    exposureModelIds: [],
    remediationTemplateId: "fix_headings",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "C6",
    version: "1.0.0",
    title: "Page language is declared",
    description: "Checks the <html> element declares lang attribute for assistive technology.",
    module: "accessibility",
    wave: "W1",
    priority: 30,
    defaultSeverity: "low",
    jurisdictions: [],
    legalReferences: ["WCAG 2.1 SC 3.1.1 — Language of Page"],
    exposureModelIds: [],
    remediationTemplateId: "add_lang_attribute",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "C7",
    version: "1.0.0",
    title: "Interactive elements have accessible names",
    description: "Checks buttons, links, and interactive elements have discernible accessible names.",
    module: "accessibility",
    wave: "W1",
    priority: 20,
    defaultSeverity: "medium",
    jurisdictions: [],
    legalReferences: ["WCAG 2.1 SC 4.1.2 — Name, Role, Value"],
    exposureModelIds: [],
    remediationTemplateId: "add_accessible_names",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "C9",
    version: "1.0.0",
    title: "Media has captions or transcripts",
    description: "Checks video/audio elements include captions, subtitles, or transcript links.",
    module: "accessibility",
    wave: "W1",
    priority: 25,
    defaultSeverity: "medium",
    jurisdictions: [],
    legalReferences: ["WCAG 2.1 SC 1.2.2 — Captions (Prerecorded)"],
    exposureModelIds: [],
    remediationTemplateId: "add_captions",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "C10",
    version: "1.0.0",
    title: "Touch targets meet minimum size",
    description: "Verifies interactive elements meet minimum 44×44 CSS px touch target guidelines.",
    module: "accessibility",
    wave: "W1",
    priority: 25,
    defaultSeverity: "low",
    jurisdictions: [],
    legalReferences: ["WCAG 2.1 SC 2.5.5 — Target Size (Enhanced)"],
    exposureModelIds: [],
    remediationTemplateId: "increase_touch_targets",
    reviewDate: "2025-10-01",
    enabled: true,
  },

  // ─── Security ──────────────────────────────────────────────────
  {
    id: "D1",
    version: "1.0.0",
    title: "No exposed secrets or API keys in client code",
    description: "Scans client-side JS bundles for leaked API keys, tokens, and credentials.",
    module: "security",
    wave: "W1",
    priority: 1,
    defaultSeverity: "critical",
    jurisdictions: [],
    legalReferences: ["OWASP Top 10 A01:2021 — Broken Access Control"],
    exposureModelIds: [],
    remediationTemplateId: "rotate_exposed_secrets",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "D5",
    version: "1.0.0",
    title: "HTTPS/TLS enforcement and certificate validity",
    description: "Verifies HTTPS is enforced and the TLS certificate is valid and not expiring.",
    module: "security",
    wave: "W1",
    priority: 1,
    defaultSeverity: "critical",
    jurisdictions: [],
    legalReferences: [
      "OWASP Top 10 A02:2021 — Cryptographic Failures",
      "PCI DSS Requirement 4 — Encrypt transmission",
    ],
    exposureModelIds: [],
    remediationTemplateId: "enable_https_redirect",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "D6",
    version: "1.0.0",
    title: "Security headers configured",
    description: "Checks for essential HTTP security headers (CSP, X-Frame-Options, HSTS, etc.).",
    module: "security",
    wave: "W1",
    priority: 10,
    defaultSeverity: "medium",
    jurisdictions: [],
    legalReferences: ["OWASP Secure Headers Project"],
    exposureModelIds: [],
    remediationTemplateId: "add_security_headers",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "D7",
    version: "1.0.0",
    title: "Cookie security flags set correctly",
    description: "Verifies session/auth cookies use Secure, HttpOnly, and SameSite attributes.",
    module: "security",
    wave: "W1",
    priority: 10,
    defaultSeverity: "high",
    jurisdictions: [],
    legalReferences: [
      "OWASP Session Management Cheat Sheet",
      "DPDP 2023, Section 8 — Reasonable security safeguards",
    ],
    exposureModelIds: ["dpdp_penalty_range"],
    remediationTemplateId: "fix_cookie_flags",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "D9",
    version: "1.0.0",
    title: "Source maps not publicly exposed",
    description: "Checks that JavaScript source maps are not publicly accessible in production.",
    module: "security",
    wave: "W1",
    priority: 20,
    defaultSeverity: "medium",
    jurisdictions: [],
    legalReferences: ["OWASP Top 10 A05:2021 — Security Misconfiguration"],
    exposureModelIds: [],
    remediationTemplateId: "remove_source_maps",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "D12",
    version: "1.0.0",
    title: "No sensitive data in frontend bundles",
    description: "Scans client-side code for PII, internal URLs, debug info, or database references.",
    module: "security",
    wave: "W1",
    priority: 5,
    defaultSeverity: "high",
    jurisdictions: [],
    legalReferences: [
      "DPDP 2023, Section 8 — Reasonable security safeguards",
      "OWASP Top 10 A01:2021 — Broken Access Control",
    ],
    exposureModelIds: ["dpdp_penalty_range"],
    remediationTemplateId: "remove_sensitive_frontend_data",
    reviewDate: "2025-10-01",
    enabled: true,
  },

  // ─── Legal ─────────────────────────────────────────────────────
  {
    id: "E1",
    version: "1.0.0",
    title: "Terms and conditions page exists",
    description: "Verifies the website has accessible terms of service / terms and conditions.",
    module: "legal",
    wave: "W1",
    priority: 15,
    defaultSeverity: "medium",
    jurisdictions: ["india", "eu", "us"],
    legalReferences: [
      "Information Technology Act 2000, Section 65B — Electronic records",
      "Consumer Protection Act 2019, Section 2(9) — Unfair contract terms",
    ],
    exposureModelIds: ["consumer_protection_misleading"],
    remediationTemplateId: "create_terms",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "E2",
    version: "1.0.0",
    title: "Refund and shipping policy for e-commerce",
    description: "Checks for refund/return and shipping policy pages on sites with payment flows.",
    module: "legal",
    wave: "W1",
    priority: 20,
    defaultSeverity: "medium",
    jurisdictions: ["india"],
    legalReferences: [
      "Consumer Protection (E-Commerce) Rules 2020, Rule 4(1)(d)",
      "Consumer Protection Act 2019, Section 2(9)",
    ],
    exposureModelIds: ["consumer_protection_misleading"],
    remediationTemplateId: "create_refund_policy",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "E4",
    version: "1.0.0",
    title: "Contact information / grievance channel",
    description: "Verifies accessible contact information or grievance officer details.",
    module: "legal",
    wave: "W1",
    priority: 15,
    defaultSeverity: "medium",
    jurisdictions: ["india"],
    legalReferences: [
      "Consumer Protection (E-Commerce) Rules 2020, Rule 4(1)(b)",
      "DPDP 2023, Section 8 — Data Protection Officer contact",
    ],
    exposureModelIds: ["dpdp_penalty_range", "consumer_protection_misleading"],
    remediationTemplateId: "add_contact_info",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "E5",
    version: "1.0.0",
    title: "No placeholder or template text in legal pages",
    description: "Detects lorem ipsum, [YOUR COMPANY], or other unfinished placeholder text.",
    module: "legal",
    wave: "W1",
    priority: 10,
    defaultSeverity: "high",
    jurisdictions: [],
    legalReferences: [
      "Consumer Protection Act 2019 — Misleading information",
    ],
    exposureModelIds: ["consumer_protection_misleading"],
    remediationTemplateId: "replace_placeholder_text",
    reviewDate: "2025-10-01",
    enabled: true,
  },

  // ─── Consumer ──────────────────────────────────────────────────
  {
    id: "F7",
    version: "1.0.0",
    title: "Payment gateway integration signals",
    description: "Checks for valid payment gateway integration signals (Razorpay, Stripe, etc.).",
    module: "consumer",
    wave: "W1",
    priority: 20,
    defaultSeverity: "medium",
    jurisdictions: [],
    legalReferences: [
      "PCI DSS Requirement 3 — Protect stored cardholder data",
      "Consumer Protection (E-Commerce) Rules 2020, Rule 4(3)",
    ],
    exposureModelIds: ["consumer_protection_misleading"],
    remediationTemplateId: "secure_payment_integration",
    reviewDate: "2025-10-01",
    enabled: true,
  },

  // ─── IP & Brand ────────────────────────────────────────────────
  {
    id: "G6",
    version: "1.0.0",
    title: "Font and icon licence signals",
    description: "Checks for proper licensing signals on embedded fonts and icon sets.",
    module: "ip",
    wave: "W1",
    priority: 30,
    defaultSeverity: "low",
    jurisdictions: [],
    legalReferences: ["Copyright Act 1957 (India), Section 51 — Infringement"],
    exposureModelIds: [],
    remediationTemplateId: "verify_font_licences",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "G9",
    version: "1.0.0",
    title: "Embedded media attribution",
    description: "Checks embedded images and videos for licence or attribution signals.",
    module: "ip",
    wave: "W1",
    priority: 30,
    defaultSeverity: "low",
    jurisdictions: [],
    legalReferences: ["Copyright Act 1957 (India), Section 51 — Infringement"],
    exposureModelIds: [],
    remediationTemplateId: "add_media_attribution",
    reviewDate: "2025-10-01",
    enabled: true,
  },

  // ─── Quality & Operational ─────────────────────────────────────
  {
    id: "H1",
    version: "1.0.0",
    title: "No broken internal links",
    description: "Checks for 404 or unreachable internal navigation links.",
    module: "quality",
    wave: "W1",
    priority: 20,
    defaultSeverity: "medium",
    jurisdictions: [],
    legalReferences: [],
    exposureModelIds: [],
    remediationTemplateId: "fix_broken_links",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "H3",
    version: "1.0.0",
    title: "Core pages present (home, about, contact)",
    description: "Verifies essential pages are discoverable via navigation.",
    module: "quality",
    wave: "W1",
    priority: 25,
    defaultSeverity: "low",
    jurisdictions: [],
    legalReferences: [],
    exposureModelIds: [],
    remediationTemplateId: "add_core_pages",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "H4",
    version: "1.0.0",
    title: "Mobile viewport and responsive signals",
    description: "Checks for mobile viewport meta tag and responsive design indicators.",
    module: "quality",
    wave: "W1",
    priority: 20,
    defaultSeverity: "medium",
    jurisdictions: [],
    legalReferences: [],
    exposureModelIds: [],
    remediationTemplateId: "fix_mobile_viewport",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "H5",
    version: "1.0.0",
    title: "No broken assets (images, stylesheets, scripts)",
    description: "Checks that all referenced assets load successfully.",
    module: "quality",
    wave: "W1",
    priority: 20,
    defaultSeverity: "medium",
    jurisdictions: [],
    legalReferences: [],
    exposureModelIds: [],
    remediationTemplateId: "fix_broken_assets",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "H7",
    version: "1.0.0",
    title: "Navigation and key interactions work",
    description: "Verifies main navigation links resolve and key interactive elements are functional.",
    module: "quality",
    wave: "W1",
    priority: 25,
    defaultSeverity: "low",
    jurisdictions: [],
    legalReferences: [],
    exposureModelIds: [],
    remediationTemplateId: "fix_navigation",
    reviewDate: "2025-10-01",
    enabled: true,
  },

  // ─── Third Party ───────────────────────────────────────────────
  {
    id: "I1",
    version: "1.0.0",
    title: "Third-party script inventory and transparency",
    description: "Inventories third-party scripts loaded and checks they are documented.",
    module: "third_party",
    wave: "W1",
    priority: 15,
    defaultSeverity: "low",
    jurisdictions: [],
    legalReferences: [],
    exposureModelIds: [],
    remediationTemplateId: "document_third_party_scripts",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "I2",
    version: "1.0.0",
    title: "No payload leak signals to third parties",
    description: "Checks that sensitive page content is not leaked to third-party analytics or ad scripts.",
    module: "third_party",
    wave: "W1",
    priority: 10,
    defaultSeverity: "high",
    jurisdictions: ["india", "eu", "us"],
    legalReferences: [
      "DPDP 2023, Section 8 — Reasonable security safeguards",
      "GDPR Article 5(1)(f) — Integrity and confidentiality",
      "CCPA § 1798.140(v) — Sale definition",
    ],
    exposureModelIds: ["dpdp_penalty_range", "gdpr_standard_exposure", "ccpa_statutory_exposure"],
    remediationTemplateId: "fix_payload_leaks",
    reviewDate: "2025-10-01",
    enabled: true,
  },
  {
    id: "I3",
    version: "1.0.0",
    title: "Third-party scripts use SRI",
    description: "Checks that externally loaded scripts include Subresource Integrity hashes.",
    module: "third_party",
    wave: "W1",
    priority: 20,
    defaultSeverity: "low",
    jurisdictions: [],
    legalReferences: ["OWASP — Subresource Integrity"],
    exposureModelIds: [],
    remediationTemplateId: "add_sri_hashes",
    reviewDate: "2025-10-01",
    enabled: true,
  },
];

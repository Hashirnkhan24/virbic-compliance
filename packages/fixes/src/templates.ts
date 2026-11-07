/**
 * Remediation Fix Templates
 *
 * Source-backed actionable fix guides for findings detected across
 * security, privacy, accessibility, cookies, legal, and site quality modules.
 *
 * Each template provides:
 * - Clear human title and summary
 * - Step-by-step developer remediation instructions
 * - Code or config snippets where applicable
 * - Time-to-fix estimate
 * - Verification guidance
 * - Client action flag (for agency handovers)
 */

export interface RemediationTemplate {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly steps: string[];
  readonly codeSnippet?: string;
  readonly codeLanguage?: string;
  readonly timeToFixEstimate: string;
  readonly verificationStep: string;
  readonly clientActionRequired: boolean;
}

export const REMEDIATION_TEMPLATES: Record<string, RemediationTemplate> = {
  create_privacy_policy: {
    id: "create_privacy_policy",
    title: "Create and Link a Compliant Privacy Policy",
    summary: "Publish a dedicated privacy policy page covering data collection, cookies, third-party processors, and user rights.",
    steps: [
      "Draft a privacy policy covering personal data collected, processing purpose, retention period, and grievance officer / DPO contact.",
      "Deploy the policy at a dedicated canonical URL (e.g., /privacy or /privacy-policy).",
      "Add a prominent, accessible link to the policy in the global site footer and header navigation.",
      "Ensure all user registration, lead capture, and checkout flows reference this policy URL."
    ],
    codeSnippet: `<!-- Add to global footer template -->
<footer>
  <nav aria-label="Legal">
    <a href="/privacy" rel="privacy-policy">Privacy Policy</a>
    <a href="/terms">Terms of Service</a>
  </nav>
</footer>`,
    codeLanguage: "html",
    timeToFixEstimate: "45 mins",
    verificationStep: "Verify that /privacy returns HTTP 200 and the link is present in the DOM footer on all pages.",
    clientActionRequired: true,
  },

  update_privacy_policy_tracker_disclosure: {
    id: "update_privacy_policy_tracker_disclosure",
    title: "Disclose Active Analytics and Marketing Trackers in Privacy Policy",
    summary: "Update the privacy policy to explicitly name all third-party analytics, telemetry, and advertising SDKs observed on the site.",
    steps: [
      "Audit all third-party scripts currently loaded on the website.",
      "Add a dedicated 'Third-Party Data Processors' section listing each provider (e.g., Google Analytics, Meta Pixel, PostHog), data collected, and their respective privacy policies.",
      "Explain the lawful basis (e.g., user consent under DPDP / GDPR) for sharing telemetry with these partners."
    ],
    timeToFixEstimate: "30 mins",
    verificationStep: "Review the privacy policy page and confirm all third-party domains contacting external servers are explicitly named.",
    clientActionRequired: true,
  },

  add_form_consent_checkbox: {
    id: "add_form_consent_checkbox",
    title: "Add Unbundled Consent Checkbox to Personal Data Forms",
    summary: "Ensure contact, signup, and lead forms require affirmative, unbundled consent before processing personal details.",
    steps: [
      "Add an unchecked checkbox below input fields requesting personal data (email, phone, address).",
      "Provide unambiguous text explaining what the user is consenting to, with a direct link to the Privacy Policy.",
      "Enforce server-side validation to reject form submissions where consent was not affirmed.",
      "Log the consent timestamp and version for compliance audit trails."
    ],
    codeSnippet: `<div class="consent-group">
  <input type="checkbox" id="consent-privacy" name="privacyConsent" required />
  <label for="consent-privacy">
    I agree to the processing of my personal details as outlined in the
    <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.
  </label>
</div>`,
    codeLanguage: "html",
    timeToFixEstimate: "20 mins",
    verificationStep: "Submit the form without checking the box; verify that submission is blocked both client-side and server-side.",
    clientActionRequired: false,
  },

  add_do_not_sell_link: {
    id: "add_do_not_sell_link",
    title: "Add 'Do Not Sell or Share My Personal Information' Link",
    summary: "Implement an accessible link allowing California / US visitors to opt out of data sharing under CCPA / CPRA.",
    steps: [
      "Add a 'Do Not Sell or Share My Personal Information' link to the site footer.",
      "Link it to an opt-out form or trigger an interactive privacy preference modal.",
      "Respect the Global Privacy Control (GPC) Sec-GPC header automatically."
    ],
    codeSnippet: `<a href="/privacy/opt-out" id="ccpa-opt-out">Do Not Sell or Share My Personal Information</a>`,
    codeLanguage: "html",
    timeToFixEstimate: "30 mins",
    verificationStep: "Click the opt-out link on desktop and mobile viewports and ensure it opens the opt-out workflow.",
    clientActionRequired: false,
  },

  install_cookie_consent_banner: {
    id: "install_cookie_consent_banner",
    title: "Install a Consent Management Platform (CMP)",
    summary: "Implement an upfront cookie consent banner that gates non-essential cookies until the user grants permission.",
    steps: [
      "Integrate an approved CMP (or lightweight custom consent banner).",
      "Ensure the banner displays before any non-essential cookies, localStorage tokens, or third-party tracking scripts execute.",
      "Categorise scripts into Essential, Analytics, and Marketing.",
      "Store user consent preferences with a timestamp and expiration."
    ],
    timeToFixEstimate: "60 mins",
    verificationStep: "Perform a clean-state browser scan; confirm no analytics/marketing cookies exist before clicking 'Accept'.",
    clientActionRequired: false,
  },

  block_preconsent_tags: {
    id: "block_preconsent_tags",
    title: "Block Tracking Scripts Before Consent Confirmation",
    summary: "Ensure tracking pixels and analytics tags do not fire prior to user consent selection.",
    steps: [
      "Review script tags in HTML and Google Tag Manager (GTM).",
      "Set script type to 'text/plain' or wrap tags in consent gate listeners.",
      "Configure GTM consent mode (analytics_storage: 'denied', ad_storage: 'denied') by default before consent."
    ],
    codeSnippet: `// GTM Consent Mode Initialization in <head>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  'analytics_storage': 'denied',
  'ad_storage': 'denied',
  'wait_for_update': 500
});`,
    codeLanguage: "javascript",
    timeToFixEstimate: "45 mins",
    verificationStep: "Inspect network tab on initial page load; confirm zero requests to google-analytics.com or facebook.com before consent.",
    clientActionRequired: false,
  },

  provide_equal_reject_button: {
    id: "provide_equal_reject_button",
    title: "Provide Equal Visual Prominence for Consent Rejection",
    summary: "Remove dark patterns by giving the 'Reject All' button identical visual weight, sizing, and contrast as 'Accept All'.",
    steps: [
      "Modify consent banner UI so 'Reject All' is a first-layer button alongside 'Accept All'.",
      "Do not hide reject behind a 'Manage Preferences' secondary screen.",
      "Use equivalent font size, padding, and visible button borders for both buttons."
    ],
    codeSnippet: `<div class="consent-actions">
  <button type="button" class="btn btn-secondary" id="consent-reject">Reject Non-Essential</button>
  <button type="button" class="btn btn-primary" id="consent-accept">Accept All</button>
</div>`,
    codeLanguage: "html",
    timeToFixEstimate: "20 mins",
    verificationStep: "Visually verify on mobile and desktop that the reject button is immediately visible without scrolling or extra clicks.",
    clientActionRequired: false,
  },

  fix_reject_consent_state: {
    id: "fix_reject_consent_state",
    title: "Enforce Complete Tracker Deactivation on Rejection",
    summary: "Ensure clicking 'Reject All' halts all non-essential trackers and purges any temporary tracking cookies.",
    steps: [
      "Attach event listener to the reject button that unloads or prevents tracker activation.",
      "Delete non-essential cookies if previously set.",
      "Persist the rejection decision in localStorage so subsequent page visits do not re-prompt or fire trackers."
    ],
    timeToFixEstimate: "30 mins",
    verificationStep: "Click 'Reject All' and reload the page; verify that no analytics or ad requests fire across page navigation.",
    clientActionRequired: false,
  },

  publish_cookie_inventory: {
    id: "publish_cookie_inventory",
    title: "Publish a Complete Cookie Inventory Table",
    summary: "Add a structured table to the cookie policy detailing every cookie, its provider, duration, and purpose.",
    steps: [
      "Audit all first-party and third-party cookies set by the application.",
      "Create a table in /cookies or within the Privacy Policy listing: Cookie Name, Host, Expiry, Purpose, and Category."
    ],
    timeToFixEstimate: "30 mins",
    verificationStep: "Compare the published table against browser DevTools Application > Cookies tab to confirm all cookies are listed.",
    clientActionRequired: true,
  },

  disclose_or_remove_session_replay: {
    id: "disclose_or_remove_session_replay",
    title: "Mask PII and Obtain Explicit Consent for Session Replay",
    summary: "Configure session recording tools (Hotjar, FullStory, Clarity) to mask all sensitive inputs or remove them if unneeded.",
    steps: [
      "Add data-masking attributes (e.g. data-recording-ignore, data-clarity-mask) to all form inputs.",
      "Verify that passwords, credit card numbers, and PII are obfuscated at the DOM recording level.",
      "Require explicit user consent before initializing the session replay script."
    ],
    codeSnippet: `<!-- Mask sensitive fields from session replay tools -->
<input type="text" name="fullName" data-recording-mask="true" data-clarity-mask="true" />
<input type="email" name="email" data-recording-mask="true" data-clarity-mask="true" />`,
    codeLanguage: "html",
    timeToFixEstimate: "25 mins",
    verificationStep: "Inspect session replay dashboards to confirm user inputs appear as asterisks or blurred content.",
    clientActionRequired: false,
  },

  self_host_google_fonts: {
    id: "self_host_google_fonts",
    title: "Self-Host Web Fonts to Prevent IP Leakage",
    summary: "Download web font files (.woff2) and serve them locally from your own domain to avoid unconsented third-party IP transfers.",
    steps: [
      "Download font files using Google Webfonts Helper or Next.js `next/font/google`.",
      "Place font files in your public/fonts directory.",
      "Remove external `<link href='https://fonts.googleapis.com'>` tags from HTML head."
    ],
    codeSnippet: `// In Next.js App Router (app/layout.tsx)
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}`,
    codeLanguage: "typescript",
    timeToFixEstimate: "25 mins",
    verificationStep: "Verify network requests show fonts loaded from your origin domain rather than fonts.gstatic.com.",
    clientActionRequired: false,
  },

  add_image_alt_attributes: {
    id: "add_image_alt_attributes",
    title: "Add Descriptive Alt Text to All Informational Images",
    summary: "Ensure every <img> element has a descriptive alt attribute, or alt='' if purely decorative.",
    steps: [
      "Audit all image elements flagged by accessibility checks.",
      "Add concise, meaningful descriptions for informational images.",
      "For decorative icons or backgrounds, add alt='' and aria-hidden='true'."
    ],
    codeSnippet: `<!-- Meaningful image -->
<img src="/logo.svg" alt="Acme Corporation Logo" width="120" height="40" />

<!-- Decorative image -->
<img src="/decor-pattern.svg" alt="" aria-hidden="true" />`,
    codeLanguage: "html",
    timeToFixEstimate: "20 mins",
    verificationStep: "Run axe accessibility scan or inspect DOM to confirm no <img> elements lack an alt attribute.",
    clientActionRequired: false,
  },

  fix_color_contrast: {
    id: "fix_color_contrast",
    title: "Adjust Text-to-Background Contrast to Meet WCAG AA (4.5:1)",
    summary: "Update CSS color tokens so standard text achieves at least 4.5:1 contrast against its background.",
    steps: [
      "Identify low-contrast text and background hex colors flagged in the findings.",
      "Use an accessible color palette generator to darken text or lighten backgrounds.",
      "Ensure contrast ratio is >= 4.5:1 for regular text and >= 3.0:1 for large text (>= 18pt or 14pt bold)."
    ],
    codeSnippet: `/* Tailwind CSS / CSS variables example */
:root {
  /* Before: #94a3b8 on #ffffff (ratio ~2.8:1 - FAIL) */
  /* After: #475569 on #ffffff (ratio ~5.5:1 - PASS) */
  --text-muted: #475569;
}`,
    codeLanguage: "css",
    timeToFixEstimate: "20 mins",
    verificationStep: "Inspect with browser DevTools color picker to confirm contrast ratio exceeds 4.5:1.",
    clientActionRequired: false,
  },

  add_form_input_labels: {
    id: "add_form_input_labels",
    title: "Associate Explicit Labels with All Form Controls",
    summary: "Ensure every input, select, and textarea has a visible <label> linked via the 'for' attribute.",
    steps: [
      "Add `<label for='id'>` for every form input.",
      "If a visual label cannot be displayed, provide an aria-label attribute.",
      "Never rely solely on placeholder text as a label."
    ],
    codeSnippet: `<div class="field">
  <label for="user-email">Email Address</label>
  <input type="email" id="user-email" name="email" required />
</div>`,
    codeLanguage: "html",
    timeToFixEstimate: "20 mins",
    verificationStep: "Click the text label; confirm the associated input field receives focus automatically.",
    clientActionRequired: false,
  },

  fix_heading_and_landmarks: {
    id: "fix_heading_and_landmarks",
    title: "Correct Heading Hierarchy and ARIA Landmarks",
    summary: "Ensure page structure follows a logical h1 > h2 > h3 sequence without skipped levels and uses semantic landmarks.",
    steps: [
      "Ensure each page has exactly one <h1> representing the primary page topic.",
      "Do not skip heading levels (e.g. h1 directly to h3).",
      "Wrap major sections in semantic elements (<header>, <main>, <nav>, <footer>)."
    ],
    timeToFixEstimate: "25 mins",
    verificationStep: "Inspect heading tree via screen reader or browser accessibility tree tool to confirm no skipped levels.",
    clientActionRequired: false,
  },

  declare_lang_and_allow_zoom: {
    id: "declare_lang_and_allow_zoom",
    title: "Declare Page Language in <html> Element",
    summary: "Add a valid BCP 47 language code to the root <html> tag for screen readers.",
    steps: [
      "Open your root document template (e.g., app/layout.tsx or index.html).",
      "Add lang='en' (or target language) to the <html> tag.",
      "Ensure viewport meta does not disable user scaling (avoid user-scalable=no or maximum-scale=1.0)."
    ],
    codeSnippet: `<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
</html>`,
    codeLanguage: "html",
    timeToFixEstimate: "5 mins",
    verificationStep: "View page source and verify `<html lang='en'>` exists at the top of the HTML output.",
    clientActionRequired: false,
  },

  provide_accessible_names: {
    id: "provide_accessible_names",
    title: "Provide Accessible Names for Icon Buttons and Links",
    summary: "Add aria-label or visually hidden text to buttons and links that contain only SVG or icons.",
    steps: [
      "Find buttons with only icon SVGs (e.g. close buttons, hamburger menus, search icons).",
      "Add aria-label='Close modal' or `<span class='sr-only'>Close</span>`."
    ],
    codeSnippet: `<button type="button" aria-label="Close dialog" class="icon-btn">
  <svg aria-hidden="true" width="24" height="24">...</svg>
</button>`,
    codeLanguage: "html",
    timeToFixEstimate: "15 mins",
    verificationStep: "Inspect accessibility properties in DevTools; verify accessible name matches the intended action.",
    clientActionRequired: false,
  },

  mute_autoplay_and_add_captions: {
    id: "mute_autoplay_and_add_captions",
    title: "Add Closed Captions to Media and Mute Autoplay",
    summary: "Provide <track kind='captions'> for video elements and ensure autoplaying videos are muted.",
    steps: [
      "Add WebVTT captions track to all explanatory videos.",
      "If video autoplays in background, include the `muted` and `playsinline` attributes."
    ],
    codeSnippet: `<video controls playsinline>
  <source src="/product-tour.mp4" type="video/mp4" />
  <track src="/product-tour-en.vtt" kind="captions" srclang="en" label="English" default />
</video>`,
    codeLanguage: "html",
    timeToFixEstimate: "30 mins",
    verificationStep: "Play video; confirm captions toggle is available and text displays accurately.",
    clientActionRequired: true,
  },

  configure_touch_targets_and_viewport: {
    id: "configure_touch_targets_and_viewport",
    title: "Enforce Minimum 44×44 CSS px Touch Targets",
    summary: "Ensure buttons, links, and touch controls provide adequate spacing and clickable hit area for mobile devices.",
    steps: [
      "Inspect mobile navigation buttons and footer links.",
      "Set min-height and min-width to 44px (or 48px for Android guidelines).",
      "Use padding to enlarge hit area without altering visual icon dimensions."
    ],
    codeSnippet: `.touch-target {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}`,
    codeLanguage: "css",
    timeToFixEstimate: "20 mins",
    verificationStep: "Inspect touch targets in mobile device emulation mode in Chrome DevTools.",
    clientActionRequired: false,
  },

  revoke_and_rotate_exposed_secrets: {
    id: "revoke_and_rotate_exposed_secrets",
    title: "Immediately Revoke, Rotate, and Remove Exposed API Keys",
    summary: "CRITICAL SECURITY ACTION: The identified credentials were found in client-side bundles. Revoke them in provider dashboards and migrate to backend environment variables.",
    steps: [
      "IMMEDIATE: Log into the cloud provider / service dashboard and invalidate the exposed key/token.",
      "Generate a new secret credential.",
      "Remove the secret from client-facing code (e.g. Next.js NEXT_PUBLIC_ variables or hardcoded constants).",
      "Store the credential in secure server-side environment variables (.env.local) and proxy API requests through your backend API routes.",
      "Check server access logs for anomalous activity during the exposure window."
    ],
    codeSnippet: `// BEFORE (INSECURE: Exposed to client browser)
// const apiKey = "secret_key_leaked_in_frontend";

// AFTER (SECURE: Server-side API route app/api/service/route.ts)
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const secretKey = process.env.SERVICE_SECRET_KEY; // Never exposed to client
  // Make authenticated server-side request...
  return NextResponse.json({ success: true });
}`,
    codeLanguage: "typescript",
    timeToFixEstimate: "30 mins",
    verificationStep: "Search production build assets for the revoked string; verify that the new secret never appears in public JS bundles.",
    clientActionRequired: true,
  },

  enable_https_redirect: {
    id: "enable_https_redirect",
    title: "Strictly Enforce HTTPS Redirection and HSTS",
    summary: "Configure server or CDN to redirect all port 80 HTTP traffic to port 443 HTTPS and issue HSTS headers.",
    steps: [
      "Enable automatic HTTP-to-HTTPS redirect in your host / CDN (Vercel, Cloudflare, NGINX).",
      "Add Strict-Transport-Security response header with a max-age of at least 1 year (31536000 seconds)."
    ],
    codeSnippet: `# NGINX Configuration
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}`,
    codeLanguage: "nginx",
    timeToFixEstimate: "15 mins",
    verificationStep: "Send a cURL request: `curl -I http://example.com` and verify an HTTP 301 redirect to https://.",
    clientActionRequired: false,
  },

  renew_tls_certificate: {
    id: "renew_tls_certificate",
    title: "Renew TLS Certificate and Enable Auto-Renewal",
    summary: "Ensure TLS certificate is valid, issued by a trusted CA, and configured for automated renewal before expiration.",
    steps: [
      "Check certificate expiry date in host dashboard (Vercel, AWS ACM, Let's Encrypt).",
      "Trigger manual renewal or configure certbot cron job for auto-renewal 30 days prior to expiration.",
      "Ensure certificate common name covers all subdomains and the apex domain."
    ],
    timeToFixEstimate: "20 mins",
    verificationStep: "Inspect certificate details in browser address bar (padlock icon) to verify the new expiration date.",
    clientActionRequired: false,
  },

  configure_security_headers: {
    id: "configure_security_headers",
    title: "Configure Essential HTTP Security Headers",
    summary: "Add Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy headers.",
    steps: [
      "Configure your web framework or edge proxy to attach security headers to all HTML responses.",
      "Set X-Frame-Options to DENY or SAMEORIGIN to prevent clickjacking.",
      "Set X-Content-Type-Options to nosniff.",
      "Set Referrer-Policy to strict-origin-when-cross-origin."
    ],
    codeSnippet: `// next.config.ts
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

export default {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};`,
    codeLanguage: "typescript",
    timeToFixEstimate: "20 mins",
    verificationStep: "Run `curl -I https://example.com` and verify the security headers are present in the response.",
    clientActionRequired: false,
  },

  set_secure_cookie_flags: {
    id: "set_secure_cookie_flags",
    title: "Set Secure, HttpOnly, and SameSite Flags on Cookies",
    summary: "Ensure authentication and session cookies include Secure (HTTPS only), HttpOnly (inaccessible to JS), and SameSite=Lax/Strict.",
    steps: [
      "Locate cookie generation code in backend sessions or authentication middleware.",
      "Set `secure: true` (only transmitted over HTTPS).",
      "Set `httpOnly: true` on session tokens to block XSS credential theft.",
      "Set `sameSite: 'lax'` or `'strict'` to mitigate Cross-Site Request Forgery (CSRF)."
    ],
    codeSnippet: `// Next.js Route Handler / Middleware cookie setting
response.cookies.set('session_token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
});`,
    codeLanguage: "typescript",
    timeToFixEstimate: "15 mins",
    verificationStep: "Inspect Set-Cookie response header; verify Secure; HttpOnly; SameSite=Lax attributes are present.",
    clientActionRequired: false,
  },

  disable_production_source_maps: {
    id: "disable_production_source_maps",
    title: "Disable Public Source Map Uploads in Production",
    summary: "Prevent leaking proprietary TypeScript source code and internal logic by disabling public source maps.",
    steps: [
      "Update build configuration to disable public .map file generation.",
      "If using error monitoring (Sentry, Datadog), configure CI/CD to upload maps directly to their API and delete them from the public web server directory."
    ],
    codeSnippet: `// next.config.ts
export default {
  productionBrowserSourceMaps: false, // Ensure source maps are not deployed publicly
};`,
    codeLanguage: "typescript",
    timeToFixEstimate: "10 mins",
    verificationStep: "Attempt to fetch a .js.map URL (e.g. `curl -I https://example.com/_next/static/chunks/main.js.map`); ensure it returns 404.",
    clientActionRequired: false,
  },

  sanitize_frontend_build_artifacts: {
    id: "sanitize_frontend_build_artifacts",
    title: "Sanitize Client-Side Bundles of Sensitive Internal Data",
    summary: "Remove internal staging URLs, database connection string patterns, test credentials, and developer debug flags from client bundles.",
    steps: [
      "Audit environment variables prefixed with NEXT_PUBLIC_ or VITE_.",
      "Ensure database URLs, internal IP addresses, and private microservice hostnames are kept exclusively on server-side modules.",
      "Run production build and grep for internal keywords before deployment."
    ],
    timeToFixEstimate: "30 mins",
    verificationStep: "Grep production build static assets for keywords like 'mongodb://', 'internal.net', or 'password'.",
    clientActionRequired: false,
  },

  create_terms_conditions: {
    id: "create_terms_conditions",
    title: "Create and Link Terms of Service / Conditions Page",
    summary: "Publish a clear Terms of Service page establishing service terms, liability limits, and dispute resolution jurisdiction.",
    steps: [
      "Draft terms tailored to your service type (SaaS, e-commerce, marketplace).",
      "Include user obligations, IP ownership, payment terms, cancellation policies, and limitation of liability.",
      "Publish at /terms and link from the global footer and signup/payment pages."
    ],
    timeToFixEstimate: "45 mins",
    verificationStep: "Verify /terms returns HTTP 200 and is linked from the global footer.",
    clientActionRequired: true,
  },

  publish_refund_cancellation_policy: {
    id: "publish_refund_cancellation_policy",
    title: "Publish E-Commerce Refund, Return, and Shipping Policies",
    summary: "Comply with consumer protection laws by clearly publishing refund eligibility, return windows, shipping timelines, and fees.",
    steps: [
      "Draft a dedicated Refund and Cancellation Policy page.",
      "State exact timelines (e.g., 'Refunds processed within 5-7 business days').",
      "Link prominently from checkout flows and the footer."
    ],
    timeToFixEstimate: "30 mins",
    verificationStep: "Verify /refund-policy exists and is referenced directly in the checkout payment screen.",
    clientActionRequired: true,
  },

  add_contact_channel: {
    id: "add_contact_channel",
    title: "Publish Business Contact Information and Grievance Officer Details",
    summary: "Comply with consumer protection and data protection rules by providing an operational email, phone/address, and named Grievance Officer.",
    steps: [
      "Add a Contact Us page with a monitored email address and physical company address.",
      "Under DPDP (India), designate a Grievance Officer with name, email, and complaint redressal timeline in the Privacy Policy."
    ],
    codeSnippet: `<!-- Add to /contact or /privacy -->
<section class="grievance-details">
  <h2>Data Protection & Grievance Officer</h2>
  <p><strong>Name:</strong> Compliance Officer</p>
  <p><strong>Email:</strong> grievance@example.com</p>
  <p><strong>Response Timeline:</strong> Within 48 hours</p>
</section>`,
    codeLanguage: "html",
    timeToFixEstimate: "20 mins",
    verificationStep: "Verify contact email and address are visible and operational on the public site.",
    clientActionRequired: true,
  },

  replace_template_placeholder_text: {
    id: "replace_template_placeholder_text",
    title: "Replace Placeholder Text and Boilerplate in Legal Pages",
    summary: "Remove 'Lorem Ipsum', '[INSERT COMPANY NAME]', and unfinished template placeholders from legal and policy pages.",
    steps: [
      "Search codebase and CMS for terms like 'Lorem ipsum', '[COMPANY NAME]', '[INSERT ADDRESS]', 'john.doe@example.com'.",
      "Replace all bracketed placeholders with actual registered legal entity details."
    ],
    timeToFixEstimate: "15 mins",
    verificationStep: "Perform a site-wide text search for '[' and 'lorem' across policy pages to ensure none remain.",
    clientActionRequired: true,
  },

  integrate_certified_payment_gateway: {
    id: "integrate_certified_payment_gateway",
    title: "Verify Secure, Certified Payment Gateway Integration",
    summary: "Ensure checkout flows use secure, PCI-compliant payment gateways (Razorpay, Stripe) with hosted fields or checkout redirects.",
    steps: [
      "Never capture raw credit card numbers on your own server unless PCI-DSS certified.",
      "Use Razorpay Standard Checkout or Stripe Elements to handle cardholder data in client-side secure iframes.",
      "Verify webhook signatures cryptographically on the server."
    ],
    timeToFixEstimate: "60 mins",
    verificationStep: "Perform a sandbox test checkout; inspect network traffic to ensure no card data touches your backend origin.",
    clientActionRequired: false,
  },

  audit_web_font_licences: {
    id: "audit_web_font_licences",
    title: "Audit Font and Icon Asset Licences",
    summary: "Ensure commercial web licences are held for all custom fonts and icon sets, or switch to open-source alternatives (SIL Open Font License).",
    steps: [
      "Review @font-face declarations in stylesheets.",
      "Verify that commercial web font licences match the site's monthly pageview tier.",
      "Include licence files or attribution comments where required by open-source licences."
    ],
    timeToFixEstimate: "20 mins",
    verificationStep: "Verify font licences documentation in company asset repository.",
    clientActionRequired: true,
  },

  enable_privacy_enhanced_media_embeds: {
    id: "enable_privacy_enhanced_media_embeds",
    title: "Use Privacy-Enhanced Modes for Embedded Media",
    summary: "Use youtube-nocookie.com or lightweight click-to-load facades for embedded third-party video players.",
    steps: [
      "Replace youtube.com/embed URLs with www.youtube-nocookie.com/embed.",
      "Add title attributes to all iframes for accessibility.",
      "Consider a click-to-load placeholder image that only loads the iframe when the user clicks play."
    ],
    codeSnippet: `<iframe
  src="https://www.youtube-nocookie.com/embed/VIDEO_ID"
  title="Product Demonstration"
  loading="lazy"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen>
</iframe>`,
    codeLanguage: "html",
    timeToFixEstimate: "15 mins",
    verificationStep: "Inspect network traffic before playing the video; verify no cookies from doubleclick.net are set.",
    clientActionRequired: false,
  },

  fix_broken_navigation_links: {
    id: "fix_broken_navigation_links",
    title: "Fix Broken Internal Links (404 Responses)",
    summary: "Update or redirect broken internal URLs identified in the scan report.",
    steps: [
      "Review the list of broken URLs from the findings.",
      "Update destination links in navigation menus, footer, and buttons to valid routes.",
      "Set up 301 redirects for legacy URLs if pages were moved."
    ],
    timeToFixEstimate: "20 mins",
    verificationStep: "Click the updated links in staging; verify all return HTTP 200.",
    clientActionRequired: false,
  },

  create_essential_site_pages: {
    id: "create_essential_site_pages",
    title: "Publish Core Website Pages (Home, About, Contact)",
    summary: "Ensure basic site navigation is discoverable and fundamental core pages exist.",
    steps: [
      "Create missing standard pages (/about, /contact).",
      "Add them to header or footer navigation menus."
    ],
    timeToFixEstimate: "30 mins",
    verificationStep: "Verify each core page URL returns HTTP 200 and contains meaningful content.",
    clientActionRequired: true,
  },

  optimize_asset_delivery_and_load_speed: {
    id: "optimize_asset_delivery_and_load_speed",
    title: "Optimize Large Assets and Mobile Page Performance",
    summary: "Compress unoptimized images, enable modern formats (WebP/AVIF), and defer non-critical scripts.",
    steps: [
      "Convert large PNG/JPEG images to WebP or AVIF using Next.js Image component or Sharp.",
      "Add loading='lazy' and explicit width/height to prevent layout shift.",
      "Add defer or async to non-critical script tags."
    ],
    timeToFixEstimate: "30 mins",
    verificationStep: "Run Lighthouse or check PageSpeed Insights; verify mobile load performance is under 3 seconds.",
    clientActionRequired: false,
  },

  fix_broken_assets: {
    id: "fix_broken_assets",
    title: "Resolve Broken Static Assets (404 Images, CSS, Fonts)",
    summary: "Fix or remove referenced asset files that fail to load with HTTP 404 or network errors.",
    steps: [
      "Review the list of broken assets in the finding evidence.",
      "Verify asset file paths in public/ directory.",
      "Correct casing or typos in filenames (e.g. Logo.PNG vs logo.png on Linux hosting)."
    ],
    timeToFixEstimate: "15 mins",
    verificationStep: "Open page in browser and inspect DevTools Network tab for any red 404 responses.",
    clientActionRequired: false,
  },

  fix_dead_navigation_links: {
    id: "fix_dead_navigation_links",
    title: "Fix Dead Navigation Links and Empty Anchors",
    summary: "Replace empty href='#' or javascript:void(0) with functional URLs or proper <button> elements.",
    steps: [
      "Find anchors with href='#' used solely to trigger JavaScript clicks.",
      "Change them to `<button type='button'>` elements with appropriate styling.",
      "Ensure all `<a href>` elements lead to valid destinations."
    ],
    timeToFixEstimate: "15 mins",
    verificationStep: "Keyboard navigate using Tab key to confirm all interactive elements behave as proper links or buttons.",
    clientActionRequired: false,
  },

  audit_and_consolidate_third_party_scripts: {
    id: "audit_and_consolidate_third_party_scripts",
    title: "Audit and Consolidate Third-Party Script Tags",
    summary: "Review all external scripts loaded; remove obsolete marketing pixels or development debug tags.",
    steps: [
      "Audit the third-party script inventory generated by the scan.",
      "Remove duplicate or abandoned tracking tags (old heatmaps, deprecated chat widgets).",
      "Consolidate remaining scripts under a single tag management system."
    ],
    timeToFixEstimate: "30 mins",
    verificationStep: "Compare script count before and after; verify network requests to third parties are minimized.",
    clientActionRequired: true,
  },

  stop_pii_transmission_to_third_parties: {
    id: "stop_pii_transmission_to_third_parties",
    title: "Stop Leaking Sensitive Data in Query Parameters or Payloads",
    summary: "Ensure emails, names, phone numbers, and auth tokens are never transmitted in URLs, GET parameters, or unmasked analytics payloads.",
    steps: [
      "Review URLs generated by authentication, signup, and referral flows.",
      "Never pass email addresses or tokens as URL query parameters (e.g. ?email=user@example.com).",
      "Configure analytics tool sanitizers to scrub email and phone patterns automatically from captured URLs."
    ],
    codeSnippet: `// Strip query parameters from analytics pageview URLs
gtag('config', 'G-XXXXXXXXXX', {
  page_location: window.location.origin + window.location.pathname // Removes sensitive ?query=
});`,
    codeLanguage: "javascript",
    timeToFixEstimate: "30 mins",
    verificationStep: "Monitor outgoing requests in DevTools while completing a signup; verify zero PII in query parameters or payload bodies.",
    clientActionRequired: false,
  },

  implement_subresource_integrity: {
    id: "implement_subresource_integrity",
    title: "Add Subresource Integrity (SRI) Hashes to CDN Scripts",
    summary: "Protect against CDN tampering by adding integrity hashes and crossorigin='anonymous' to third-party script and stylesheet tags.",
    steps: [
      "Generate cryptographic SHA-384 or SHA-512 hashes for externally hosted scripts.",
      "Add `integrity='sha384-...'` and `crossorigin='anonymous'` attributes to the `<script>` or `<link>` tags."
    ],
    codeSnippet: `<script
  src="https://cdn.example.com/library.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous">
</script>`,
    codeLanguage: "html",
    timeToFixEstimate: "15 mins",
    verificationStep: "View page source to confirm integrity attribute is present and script executes without browser console SRI errors.",
    clientActionRequired: false,
  },
};

/**
 * Resolves a remediation template ID to its full definition.
 * Falls back to a structured default if template is not registered.
 */
export function getRemediationTemplate(templateId?: string): RemediationTemplate {
  if (templateId && REMEDIATION_TEMPLATES[templateId]) {
    return REMEDIATION_TEMPLATES[templateId]!;
  }

  // Graceful fallback
  return {
    id: templateId ?? "general_remediation",
    title: "Remediate Observed Non-Compliance",
    summary: "Investigate the evidence locator and apply appropriate code or configuration adjustments.",
    steps: [
      "Review the structured evidence payload in the report finding.",
      "Inspect the corresponding source locator in the codebase or server configuration.",
      "Implement the necessary code or policy adjustment to resolve the finding.",
      "Rerun the compliance scanner to verify resolution."
    ],
    timeToFixEstimate: "30 mins",
    verificationStep: "Rescan the website to verify the check transitions to 'passed'.",
    clientActionRequired: false,
  };
}

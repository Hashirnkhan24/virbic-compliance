/**
 * AI Fixing Kit Prompt Generator
 *
 * Transforms verified scan findings and raw evidence records into
 * precise, production-grade instructions tailored for AI coding agents
 * (Cursor, Claude Code, Antigravity, GitHub Copilot) or human developers.
 *
 * Core Invariants:
 * - Never pretend the scanner knows backend implementation or invent file paths.
 * - Always cite real DOM locators, network URLs, and observed evidence.
 * - Require business owner confirmation for legal, pricing, and policy statements.
 * - Frame deliverables as prompts for coding agents, not automated code fixes.
 */

import type { FindingRecord, EvidenceRecord } from "@vibe/contracts";

export interface FixingPromptSections {
  issue: string;
  whyItMatters: string;
  evidence: string;
  location: string;
  desiredOutcome: string;
  instructions: string[];
  constraints: string[];
  acceptanceCriteria: string[];
  testingGuidance: string[];
  reportingReminder: string;
}

export interface PromptGenerationOptions {
  targetUrl?: string;
  framework?: string; // e.g. "Next.js", "React", or undefined
}

interface CheckGuidance {
  whyItMatters: string;
  desiredOutcome: string;
  agentTasks: (params: { targetUrl?: string; evidenceStr: string; locationStr: string }) => string[];
  constraints: string[];
  acceptanceCriteria: string[];
  testingSteps: string[];
  humanReviewNote?: string;
}

const CHECK_GUIDANCE: Record<string, CheckGuidance> = {
  A1: {
    whyItMatters: "A privacy policy is mandatory under global privacy laws (DPDP, GDPR, CCPA) and is required by payment gateways (Stripe, Razorpay) before live merchant approval.",
    desiredOutcome: "A dedicated, accessible privacy policy page published on the site and linked in global navigation.",
    agentTasks: ({ targetUrl }) => [
      `Search the repository for existing privacy policy pages or legal routes (e.g., /privacy, /privacy-policy, legal components)${targetUrl ? ` matching ${targetUrl}` : ""}.`,
      `If a privacy page exists but is unlinked, add an accessible link to it in the global footer navigation component.`,
      `If no privacy policy exists, draft a standard privacy policy template covering: data collected, purposes, data retention, third-party services, and contact email.`,
      `Ensure the page is publicly routable and renders with standard site layout and styling.`,
    ],
    constraints: [
      "Do not invent legal entities, registration numbers, or unconfirmed business practices. Mark placeholders with [NEEDS_OWNER_INPUT].",
      "Preserve existing global footer layout and responsive behavior.",
    ],
    acceptanceCriteria: [
      "Privacy policy page loads with HTTP 200 at a standard path (/privacy or /privacy-policy).",
      "Footer navigation includes a clear, accessible link labeled 'Privacy Policy'.",
      "Policy contains readable headings and owner contact details.",
    ],
    testingSteps: [
      "Navigate to the privacy page in a browser and verify text renders cleanly on desktop and mobile.",
      "Inspect the footer link to ensure href resolves without redirect loops or 404s.",
    ],
    humanReviewNote: "The final policy content and company details must be reviewed and approved by the site owner.",
  },

  A5: {
    whyItMatters: "Discrepancies between your stated privacy policy and actual tracking scripts invite regulatory penalties under GDPR and DPDP for misleading consumers.",
    desiredOutcome: "The privacy policy explicitly lists all third-party analytics and tracking providers currently running on the site.",
    agentTasks: ({ evidenceStr }) => [
      `Inspect the third-party trackers detected during the scan (${evidenceStr || "analytics/marketing scripts"}).`,
      `Locate the privacy policy page or component in the repository.`,
      `Add or update a 'Third-Party Services & Analytics' section in the privacy policy explicitly naming each provider and explaining what telemetry is sent.`,
    ],
    constraints: [
      "Do not remove legitimate analytics tools without project owner permission.",
      "Accurately reflect only the tracking tools actually in use.",
    ],
    acceptanceCriteria: [
      "Privacy policy explicitly mentions the observed third-party tools.",
      "The lawful basis or purpose of tracking is clearly stated in plain language.",
    ],
    testingSteps: [
      "Review the updated policy text against the list of active scripts in the codebase.",
    ],
  },

  A6: {
    whyItMatters: "Collecting personal data (emails, names, phone numbers) through forms without notice or affirmative consent violates DPDP Section 5/6 and GDPR Article 7.",
    desiredOutcome: "All data-collection forms include a clear notice and link to the privacy policy near the submission button.",
    agentTasks: ({ locationStr }) => [
      `Search the repository for form components, especially lead-capture, registration, or contact forms (${locationStr || "forms"}).`,
      `Add a clear, concise notice above or next to the submit button: 'By submitting, you agree to our Privacy Policy.' with an active link to the policy.`,
      `If collecting marketing opt-ins, implement an unchecked-by-default consent checkbox.`,
    ],
    constraints: [
      "Never pre-tick consent checkboxes (pre-ticked boxes are invalid under GDPR/DPDP).",
      "Do not break form validation or submit button state handlers.",
    ],
    acceptanceCriteria: [
      "Every user-facing data collection form contains a visible link to the privacy policy.",
      "Submission handlers function normally with the added notice.",
    ],
    testingSteps: [
      "Submit test entries on desktop and mobile to ensure form layout and validation work correctly.",
    ],
  },

  A10: {
    whyItMatters: "Under CCPA / CPRA and state privacy laws, websites serving California or US consumers that use ad trackers must provide a clear opt-out mechanism.",
    desiredOutcome: "A visible 'Your Privacy Choices' or 'Do Not Sell or Share My Personal Information' footer link.",
    agentTasks: () => [
      `Locate the global footer component in the repository.`,
      `Add an accessible link labeled 'Your Privacy Choices' or 'Do Not Sell or Share My Personal Info'.`,
      `Link it to your privacy policy opt-out section or cookie preference modal.`,
    ],
    constraints: [
      "Do not hide or obfuscate the link in collapsed accordions on mobile.",
    ],
    acceptanceCriteria: [
      "A recognizable opt-out link is present in the footer across all public pages.",
    ],
    testingSteps: [
      "Verify the link is present in the rendered footer and triggers the privacy choices section or modal.",
    ],
  },

  B1: {
    whyItMatters: "Deploying tracking or analytics cookies without prior consent violates the ePrivacy Directive and GDPR in the EU/UK.",
    desiredOutcome: "A functional cookie consent banner shown to first-time visitors before non-essential cookies fire.",
    agentTasks: () => [
      `Check if a cookie consent banner component or library is configured in the repository.`,
      `If missing, integrate a lightweight consent banner or CMP (Consent Management Platform).`,
      `Ensure the banner provides clear 'Accept', 'Reject', and 'Customize' options.`,
    ],
    constraints: [
      "Do not block essential site functionality or navigation behind the banner.",
      "Ensure banner works without JavaScript errors on slow mobile connections.",
    ],
    acceptanceCriteria: [
      "Banner renders cleanly on initial visit in an incognito window.",
      "Banner choices are remembered in local storage or a consent cookie.",
    ],
    testingSteps: [
      "Test in a clean browser profile: verify banner appears, choice persists on refresh, and banner does not reappear.",
    ],
  },

  B2: {
    whyItMatters: "Loading tracking pixels or analytics before the user makes a choice violates EU/UK consent laws and causes immediate compliance failures.",
    desiredOutcome: "Non-essential scripts (Google Analytics, Meta Pixel, Hotjar, etc.) remain inert until user grants explicit consent.",
    agentTasks: ({ evidenceStr }) => [
      `Search the repository for where third-party scripts (${evidenceStr || "tracking scripts"}) are initialized.`,
      `Condition the execution or script tag insertion on the user's consent choice (e.g. check consent state before calling analytics.load or gtag).`,
      `Ensure strictly necessary assets load normally.`,
    ],
    constraints: [
      "Do not delay critical application scripts or CSS bundles.",
    ],
    acceptanceCriteria: [
      "Network inspector shows zero tracking requests before clicking 'Accept' on the cookie banner.",
      "Tracking scripts load immediately once 'Accept' is clicked.",
    ],
    testingSteps: [
      "Open DevTools Network tab with empty cache: verify no analytics requests fire on initial load prior to interaction.",
    ],
  },

  B3: {
    whyItMatters: "Asymmetric banners with a prominent 'Accept' button and hidden/tiny 'Reject' link are considered deceptive dark patterns by European regulators (CNIL, ICO).",
    desiredOutcome: "Equal visual prominence for 'Accept All' and 'Reject Non-Essential' buttons on the cookie banner.",
    agentTasks: () => [
      `Locate the cookie banner component and its styling.`,
      `Update the button styles so 'Reject' has equivalent size, padding, and legibility as 'Accept'.`,
      `Avoid deceptive color schemes where 'Reject' looks like a disabled grayed-out button.`,
    ],
    constraints: [
      "Maintain accessible color contrast (minimum 4.5:1 ratio) on both buttons.",
    ],
    acceptanceCriteria: [
      "Both buttons have comparable button geometry and clear typography.",
      "Clicking 'Reject' closes the banner and records negative consent.",
    ],
    testingSteps: [
      "Visually inspect the banner and verify both buttons are easily clickable on touch devices.",
    ],
  },

  C1: {
    whyItMatters: "Images missing descriptive alt text prevent visually impaired users from understanding your content and hurt SEO rankings.",
    desiredOutcome: "All meaningful images have concise, descriptive alt attributes; decorative images use alt=''.",
    agentTasks: ({ evidenceStr, locationStr }) => [
      `Search for the image elements flagged during the scan (${locationStr || evidenceStr || "img elements"}).`,
      `Add descriptive 'alt' attributes explaining the image content in context.`,
      `For purely decorative dividers, backgrounds, or icons, add alt="" so screen readers ignore them.`,
    ],
    constraints: [
      "Avoid repetitive or redundant phrases like 'image of' or 'picture of' in alt text.",
    ],
    acceptanceCriteria: [
      "Every <img> or Next.js <Image> has a valid alt attribute.",
      "Axe or lighthouse accessibility checks pass for image-alt.",
    ],
    testingSteps: [
      "Inspect DOM elements with browser DevTools to verify alt attributes are populated.",
    ],
  },

  C2: {
    whyItMatters: "Low color contrast makes text illegible for users with visual impairments, older users, and anyone in bright sunlight (WCAG 2.1 AA requires 4.5:1 for normal text).",
    desiredOutcome: "All text elements meet or exceed WCAG 2.1 AA contrast ratios (4.5:1 for normal text, 3:1 for large text).",
    agentTasks: ({ evidenceStr, locationStr }) => [
      `Locate the low-contrast elements flagged (${locationStr || evidenceStr || "text elements"}).`,
      `Check their CSS color and background-color definitions in stylesheet or Tailwind classes.`,
      `Adjust the foreground or background color to satisfy WCAG AA contrast guidelines.`,
    ],
    constraints: [
      "Preserve brand aesthetic while adjusting shade darkness/lightness.",
    ],
    acceptanceCriteria: [
      "Contrast ratio is at least 4.5:1 for body copy and 3.0:1 for 18pt+ headings.",
    ],
    testingSteps: [
      "Use Chrome DevTools color picker to verify contrast badge displays a green checkmark.",
    ],
  },

  C4: {
    whyItMatters: "Form inputs without accessible labels cannot be navigated reliably by screen reader users or password autofill tools.",
    desiredOutcome: "Every form input has an associated <label> with matching 'for'/'id' or aria-label.",
    agentTasks: ({ locationStr }) => [
      `Inspect the input and select controls in the form component (${locationStr || "inputs"}).`,
      `Associate each input with an explicit <label htmlFor="inputId"> or add an aria-label attribute.`,
      `Do not rely solely on placeholder text as a substitute for labels.`,
    ],
    constraints: [
      "If visual design requires a hidden label, use a 'sr-only' utility class rather than deleting the label.",
    ],
    acceptanceCriteria: [
      "Clicking a label element focuses its corresponding input.",
      "Screen readers announce the purpose of every input field.",
    ],
    testingSteps: [
      "Click label text in the browser to confirm focus transfer to the input field.",
    ],
  },

  C5: {
    whyItMatters: "Skipping heading levels (e.g. h1 to h4) or omitting main landmark regions confuses screen reader users trying to navigate your page hierarchy.",
    desiredOutcome: "Logical heading hierarchy (h1 -> h2 -> h3) and standard HTML5 landmark elements (<main>, <header>, <nav>, <footer>).",
    agentTasks: () => [
      `Review heading tags on the home and core landing pages.`,
      `Ensure there is exactly one primary <h1> per page representing the page title.`,
      `Adjust nested headings so levels are not skipped (e.g. follow <h2> with <h3>, not <h4>).`,
      `Ensure the page content is wrapped in a <main> landmark element.`,
    ],
    constraints: [
      "Update CSS/Tailwind classes if changing a heading tag changes visual sizing.",
    ],
    acceptanceCriteria: [
      "Headings form a sequential tree without skipped levels.",
      "Document has a single <main> element.",
    ],
    testingSteps: [
      "Run an automated accessibility test (e.g. Axe DevTools) to verify no heading-order violations.",
    ],
  },

  C6: {
    whyItMatters: "Screen readers need the lang attribute on <html> to select the correct speech synthesizer and pronunciation rules.",
    desiredOutcome: "The root <html> element specifies the primary document language (e.g. <html lang='en'>).",
    agentTasks: () => [
      `Locate the root layout or document template (e.g. layout.tsx, _document.tsx, or index.html).`,
      `Add or update the lang attribute on the root <html> tag (e.g. lang="en").`,
    ],
    constraints: [
      "Ensure language code is a valid BCP 47 code (e.g. 'en', 'es', 'fr', 'en-IN').",
    ],
    acceptanceCriteria: [
      "Page DOM displays <html lang='...'> on initial load.",
    ],
    testingSteps: [
      "Inspect the root element in page source to confirm lang attribute presence.",
    ],
  },

  C7: {
    whyItMatters: "Icon buttons or clickable controls without accessible text are invisible to assistive technologies.",
    desiredOutcome: "All buttons, icon links, and interactive elements have accessible names via visible text, aria-label, or title.",
    agentTasks: ({ locationStr }) => [
      `Inspect clickable controls and icon buttons (${locationStr || "buttons"}).`,
      `Add an aria-label attribute (e.g., aria-label="Close menu" or aria-label="Search").`,
    ],
    constraints: [
      "Keep aria-label text brief and action-oriented.",
    ],
    acceptanceCriteria: [
      "Every interactive element announces a clear name in accessibility tree.",
    ],
    testingSteps: [
      "Inspect the element in the DevTools Accessibility tab to check its computed name.",
    ],
  },

  C10: {
    whyItMatters: "Buttons or links smaller than 24x24px (WCAG 2.1 AA / 44x44px AAA) are frustrating to tap on mobile devices and lead to accidental mis-taps.",
    desiredOutcome: "Interactive touch targets have a minimum clickable area of 24x24px (preferably 44x44px).",
    agentTasks: ({ locationStr }) => [
      `Locate the small touch targets flagged (${locationStr || "small buttons/links"}).`,
      `Increase padding or set min-height and min-width to ensure the interactive hitbox is at least 24x24px (preferably 40-48px on mobile).`,
    ],
    constraints: [
      "Preserve the visual icon size by adding padding to the clickable container.",
    ],
    acceptanceCriteria: [
      "Computed bounding box of interactive controls is >= 24px in width and height.",
    ],
    testingSteps: [
      "Use Chrome DevTools device mode to inspect touch target dimensions.",
    ],
  },

  D1: {
    whyItMatters: "Exposing private credentials (AWS keys, OpenAI keys, database passwords) in frontend code allows immediate unauthorized access and account takeover.",
    desiredOutcome: "All private API keys and tokens are removed from frontend bundles and restricted to server-side environments.",
    agentTasks: ({ evidenceStr }) => [
      `Search the repository for any occurrences of the exposed key pattern (${evidenceStr || "API key"}).`,
      `Move the sensitive credential to server-side environment variables (.env.local).`,
      `Immediately revoke and rotate the exposed API key in the provider's developer console.`,
      `Ensure frontend code calls a backend proxy route instead of directly querying third-party APIs with private tokens.`,
    ],
    constraints: [
      "NEVER commit raw secrets into git history.",
      "Prefix client-safe keys appropriately (e.g. NEXT_PUBLIC_) only if public by design.",
    ],
    acceptanceCriteria: [
      "Client JS bundles contain zero occurrences of the sensitive secret.",
      "The rotated key is stored securely in environment variables.",
    ],
    testingSteps: [
      "Run a production build and search the generated client bundle files for the key string.",
    ],
    humanReviewNote: "CRITICAL: The exposed credential must be rotated immediately in your cloud provider console.",
  },

  D5: {
    whyItMatters: "Serving pages over unencrypted HTTP exposes user traffic to interception, credential sniffing, and browser security warnings.",
    desiredOutcome: "All HTTP requests automatically redirect with HTTP 301 to secure HTTPS.",
    agentTasks: () => [
      `Review server or reverse proxy configuration (e.g., vercel.json, next.config, Nginx, Cloudflare).`,
      `Enable automatic HTTP-to-HTTPS redirect rules.`,
      `Ensure SSL/TLS certificate is active and auto-renews.`,
    ],
    constraints: [
      "Use 301 permanent redirect rather than 302 to preserve SEO authority.",
    ],
    acceptanceCriteria: [
      "Navigating to http:// target domain redirects to https:// with status 301.",
    ],
    testingSteps: [
      "Run `curl -I http://yourdomain.com` in terminal to confirm 301 response pointing to https://.",
    ],
  },

  D6: {
    whyItMatters: "Missing core HTTP security headers (HSTS, X-Content-Type-Options, Frame-Options) leaves your site vulnerable to clickjacking and MIME-type sniffing.",
    desiredOutcome: "The web server returns standard protective security headers on all responses.",
    agentTasks: () => [
      `Locate server configuration or Next.js headers config (e.g., next.config headers() or middleware).`,
      `Add standard security headers:`,
      `  - Strict-Transport-Security: max-age=31536000; includeSubDomains`,
      `  - X-Content-Type-Options: nosniff`,
      `  - X-Frame-Options: DENY or SAMEORIGIN`,
      `  - Referrer-Policy: strict-origin-when-cross-origin`,
    ],
    constraints: [
      "Do not configure Content-Security-Policy with overly strict rules that break legitimate analytics or fonts without testing.",
    ],
    acceptanceCriteria: [
      "Response headers include HSTS, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy.",
    ],
    testingSteps: [
      "Inspect network response headers in browser DevTools or run `curl -I https://yourdomain.com`.",
    ],
  },

  D7: {
    whyItMatters: "Cookies without Secure, HttpOnly, or SameSite attributes can be stolen via XSS attacks or manipulated in cross-site request forgery attacks.",
    desiredOutcome: "All sensitive session and authentication cookies include Secure, HttpOnly, and SameSite=Lax/Strict flags.",
    agentTasks: ({ evidenceStr }) => [
      `Search backend authentication and session cookie setting logic (${evidenceStr || "cookies"}).`,
      `Set 'Secure: true' so cookies only transmit over HTTPS.`,
      `Set 'HttpOnly: true' on auth/session cookies so client scripts cannot read them.`,
      `Set 'SameSite: Lax' or 'SameSite: Strict' to prevent CSRF.`,
    ],
    constraints: [
      "Do not set HttpOnly on client-read cookies like dark-mode or theme preference.",
    ],
    acceptanceCriteria: [
      "Session and auth cookies display Secure, HttpOnly, and SameSite in DevTools Application > Cookies tab.",
    ],
    testingSteps: [
      "Inspect cookies in browser Application tab to verify flag status.",
    ],
  },

  D9: {
    whyItMatters: "Exposing source maps (.js.map) in production reveals your unminified source code, comments, internal endpoints, and hidden application logic.",
    desiredOutcome: "Production builds disable source map publishing or restrict maps to private error monitoring servers.",
    agentTasks: () => [
      `Review build configuration (e.g., next.config.js, vite.config.ts, or tsconfig).`,
      `Set production source maps to false (e.g. productionBrowserSourceMaps: false in Next.js).`,
      `If using Sentry, configure private source map upload with deletion from public web server.`,
    ],
    constraints: [
      "Keep source maps enabled in local development mode for debugging.",
    ],
    acceptanceCriteria: [
      "Requesting .js.map files on public domain returns HTTP 404.",
    ],
    testingSteps: [
      "Verify production build output folder contains no public .map files in web root.",
    ],
  },

  D12: {
    whyItMatters: "Leaving debug state, mock customer records, or internal stack traces in client HTML risks data leakage and looks unprofessional.",
    desiredOutcome: "Frontend components strip internal development debug logs and mock data in production builds.",
    agentTasks: ({ evidenceStr }) => [
      `Search the codebase for the observed debug text or console logs (${evidenceStr || "debug data"}).`,
      `Remove or gate debug logs behind process.env.NODE_ENV !== 'production'.`,
    ],
    constraints: [
      "Do not delete critical error telemetry needed for production monitoring.",
    ],
    acceptanceCriteria: [
      "Production page source contains no internal debug state or credentials.",
    ],
    testingSteps: [
      "View rendered HTML source and console in production build to verify absence of debug output.",
    ],
  },

  E1: {
    whyItMatters: "Operating a commercial SaaS without published Terms and Conditions leaves your intellectual property, user conduct boundaries, and liability limits unprotected.",
    desiredOutcome: "A dedicated Terms of Service page published and clearly linked from the global footer and signup flows.",
    agentTasks: () => [
      `Search repository for existing terms pages (e.g. /terms, /terms-of-service).`,
      `If missing, create a Terms of Service page covering: account rules, payment terms, acceptable use, termination, and limitation of liability.`,
      `Add an accessible link to Terms in the global footer navigation and registration flow.`,
    ],
    constraints: [
      "Do not invent legal jurisdiction or arbitration clauses without owner direction.",
    ],
    acceptanceCriteria: [
      "Terms page is accessible at a standard URL (/terms or /terms-of-service).",
      "Footer includes a prominent link to Terms.",
    ],
    testingSteps: [
      "Confirm page loads cleanly and link in footer navigates to it.",
    ],
    humanReviewNote: "Terms of Service must be approved by the founder or legal counsel before official launch.",
  },

  E2: {
    whyItMatters: "Payment gateways (Razorpay, Stripe) will reject merchant onboarding if your website lacks a clear, explicit refund and cancellation policy.",
    desiredOutcome: "A clear refund, cancellation, and shipping/delivery policy published on the site.",
    agentTasks: () => [
      `Search repository for refund or cancellation policies.`,
      `If missing, draft a concise Refund & Cancellation Policy explaining: eligibility window (e.g. 14 days), process to request a refund, and processing timelines.`,
      `Link this policy in the footer and on pricing or checkout pages.`,
    ],
    constraints: [
      "State accurate timelines confirmed by the business owner (e.g. 5-7 business days for refund processing).",
    ],
    acceptanceCriteria: [
      "Refund policy page loads at /refund-policy or /cancellation-policy.",
      "Policy clearly answers who is eligible and how to request a refund.",
    ],
    testingSteps: [
      "Navigate to the refund policy link from the footer and verify text readability.",
    ],
    humanReviewNote: "Ensure the stated refund terms match your actual billing configuration in Stripe/Razorpay.",
  },

  E4: {
    whyItMatters: "E-commerce regulations and payment processors require websites to display at least one verified commercial contact channel (support email, address, or phone).",
    desiredOutcome: "A visible support email or contact page in the header/footer and on legal policy pages.",
    agentTasks: () => [
      `Locate the contact page, footer, or legal templates in the repository.`,
      `Add an active, accessible contact channel (e.g., support@yourdomain.com or a Contact Us link).`,
      `Ensure email addresses use mailto: links and phone numbers use tel: links.`,
    ],
    constraints: [
      "Do not put fake placeholder emails like support@example.com into production.",
    ],
    acceptanceCriteria: [
      "A working contact channel is visible in the site footer.",
    ],
    testingSteps: [
      "Click the contact link to verify mailto: or contact page opens properly.",
    ],
  },

  E5: {
    whyItMatters: "Leaving placeholder text like '[Insert Company Name]', '[Your Website]', or 'Lorem Ipsum' undermines user trust and invalidates legal policies.",
    desiredOutcome: "All template placeholders are replaced with real company and brand information.",
    agentTasks: ({ evidenceStr, locationStr }) => [
      `Search the repository for placeholder strings (${evidenceStr || "'[Insert Company Name]' or 'Lorem ipsum'"}) in ${locationStr || "legal pages"}.`,
      `Replace bracketed placeholders with official business details.`,
      `Ensure brand name and legal operating entity are consistent across pages.`,
    ],
    constraints: [
      "If business details are not yet known, prompt the project owner for exact legal name and address.",
    ],
    acceptanceCriteria: [
      "A repository grep for '[Insert' or 'Lorem ipsum' returns zero matches on public routes.",
    ],
    testingSteps: [
      "Run `git grep -i 'lorem ipsum'` and `git grep '\\[Insert'` to verify no lingering dummy text.",
    ],
  },

  F7: {
    whyItMatters: "Sending payment credentials over insecure channels or embedding non-PCI-compliant payment forms exposes customer cards to theft.",
    desiredOutcome: "All checkout and card collection workflows use hosted gateway fields (Stripe Elements, Razorpay Checkout) over HTTPS.",
    agentTasks: () => [
      `Inspect payment integration components in the repository.`,
      `Verify checkout loads via HTTPS and uses official SDKs (e.g. @stripe/stripe-js or Razorpay SDK).`,
      `Ensure card numbers are never sent directly to your application server.`,
    ],
    constraints: [
      "Never store or log credit card CVV, full card numbers, or expiration dates.",
    ],
    acceptanceCriteria: [
      "Payment fields are rendered inside secure gateway iframes.",
    ],
    testingSteps: [
      "Inspect checkout page in DevTools to confirm secure iframe embedding.",
    ],
  },

  H1: {
    whyItMatters: "Broken internal links (HTTP 404/500) damage SEO crawlability, lower search rankings, and cause user drop-off.",
    desiredOutcome: "All navigation links resolve to valid, working internal routes with HTTP 200.",
    agentTasks: ({ evidenceStr, locationStr }) => [
      `Search for the broken link target (${evidenceStr || locationStr || "404 links"}).`,
      `Update the href attribute to point to the correct active route.`,
      `If the linked page was deprecated, implement an HTTP 301 redirect or remove the dead link.`,
    ],
    constraints: [
      "Verify internal links use relative paths or correct canonical domain.",
    ],
    acceptanceCriteria: [
      "Clicking internal navigation links results in HTTP 200 on all pages.",
    ],
    testingSteps: [
      "Test the updated link in browser to confirm target page loads successfully.",
    ],
  },

  H3: {
    whyItMatters: "Missing core standard pages (About, Pricing, Contact, FAQ) makes a website appear unfinished or untrustworthy to prospective customers.",
    desiredOutcome: "Core expected pages for the site's category are created and accessible via main navigation.",
    agentTasks: ({ evidenceStr }) => [
      `Review the core pages flagged as missing (${evidenceStr || "core pages"}).`,
      `Create the necessary route or page component with appropriate introduction and content.`,
      `Add links in the header navigation or footer menu.`,
    ],
    constraints: [
      "Keep design consistent with existing layout templates.",
    ],
    acceptanceCriteria: [
      "Expected core pages resolve with HTTP 200 and standard layout.",
    ],
    testingSteps: [
      "Navigate to each core route from the menu to verify layout and content.",
    ],
  },

  H4: {
    whyItMatters: "Slow mobile load times increase bounce rates and negatively impact Google's Core Web Vitals rankings.",
    desiredOutcome: "Optimized mobile page loading with modern image formats, lazy loading, and minimal render-blocking scripts.",
    agentTasks: () => [
      `Convert heavy images (PNG/JPEG) to WebP or AVIF format.`,
      `Add loading="lazy" and explicit width/height attributes to below-the-fold images.`,
      `Defer non-essential scripts using async or defer attributes.`,
    ],
    constraints: [
      "Do not lazy-load the above-the-fold hero image (Largest Contentful Paint element).",
    ],
    acceptanceCriteria: [
      "Lighthouse mobile performance score improves and image payload sizes are reduced.",
    ],
    testingSteps: [
      "Run a Lighthouse audit in Chrome DevTools mobile view to compare load time metrics.",
    ],
  },

  H5: {
    whyItMatters: "Broken image, font, or script assets cause visual glitches, console errors, and degrade brand perception.",
    desiredOutcome: "All referenced media assets, stylesheets, and font files load with HTTP 200.",
    agentTasks: ({ evidenceStr }) => [
      `Identify the failing asset URL (${evidenceStr || "missing assets"}).`,
      `Check if the file exists in the public/static directory.`,
      `Correct typos in asset paths or restore missing files.`,
    ],
    constraints: [
      "Preserve case-sensitivity in asset filenames (critical on Linux production servers).",
    ],
    acceptanceCriteria: [
      "DevTools Network tab shows zero 404 status codes for images, fonts, or scripts.",
    ],
    testingSteps: [
      "Hard-refresh the page (Ctrl+F5) and verify browser console has zero 404 errors.",
    ],
  },

  I1: {
    whyItMatters: "Unmonitored third-party scripts introduce supply-chain vulnerabilities, slow down page loads, and can leak user data.",
    desiredOutcome: "An accurate inventory of all loaded third-party scripts with confirmed business necessity.",
    agentTasks: ({ evidenceStr }) => [
      `Review all third-party external scripts loaded by the site (${evidenceStr || "external scripts"}).`,
      `Remove deprecated or unused analytics/tracking tags from the codebase.`,
      `Consolidate remaining scripts to load through modern async patterns.`,
    ],
    constraints: [
      "Verify with site owner before removing marketing tags currently in active use.",
    ],
    acceptanceCriteria: [
      "Only approved, actively required third-party scripts are embedded.",
    ],
    testingSteps: [
      "Inspect Network tab to verify only expected external domains are contacted.",
    ],
  },

  I2: {
    whyItMatters: "Transmitting unhashed emails, passwords, or personal data in URL query parameters or network payloads violates GDPR and exposes users to MITM surveillance.",
    desiredOutcome: "All sensitive data is submitted securely via POST payloads and never leaked in URLs or analytics events.",
    agentTasks: ({ evidenceStr }) => [
      `Search where the flagged data is transmitted (${evidenceStr || "sensitive parameters"}).`,
      `Ensure sensitive parameters (token, email, auth) are stripped from URLs and analytics event calls.`,
      `Use POST requests with encrypted bodies rather than GET queries for form submissions.`,
    ],
    constraints: [
      "Do not break authentication callback mechanisms; use secure cookies or session state instead of URL queries.",
    ],
    acceptanceCriteria: [
      "URLs and analytics pings contain no plain-text emails or tokens.",
    ],
    testingSteps: [
      "Inspect outgoing network requests during checkout/login to ensure query strings are clean.",
    ],
  },

  I3: {
    whyItMatters: "Loading scripts from external CDNs without Subresource Integrity (SRI) allows an attacker who compromises the CDN to execute malicious code on your site.",
    desiredOutcome: "All third-party scripts loaded from external CDNs include cryptographic integrity (SRI) attributes.",
    agentTasks: ({ evidenceStr }) => [
      `Find external script tags loaded from CDNs (${evidenceStr || "CDN scripts"}).`,
      `Generate SHA-384 cryptographic integrity hash for the script content.`,
      `Add integrity="sha384-..." and crossorigin="anonymous" to the <script> tag.`,
    ],
    constraints: [
      "Only apply SRI to static versioned CDN URLs, not dynamically generated scripts.",
    ],
    acceptanceCriteria: [
      "External script tags include valid integrity and crossorigin attributes.",
    ],
    testingSteps: [
      "Verify script loads and executes without browser console SRI hash mismatch errors.",
    ],
  },
};

/**
 * Extracts a concise human-readable location string from finding & evidence records.
 */
function resolveLocationString(
  finding: FindingRecord,
  evidenceList: EvidenceRecord[]
): { url?: string; selector?: string; summary: string } {
  const supporting = evidenceList.filter((e) =>
    finding.evidenceIds.includes(e.id)
  );

  const firstWithUrl = supporting.find((e) => Boolean(e.pageUrl));
  const firstWithLocator = supporting.find((e) => Boolean(e.sourceLocator));

  const url = firstWithUrl?.pageUrl;
  const selector = firstWithLocator?.sourceLocator;

  let summary = "";
  if (url && selector) {
    summary = `Page: ${url} (Selector: \`${selector}\`)`;
  } else if (url) {
    summary = `Page: ${url}`;
  } else if (selector) {
    summary = `Element / Selector: \`${selector}\``;
  } else {
    summary = "Global site template / repository components";
  }

  return { url, selector, summary };
}

/**
 * Formats evidence records into a clean, honest evidence summary.
 */
function formatEvidenceSummary(
  finding: FindingRecord,
  evidenceList: EvidenceRecord[]
): string {
  const supporting = evidenceList.filter((e) =>
    finding.evidenceIds.includes(e.id)
  );

  if (supporting.length === 0) {
    return finding.summary;
  }

  return supporting
    .map((e, idx) => {
      const parts: string[] = [];
      if (e.evidenceType) parts.push(`Type: ${e.evidenceType}`);
      if (e.pageUrl) parts.push(`URL: ${e.pageUrl}`);
      if (e.sourceLocator) parts.push(`Selector: ${e.sourceLocator}`);
      if (e.structuredValue && Object.keys(e.structuredValue).length > 0) {
        try {
          const valStr = JSON.stringify(e.structuredValue);
          parts.push(`Observed Details: ${valStr.slice(0, 200)}`);
        } catch {
          // ignore
        }
      }
      return `[Evidence ${idx + 1}] ${parts.join(" | ")}`;
    })
    .join("\n");
}

/**
 * Generates an individualized, 10-point AI Fixing Prompt for a single finding.
 * Suitable for copy-pasting directly into Cursor, Claude Code, Antigravity, or Copilot.
 */
export function generateFixingPrompt(
  finding: FindingRecord,
  evidenceList: EvidenceRecord[] = [],
  options: PromptGenerationOptions = {}
): string {
  const guidance = CHECK_GUIDANCE[finding.checkId] || {
    whyItMatters: "Resolving this issue improves user trust, accessibility, and reduces compliance risks before launch.",
    desiredOutcome: "The observed non-compliant behavior is corrected in the repository.",
    agentTasks: ({ evidenceStr, locationStr }) => [
      `Review the evidence locator (${locationStr || evidenceStr || "flagged elements"}).`,
      `Locate the corresponding component, route, or configuration file in the project.`,
      `Implement the necessary code or policy adjustment to resolve the finding.`,
    ],
    constraints: [
      "Preserve existing application styling, responsiveness, and functionality.",
      "Do not invent unverified business facts or policies.",
    ],
    acceptanceCriteria: [
      "The issue is resolved and the corresponding check passes upon rescan.",
    ],
    testingSteps: [
      "Inspect the updated component in the browser and verify zero regressions.",
    ],
  };

  const loc = resolveLocationString(finding, evidenceList);
  const evidenceStr = formatEvidenceSummary(finding, evidenceList);
  const tasks = guidance.agentTasks({
    targetUrl: options.targetUrl,
    evidenceStr: evidenceStr.replace(/\n/g, " "),
    locationStr: loc.summary,
  });

  const promptLines: string[] = [
    `# Fix Task: [${finding.checkId}] ${finding.title}`,
    ``,
    `Review and resolve the following issue identified during the website launch readiness scan${options.targetUrl ? ` on ${options.targetUrl}` : ""}:`,
    ``,
    `### 1. Issue Identified`,
    `${finding.title}`,
    `${finding.summary}`,
    ``,
    `### 2. Why It Matters`,
    `${guidance.whyItMatters}`,
    ``,
    `### 3. Exact Evidence Observed`,
    `${evidenceStr}`,
    ``,
    `### 4. Relevant Location`,
    `- ${loc.summary}`,
    `- Framework Note: ${options.framework ? `Project appears to use ${options.framework}. Tailor implementation to its conventions.` : "Framework was not detected from public scan. Use framework-neutral practices matching the repository structure."}`,
    ``,
    `### 5. Desired Outcome`,
    `${guidance.desiredOutcome}`,
    ``,
    `### 6. Step-by-Step Instructions for Coding Agent`,
    ...tasks.map((t, i) => `${i + 1}. ${t}`),
    ``,
    `### 7. Constraints to Prevent Regressions`,
    ...guidance.constraints.map((c) => `- ${c}`),
    `- Preserve existing layouts, branding, and user journeys.`,
    `- Do not fabricate unconfirmed legal terms, pricing models, or company contact details. Ask the founder if specific copy is needed.`,
    ``,
    `### 8. Acceptance Criteria`,
    ...guidance.acceptanceCriteria.map((a) => `- [ ] ${a}`),
    ``,
    `### 9. How to Test and Verify`,
    ...guidance.testingSteps.map((s, i) => `${i + 1}. ${s}`),
    ``,
    `### 10. Summary & Handoff`,
    `After completing the changes:`,
    `- Report the exact list of files created, modified, or removed.`,
    `- Note any prerequisites, business decisions, or legal text that still require human confirmation.`,
    `- Re-run the local build/lint to ensure zero syntax or build errors.`,
  ];

  if (guidance.humanReviewNote) {
    promptLines.push(``, `> **Note for Developer/Founder:** ${guidance.humanReviewNote}`);
  }

  return promptLines.join("\n");
}

/**
 * Generates a unified, combined AI Fixing Prompt covering all issues found in a scan.
 * Groups tasks logically so an agent can work through the fixes methodically in one session.
 */
export function generateCombinedFixingKit(
  findings: FindingRecord[],
  evidenceList: EvidenceRecord[] = [],
  options: PromptGenerationOptions = {}
): string {
  const issuesFound = findings.filter((f) => f.status === "issue_found");

  if (issuesFound.length === 0) {
    return `# AI Fixing Kit: Zero Issues Found\n\nNo blocking issues were identified during this scan. Your website appears ready for launch!`;
  }

  const lines: string[] = [
    `# AI Fixing Kit: Website Launch Readiness Plan`,
    `Website: ${options.targetUrl || "Target Website"}`,
    `Total Issues to Resolve: ${issuesFound.length}`,
    ``,
    `You are an expert full-stack engineer and site reliability specialist.`,
    `Your task is to review and systematically resolve the following ${issuesFound.length} issues identified during a launch readiness scan.`,
    ``,
    `## Instructions for Coding Agent:`,
    `1. Review all issues below before editing files.`,
    `2. Tackle issues in priority order (High/Critical security & legal blockers first, followed by accessibility and site quality).`,
    `3. Adhere to repository conventions (do not invent framework patterns or unconfirmed business policies).`,
    `4. Provide a final summary table listing: Check ID, Files Changed, Resolution Status, and Human Confirmation Required.`,
    ``,
    `---`,
    ``,
  ];

  issuesFound.forEach((finding, idx) => {
    const prompt = generateFixingPrompt(finding, evidenceList, options);
    lines.push(`## Issue #${idx + 1} of ${issuesFound.length}: [${finding.checkId}] ${finding.title}`);
    lines.push(``);
    lines.push(prompt);
    lines.push(``, `---`, ``);
  });

  lines.push(
    `## Final Verification Checklist`,
    `- [ ] All high-priority issues addressed without visual or build regressions.`,
    `- [ ] Build passes cleanly (\`npm run build\` or equivalent).`,
    `- [ ] No mock credentials or placeholder text committed to git.`,
    `- [ ] Summary of changes provided to project founder.`
  );

  return lines.join("\n");
}

import type { CheckDefinition } from "../framework/types";

// 1. Privacy
import { a1PrivacyPolicyCheck } from "./privacy/a1-privacy-policy";
import { a5PolicyRealityCheck } from "./privacy/a5-policy-reality";
import { a6FormConsentCheck } from "./privacy/a6-form-consent";
import { a10OptOutLinkCheck } from "./privacy/a10-opt-out-link";

// 2. Cookies & Consent
import { b1CookieBannerCheck } from "./cookies/b1-cookie-banner";
import { b2PreconsentTrackersCheck } from "./cookies/b2-preconsent-trackers";
import { b3RejectProminenceCheck } from "./cookies/b3-reject-prominence";
import { b4RejectBlocksTrackersCheck } from "./cookies/b4-reject-blocks-trackers";
import { b5CookiePolicyCoverageCheck } from "./cookies/b5-cookie-policy-coverage";
import { b6InvasiveTrackingCheck } from "./cookies/b6-invasive-tracking";
import { b7IpLeakResourcesCheck } from "./cookies/b7-ip-leak-resources";

// 3. Accessibility
import { c1ImageAltCheck } from "./accessibility/c1-image-alt";
import { c2ColorContrastCheck } from "./accessibility/c2-color-contrast";
import { c4FormLabelsCheck } from "./accessibility/c4-form-labels";
import { c5HeadingLandmarksCheck } from "./accessibility/c5-heading-landmarks";
import { c6PageLanguageCheck } from "./accessibility/c6-page-language";
import { c7AccessibleNamesCheck } from "./accessibility/c7-accessible-names";
import { c9MediaCaptionsCheck } from "./accessibility/c9-media-captions";
import { c10TouchTargetsCheck } from "./accessibility/c10-touch-targets";

// 4. Security
import { d1ExposedSecretsCheck } from "./security/d1-exposed-secrets";
import { d5HttpsTlsCheck } from "./security/d5-https-tls";
import { d6SecurityHeadersCheck } from "./security/d6-security-headers";
import { d7CookieFlagsCheck } from "./security/d7-cookie-flags";
import { d9SourceMapsCheck } from "./security/d9-source-maps";
import { d12FrontendSensitiveDataCheck } from "./security/d12-frontend-sensitive-data";

// 5. Legal
import { e1TermsConditionsCheck } from "./legal/e1-terms-conditions";
import { e2RefundShippingPolicyCheck } from "./legal/e2-refund-shipping-policy";
import { e4ContactChannelCheck } from "./legal/e4-contact-channel";
import { e5PlaceholderTextCheck } from "./legal/e5-placeholder-text";

// 6. Consumer
import { f7PaymentGatewaySignalsCheck } from "./consumer/f7-payment-gateway-signals";

// 7. IP & Brand
import { g6FontIconLicencesCheck } from "./ip/g6-font-icon-licences";
import { g9EmbeddedMediaCheck } from "./ip/g9-embedded-media";

// 8. Quality & Operational
import { h1BrokenLinksCheck } from "./quality/h1-broken-links";
import { h3CorePagePresenceCheck } from "./quality/h3-core-page-presence";
import { h4MobilePerformanceCheck } from "./quality/h4-mobile-performance";
import { h5BrokenAssetsCheck } from "./quality/h5-broken-assets";
import { h7NavigationInteractionsCheck } from "./quality/h7-navigation-interactions";

// 9. Third Party
import { i1ScriptInventoryCheck } from "./thirdparty/i1-script-inventory";
import { i2PayloadLeakSignalsCheck } from "./thirdparty/i2-payload-leak-signals";
import { i3ScriptIntegrityCheck } from "./thirdparty/i3-script-integrity";

export const WAVE_1_CHECKS: CheckDefinition[] = [
  // Privacy
  a1PrivacyPolicyCheck,
  a5PolicyRealityCheck,
  a6FormConsentCheck,
  a10OptOutLinkCheck,

  // Cookies & Consent
  b1CookieBannerCheck,
  b2PreconsentTrackersCheck,
  b3RejectProminenceCheck,
  b4RejectBlocksTrackersCheck,
  b5CookiePolicyCoverageCheck,
  b6InvasiveTrackingCheck,
  b7IpLeakResourcesCheck,

  // Accessibility
  c1ImageAltCheck,
  c2ColorContrastCheck,
  c4FormLabelsCheck,
  c5HeadingLandmarksCheck,
  c6PageLanguageCheck,
  c7AccessibleNamesCheck,
  c9MediaCaptionsCheck,
  c10TouchTargetsCheck,

  // Security
  d1ExposedSecretsCheck,
  d5HttpsTlsCheck,
  d6SecurityHeadersCheck,
  d7CookieFlagsCheck,
  d9SourceMapsCheck,
  d12FrontendSensitiveDataCheck,

  // Legal
  e1TermsConditionsCheck,
  e2RefundShippingPolicyCheck,
  e4ContactChannelCheck,
  e5PlaceholderTextCheck,

  // Consumer
  f7PaymentGatewaySignalsCheck,

  // IP & Brand
  g6FontIconLicencesCheck,
  g9EmbeddedMediaCheck,

  // Quality & Operational
  h1BrokenLinksCheck,
  h3CorePagePresenceCheck,
  h4MobilePerformanceCheck,
  h5BrokenAssetsCheck,
  h7NavigationInteractionsCheck,

  // Third Party
  i1ScriptInventoryCheck,
  i2PayloadLeakSignalsCheck,
  i3ScriptIntegrityCheck,
];

export {
  // Privacy
  a1PrivacyPolicyCheck,
  a5PolicyRealityCheck,
  a6FormConsentCheck,
  a10OptOutLinkCheck,

  // Cookies & Consent
  b1CookieBannerCheck,
  b2PreconsentTrackersCheck,
  b3RejectProminenceCheck,
  b4RejectBlocksTrackersCheck,
  b5CookiePolicyCoverageCheck,
  b6InvasiveTrackingCheck,
  b7IpLeakResourcesCheck,

  // Accessibility
  c1ImageAltCheck,
  c2ColorContrastCheck,
  c4FormLabelsCheck,
  c5HeadingLandmarksCheck,
  c6PageLanguageCheck,
  c7AccessibleNamesCheck,
  c9MediaCaptionsCheck,
  c10TouchTargetsCheck,

  // Security
  d1ExposedSecretsCheck,
  d5HttpsTlsCheck,
  d6SecurityHeadersCheck,
  d7CookieFlagsCheck,
  d9SourceMapsCheck,
  d12FrontendSensitiveDataCheck,

  // Legal
  e1TermsConditionsCheck,
  e2RefundShippingPolicyCheck,
  e4ContactChannelCheck,
  e5PlaceholderTextCheck,

  // Consumer
  f7PaymentGatewaySignalsCheck,

  // IP & Brand
  g6FontIconLicencesCheck,
  g9EmbeddedMediaCheck,

  // Quality & Operational
  h1BrokenLinksCheck,
  h3CorePagePresenceCheck,
  h4MobilePerformanceCheck,
  h5BrokenAssetsCheck,
  h7NavigationInteractionsCheck,

  // Third Party
  i1ScriptInventoryCheck,
  i2PayloadLeakSignalsCheck,
  i3ScriptIntegrityCheck,
};

import { randomUUID } from "node:crypto";
import type { Browser, BrowserContext, Page, Request, Response } from "playwright-core";
import { AxeBuilder } from "@axe-core/playwright";
import type {
  PageObservation,
  NetworkObservation,
  CookieObservation,
  AssetObservation,
  AxeViolation,
  HeaderObservation,
  NetworkResourceType,
  AssetType,
  PageType,
} from "@vibe/contracts";
import { validateTargetUrl } from "../url-guard";
import { getBrowser, closeBrowser } from "./browser-provider";
import {
  sanitizeUrl,
  sanitizeHeaders,
  hashSensitiveValue,
  isThirdPartyUrl,
} from "./browser-sanitizer";
import type {
  PageCaptureOptions,
  RawPageCapture,
  PageErrorObservation,
  ScreenshotData,
} from "./browser-types";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 VibeComplianceChecker/1.0 (+https://vibecompliance.com/bot; security-audit)";

// Known stock/watermarked image domains
const STOCK_IMAGE_DOMAINS = [
  "shutterstock.com",
  "gettyimages.com",
  "istockphoto.com",
  "adobe.stock.com",
  "stock.adobe.com",
  "depositphotos.com",
  "123rf.com",
  "dreamstime.com",
  "alamy.com",
];

/**
 * Maps Playwright resource types to NetworkResourceType contract.
 */
function mapResourceType(type: string): NetworkResourceType {
  switch (type) {
    case "document":
      return "document";
    case "stylesheet":
      return "stylesheet";
    case "image":
      return "image";
    case "media":
      return "media";
    case "font":
      return "font";
    case "script":
      return "script";
    case "texttrack":
      return "texttrack";
    case "xhr":
      return "xhr";
    case "fetch":
      return "fetch";
    case "eventsource":
      return "eventsource";
    case "websocket":
      return "websocket";
    case "manifest":
      return "manifest";
    default:
      return "other";
  }
}

/**
 * Captures a single web page using Playwright Chromium with strict safety controls,
 * route-level SSRF validation, sensitive data redaction, and asset inventory extraction.
 */
export async function capturePage(
  rawUrl: string,
  options: PageCaptureOptions = {},
  existingBrowser?: Browser
): Promise<RawPageCapture> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const warnings: string[] = [];
  const errors: PageErrorObservation[] = [];
  const capturedAt = new Date().toISOString();

  // 1. Initial URL Guard verification
  const initialGuard = await validateTargetUrl(rawUrl);
  if (!initialGuard.isSafe) {
    throw new Error(
      `URL Guard rejected navigation target "${rawUrl}": ${initialGuard.message || "Invalid or prohibited destination"}`
    );
  }

  const normalizedTargetUrl = initialGuard.normalized.normalized;
  const originUrl = initialGuard.normalized.origin;

  // 2. Manage browser lifecycle
  const ownsBrowser = !existingBrowser;
  const browser = existingBrowser ?? (await getBrowser());

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    context = await browser.newContext({
      userAgent: options.customUserAgent ?? DEFAULT_USER_AGENT,
      viewport: options.viewport ?? { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
      permissions: [], // Deny all permissions (geolocation, camera, microphone, notifications)
    });

    page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    // 3. Track network activity
    const networkRequests: NetworkObservation[] = [];
    const responseHeadersMap = new Map<string, HeaderObservation[]>();
    const assetObservations: AssetObservation[] = [];
    const requestStartTimes = new Map<string, number>();

    // Route interception: Enforce URL Guard on all sub-resource and redirected requests
    await context.route("**/*", async (route) => {
      const request = route.request();
      const requestUrl = request.url();

      // Allow harmless data: and blob: URLs
      if (requestUrl.startsWith("data:") || requestUrl.startsWith("blob:")) {
        await route.continue();
        return;
      }

      // Prohibit non-HTTP(S) protocols
      if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
        warnings.push(`Blocked unsupported protocol request: ${requestUrl}`);
        await route.abort("blockedbyclient");
        return;
      }

      // Check URL Guard on every outbound network request
      try {
        const guard = await validateTargetUrl(requestUrl, { maxRedirects: 2 });
        if (!guard.isSafe) {
          warnings.push(
            `SSRF Guard blocked outbound request to prohibited destination: ${requestUrl} (${guard.errorCode})`
          );
          await route.abort("blockedbyclient");
          return;
        }
      } catch (err) {
        warnings.push(`Error validating request URL ${requestUrl}: ${String(err)}`);
        await route.abort("blockedbyclient");
        return;
      }

      await route.continue();
    });

    // Record request start
    page.on("request", (req: Request) => {
      requestStartTimes.set(req.url(), Date.now());

      const rawHeaders = req.headers();
      const headersList: Array<{ name: string; value: string }> = Object.entries(
        rawHeaders
      ).map(([name, value]) => ({ name, value }));

      const isThirdParty = isThirdPartyUrl(req.url(), originUrl);
      const sanitizedUrl = sanitizeUrl(req.url());

      // Redact postData if present
      const rawPostData = req.postData();
      const postDataRedacted = rawPostData
        ? `[REDACTED_POST_BODY_BYTES_${Buffer.byteLength(rawPostData, "utf8")}]`
        : undefined;

      networkRequests.push({
        id: randomUUID(),
        url: sanitizedUrl,
        method: (req.method().toUpperCase() as any) || "GET",
        resourceType: mapResourceType(req.resourceType()),
        isThirdParty,
        requestHeaders: sanitizeHeaders(headersList),
        postDataRedacted,
        initiator: req.isNavigationRequest() ? "navigation" : "subresource",
        timestamp: new Date().toISOString(),
      });
    });

    // Record response completion
    page.on("response", (res: Response) => {
      const reqUrl = res.url();
      const startTime = requestStartTimes.get(reqUrl);
      const durationMs = startTime ? Date.now() - startTime : undefined;

      const rawHeaders = res.headers();
      const headersList: Array<{ name: string; value: string }> = Object.entries(
        rawHeaders
      ).map(([name, value]) => ({ name, value }));
      const sanitizedHeaders = sanitizeHeaders(headersList);

      responseHeadersMap.set(reqUrl, sanitizedHeaders);

      // Find matching request in networkRequests and update status & timing
      const sanitizedUrl = sanitizeUrl(reqUrl);
      const matchingReq = networkRequests.find(
        (r) => r.url === sanitizedUrl && r.status === undefined
      );
      if (matchingReq) {
        matchingReq.status = res.status();
        matchingReq.responseHeaders = sanitizedHeaders;
        matchingReq.timingMs = durationMs;
      }

      // Record asset observation if it matches asset types
      const resourceType = res.request().resourceType();
      let assetType: AssetType | null = null;
      if (resourceType === "image") assetType = "image";
      else if (resourceType === "stylesheet") assetType = "stylesheet";
      else if (resourceType === "script") assetType = "script";
      else if (resourceType === "font") assetType = "font";

      if (assetType) {
        const isBroken = res.status() >= 400;
        const contentLength = res.headers()["content-length"];
        const sizeBytes = contentLength ? parseInt(contentLength, 10) : undefined;

        // Watermark detection heuristic on image URLs
        const lowerUrl = reqUrl.toLowerCase();
        const isWatermarkedSignal =
          assetType === "image" &&
          (STOCK_IMAGE_DOMAINS.some((d) => lowerUrl.includes(d)) ||
            lowerUrl.includes("watermark") ||
            lowerUrl.includes("preview-only") ||
            lowerUrl.includes("sample-watermark"));

        assetObservations.push({
          url: sanitizedUrl,
          assetType,
          httpStatus: res.status(),
          isBroken,
          sizeBytes: isNaN(sizeBytes as any) ? undefined : sizeBytes,
          hasSri: false, // will be augmented from DOM analysis
          isWatermarkedSignal,
        });
      }
    });

    // Error listeners
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push({
          type: "console_error",
          message: msg.text().slice(0, 1000), // bounded length
          location: msg.location() ? `${msg.location().url}:${msg.location().lineNumber}` : undefined,
          timestamp: new Date().toISOString(),
        });
      }
    });

    page.on("pageerror", (err) => {
      errors.push({
        type: "page_error",
        message: err.message.slice(0, 1000),
        timestamp: new Date().toISOString(),
      });
    });

    // 4. Navigate to URL
    const loadStartTime = Date.now();
    let response: Response | null = null;

    try {
      response = await page.goto(normalizedTargetUrl, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });

      // Brief settle delay to allow initial asynchronous DOM hydration
      await page.waitForTimeout(options.waitForNetworkIdle ? 1500 : 500);
    } catch (navError: any) {
      warnings.push(`Navigation warning: ${navError.message}`);
    }

    const loadDurationMs = Date.now() - loadStartTime;
    const finalUrl = page.url();
    const httpStatus = response?.status() ?? 200;

    // 5. Extract DOM facts & metadata
    const title = (await page.title()) || "";

    const domFacts = await page.evaluate(() => {
      // Helper to query meta tag
      const getMeta = (selector: string) => {
        const el = document.querySelector(selector);
        return el ? el.getAttribute("content") || "" : "";
      };

      const metaDescription =
        getMeta('meta[name="description"]') ||
        getMeta('meta[property="og:description"]');
      const canonical =
        document.querySelector('link[rel="canonical"]')?.getAttribute("href") ||
        "";
      const language =
        document.documentElement.getAttribute("lang") ||
        document.querySelector('meta[http-equiv="content-language"]')?.getAttribute("content") ||
        "";
      const viewport = getMeta('meta[name="viewport"]');
      const charset =
        document.characterSet ||
        document.querySelector("meta[charset]")?.getAttribute("charset") ||
        "";

      // Passive inspection of forms (NO SUBMISSIONS EVER)
      const formElements = Array.from(document.querySelectorAll("form"));
      const formsData = formElements.map((form) => {
        const inputs = Array.from(
          form.querySelectorAll("input, select, textarea")
        ).map((input) => ({
          name: input.getAttribute("name") || undefined,
          type: (input.getAttribute("type") || input.tagName.toLowerCase()).toLowerCase(),
          required: input.hasAttribute("required"),
          autocomplete: input.getAttribute("autocomplete") || undefined,
        }));

        const inputTypes = inputs.map((i) => i.type);
        const hasPasswordField = inputTypes.includes("password");

        // Payment fields detection (credit cards, CVV, payment provider tokens)
        const formHtml = (form.innerHTML || "").toLowerCase();
        const hasPaymentFields =
          formHtml.includes("card-number") ||
          formHtml.includes("cardnumber") ||
          formHtml.includes("cc-number") ||
          formHtml.includes("cvv") ||
          formHtml.includes("cvc") ||
          formHtml.includes("stripe") ||
          formHtml.includes("razorpay") ||
          inputs.some((i) => (i.autocomplete || "").includes("cc-"));

        // Email field detection
        const hasEmailField =
          inputTypes.includes("email") ||
          inputs.some((i) => (i.name || "").toLowerCase().includes("email"));

        // Consent checkbox detection (terms, privacy, consent)
        const checkboxes = inputs.filter((i) => i.type === "checkbox");
        const hasConsentCheckbox =
          checkboxes.length > 0 &&
          (formHtml.includes("terms") ||
            formHtml.includes("privacy") ||
            formHtml.includes("policy") ||
            formHtml.includes("agree") ||
            formHtml.includes("consent"));

        return {
          id: form.getAttribute("id") || undefined,
          name: form.getAttribute("name") || undefined,
          action: form.getAttribute("action") || undefined,
          method: (form.getAttribute("method") || "GET").toUpperCase(),
          inputs,
          hasPasswordField,
          hasPaymentFields,
          hasEmailField,
          hasConsentCheckbox,
        };
      });

      // Scripts inventory
      const scripts = Array.from(document.querySelectorAll("script")).map((s) => ({
        src: s.getAttribute("src") || "",
        integrity: s.getAttribute("integrity") || "",
        async: s.hasAttribute("async"),
        defer: s.hasAttribute("defer"),
        type: s.getAttribute("type") || "text/javascript",
        isInline: !s.hasAttribute("src"),
      }));

      // Stylesheets inventory
      const stylesheets = Array.from(
        document.querySelectorAll('link[rel="stylesheet"]')
      ).map((l) => ({
        href: l.getAttribute("href") || "",
        media: l.getAttribute("media") || "all",
      }));

      // Images inventory
      const images = Array.from(document.querySelectorAll("img")).map((img) => ({
        src: img.getAttribute("src") || "",
        alt: img.getAttribute("alt") || "",
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
      }));

      return {
        metaDescription,
        canonical,
        language,
        viewport,
        charset,
        formsData,
        scripts,
        stylesheets,
        images,
      };
    });

    // Augment script asset observations with SRI flags from DOM
    for (const script of domFacts.scripts) {
      if (script.src) {
        const fullUrl = new URL(script.src, finalUrl).toString();
        const sanitizedScriptUrl = sanitizeUrl(fullUrl);
        const existingAsset = assetObservations.find(
          (a) => a.url === sanitizedScriptUrl && a.assetType === "script"
        );
        if (existingAsset) {
          existingAsset.hasSri = Boolean(script.integrity);
          existingAsset.sriHash = script.integrity || undefined;
        } else {
          assetObservations.push({
            url: sanitizedScriptUrl,
            assetType: "script",
            httpStatus: 200,
            isBroken: false,
            hasSri: Boolean(script.integrity),
            sriHash: script.integrity || undefined,
            isWatermarkedSignal: false,
          });
        }
      }
    }

    // 6. Cookies observation
    const rawCookies = await context.cookies();
    const scenario = options.scenario ?? "pre_consent";
    const cookies: CookieObservation[] = rawCookies.map((c) => {
      let sameSite: "Strict" | "Lax" | "None" | undefined = undefined;
      if (c.sameSite === "Strict" || c.sameSite === "Lax" || c.sameSite === "None") {
        sameSite = c.sameSite;
      }

      const cookieDomain = c.domain.startsWith(".") ? c.domain.slice(1) : c.domain;
      const isThirdParty = isThirdPartyUrl(`https://${cookieDomain}`, originUrl);

      return {
        name: c.name,
        domain: c.domain,
        path: c.path,
        expires: c.expires > 0 ? c.expires : undefined,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite,
        isThirdParty,
        observedScenario: scenario,
        redactedValueHash: hashSensitiveValue(c.value),
      };
    });

    // 7. Accessibility Scan (Axe Core)
    const accessibilityViolations: AxeViolation[] = [];
    if (options.runAccessibilityScan !== false) {
      try {
        const axeResults = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        for (const v of axeResults.violations) {
          accessibilityViolations.push({
            id: v.id,
            impact: (v.impact as any) || "moderate",
            description: v.description,
            helpUrl: v.helpUrl,
            nodesCount: v.nodes.length,
            selectorSample: v.nodes[0]?.target?.join(" ") || undefined,
          });
        }
      } catch (axeError: any) {
        warnings.push(`Axe accessibility scan warning: ${axeError.message}`);
      }
    }

    // 8. Screenshot Capture
    let screenshot: ScreenshotData | undefined = undefined;
    if (options.takeScreenshot !== false) {
      try {
        const buffer = await page.screenshot({
          type: "jpeg",
          quality: 70,
          fullPage: false, // Viewport screenshot for performance & storage limits
        });
        screenshot = {
          base64: buffer.toString("base64"),
          mimeType: "image/jpeg",
          sizeBytes: buffer.length,
        };
      } catch (ssError: any) {
        warnings.push(`Screenshot capture warning: ${ssError.message}`);
      }
    }

    // 9. Bounded HTML content
    let htmlContent = "";
    try {
      htmlContent = await page.content();
      const MAX_HTML_SIZE = 5 * 1024 * 1024; // 5 MB max
      if (htmlContent.length > MAX_HTML_SIZE) {
        htmlContent = htmlContent.slice(0, MAX_HTML_SIZE);
        warnings.push("HTML content exceeded 5MB and was truncated.");
      }
    } catch (htmlError: any) {
      warnings.push(`HTML extraction warning: ${htmlError.message}`);
    }

    // Derive form indicators
    const hasLoginForm = domFacts.formsData.some((f) => f.hasPasswordField);
    const hasPaymentForm = domFacts.formsData.some((f) => f.hasPaymentFields);
    const hasContactForm = domFacts.formsData.some(
      (f) => f.hasEmailField && !f.hasPasswordField && !f.hasPaymentFields
    );

    const pageType: PageType = options.pageType ?? "home";

    const pageObservation: PageObservation = {
      url: normalizedTargetUrl,
      finalUrl: sanitizeUrl(finalUrl),
      httpStatus,
      pageType,
      title: title || undefined,
      metaDescription: domFacts.metaDescription || undefined,
      language: domFacts.language || undefined,
      viewport: domFacts.viewport || undefined,
      hasLoginForm,
      hasPaymentForm,
      hasContactForm,
      discoveredFromUrl: options.discoveredFromUrl,
      loadDurationMs,
      domFacts: {
        canonical: domFacts.canonical || undefined,
        charset: domFacts.charset || undefined,
        scriptCount: domFacts.scripts.length,
        stylesheetCount: domFacts.stylesheets.length,
        imageCount: domFacts.images.length,
        formsCount: domFacts.formsData.length,
      },
      capturedAt,
    };

    const finalResponseHeaders =
      responseHeadersMap.get(normalizedTargetUrl) ||
      responseHeadersMap.get(finalUrl) ||
      [];

    return {
      url: normalizedTargetUrl,
      finalUrl: sanitizeUrl(finalUrl),
      httpStatus,
      pageType,
      pageObservation,
      htmlContent,
      networkRequests,
      responseHeaders: finalResponseHeaders,
      cookies,
      assets: assetObservations,
      forms: domFacts.formsData,
      accessibilityViolations,
      errors,
      screenshot,
      warnings,
      capturedAt,
    };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    if (ownsBrowser && browser) {
      await closeBrowser(browser);
    }
  }
}

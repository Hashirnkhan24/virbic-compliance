import { randomUUID } from "node:crypto";
import type { Browser, BrowserContext, Page, Request } from "playwright-core";
import { getDomain } from "tldts";
import type {
  ConsentRun,
  CookieObservation,
  StorageItem,
  NetworkObservation,
  NetworkResourceType,
} from "@vibe/contracts";
import { validateTargetUrl } from "../url-guard";
import { getBrowser, closeBrowser } from "../browser/browser-provider";
import {
  sanitizeUrl,
  sanitizeHeaders,
  hashSensitiveValue,
  isThirdPartyUrl,
} from "../browser/browser-sanitizer";
import { isTrackerUrl } from "./tracker-catalog";
import { detectConsentBanner } from "./banner-detector";
import type {
  ConsentScenario,
  ConsentTestingOptions,
  ConsentTestingResult,
} from "./consent-types";

const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_SETTLE_MS = 1_500;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 VibeComplianceChecker/1.0 (+https://vibecompliance.com/bot; consent-audit)";

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
 * Runs an isolated consent testing session in its own browser context.
 * Strictly guarantees zero cookie/storage contamination across runs.
 */
export async function runConsentSession(
  rawUrl: string,
  scenario: ConsentScenario,
  options: ConsentTestingOptions = {},
  existingBrowser?: Browser
): Promise<ConsentRun> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const settleDelayMs = options.settleDelayMs ?? DEFAULT_SETTLE_MS;
  const warnings: string[] = [];
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  // 1. Initial URL Guard check
  const initialGuard = await validateTargetUrl(rawUrl, options.urlGuardConfig);
  if (!initialGuard.isSafe) {
    throw new Error(
      `URL Guard rejected navigation destination "${rawUrl}": ${initialGuard.message}`
    );
  }

  const targetUrl = initialGuard.normalized.normalized;
  const originUrl = initialGuard.normalized.origin;

  // 2. Manage Browser lifecycle
  const ownsBrowser = !existingBrowser;
  const browser = existingBrowser ?? (await getBrowser());

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Isolated context: NO shared cookies, storage, or permissions
    context = await browser.newContext({
      userAgent: options.customUserAgent ?? DEFAULT_USER_AGENT,
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
      permissions: [],
    });

    page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    // Track network requests and third-party contacts
    const networkRequests: NetworkObservation[] = [];
    const trackersFiredSet = new Set<string>();
    const thirdPartyDomainsSet = new Set<string>();

    // Route-level SSRF interception
    await context.route("**/*", async (route) => {
      const req = route.request();
      const reqUrl = req.url();

      if (reqUrl.startsWith("data:") || reqUrl.startsWith("blob:")) {
        await route.continue();
        return;
      }

      if (!reqUrl.startsWith("http://") && !reqUrl.startsWith("https://")) {
        await route.abort("blockedbyclient");
        return;
      }

      try {
        const guard = await validateTargetUrl(reqUrl, {
          maxRedirects: 2,
          ...options.urlGuardConfig,
        });
        if (!guard.isSafe) {
          warnings.push(`SSRF Guard blocked request to ${reqUrl}`);
          await route.abort("blockedbyclient");
          return;
        }
      } catch {
        await route.abort("blockedbyclient");
        return;
      }

      await route.continue();
    });

    // Record requests & trackers
    page.on("request", (req: Request) => {
      const reqUrl = req.url();
      const isThirdParty = isThirdPartyUrl(reqUrl, originUrl);

      if (isThirdParty) {
        try {
          const domain = getDomain(new URL(reqUrl).hostname);
          if (domain) thirdPartyDomainsSet.add(domain);
        } catch {}
      }

      if (isTrackerUrl(reqUrl)) {
        trackersFiredSet.add(sanitizeUrl(reqUrl));
      }

      const rawHeaders = req.headers();
      const headersList: Array<{ name: string; value: string }> = Object.entries(
        rawHeaders
      ).map(([name, value]) => ({ name, value }));

      networkRequests.push({
        id: randomUUID(),
        url: sanitizeUrl(reqUrl),
        method: (req.method().toUpperCase() as any) || "GET",
        resourceType: mapResourceType(req.resourceType()),
        isThirdParty,
        requestHeaders: sanitizeHeaders(headersList),
        initiator: req.isNavigationRequest() ? "navigation" : "subresource",
        timestamp: new Date().toISOString(),
      });
    });

    // 3. Navigate to target URL
    try {
      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });

      // Settle delay to let consent banners mount asynchronously
      await page.waitForTimeout(settleDelayMs);
    } catch (err: any) {
      warnings.push(`Navigation note: ${err.message}`);
    }

    // 4. Capture state before interaction
    const cookiesBeforeRaw = await context.cookies();
    const observedScenario =
      scenario === "no_choice"
        ? "pre_consent"
        : scenario === "accept"
        ? "post_accept"
        : "post_reject";

    const cookiesBefore: CookieObservation[] = cookiesBeforeRaw.map((c) => ({
      name: c.name,
      domain: c.domain,
      path: c.path,
      expires: c.expires > 0 ? c.expires : undefined,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite:
        c.sameSite === "Strict" || c.sameSite === "Lax" || c.sameSite === "None"
          ? c.sameSite
          : undefined,
      isThirdParty: isThirdPartyUrl(`https://${c.domain.replace(/^\./, "")}`, originUrl),
      observedScenario,
      redactedValueHash: hashSensitiveValue(c.value),
    }));

    // 5. Detect Consent Banner
    const bannerObservation = await detectConsentBanner(page);
    let bannerActionTaken: string | undefined = undefined;
    let status: "completed" | "unable_to_verify" | "no_banner_found" = "completed";

    // 6. Execute Scenario Interaction
    if (scenario === "no_choice") {
      // Passive run: strictly NO clicks
      bannerActionTaken = "none_passive_observation";
      status = bannerObservation.detected ? "completed" : "no_banner_found";
      // Additional short wait to capture pre-consent leaks
      await page.waitForTimeout(1000);
    } else if (scenario === "accept") {
      if (!bannerObservation.detected) {
        status = "no_banner_found";
        bannerActionTaken = "none_no_banner";
      } else {
        const acceptBtn = bannerObservation.availableButtons.find(
          (b) => b.type === "accept"
        );
        if (acceptBtn) {
          let clicked = false;
          if (acceptBtn.selector) {
            try {
              await page.click(acceptBtn.selector, { timeout: 3000 });
              clicked = true;
            } catch {}
          }
          if (!clicked) {
            try {
              await page
                .locator(
                  `button:has-text("${acceptBtn.text}"), a:has-text("${acceptBtn.text}")`
                )
                .first()
                .click({ timeout: 3000 });
              clicked = true;
            } catch (err: any) {
              warnings.push(`Failed clicking accept button: ${err.message}`);
            }
          }

          if (clicked) {
            bannerActionTaken = `clicked_accept: ${acceptBtn.text}`;
            status = "completed";
            await page.waitForTimeout(settleDelayMs);
          } else {
            status = "unable_to_verify";
            bannerActionTaken = "failed_clicking_accept_button";
          }
        } else {
          status = "unable_to_verify";
          bannerActionTaken = "accept_button_not_found";
          warnings.push("Banner detected, but no accept button was identified.");
        }
      }
    } else if (scenario === "reject") {
      if (!bannerObservation.detected) {
        status = "no_banner_found";
        bannerActionTaken = "none_no_banner";
      } else {
        const rejectBtn = bannerObservation.availableButtons.find(
          (b) => b.type === "reject"
        );

        if (rejectBtn) {
          // Direct reject button present
          let clicked = false;
          if (rejectBtn.selector) {
            try {
              await page.click(rejectBtn.selector, { timeout: 3000 });
              clicked = true;
            } catch {}
          }
          if (!clicked) {
            try {
              await page
                .locator(
                  `button:has-text("${rejectBtn.text}"), a:has-text("${rejectBtn.text}")`
                )
                .first()
                .click({ timeout: 3000 });
              clicked = true;
            } catch (err: any) {
              warnings.push(`Failed clicking reject button: ${err.message}`);
            }
          }

          if (clicked) {
            bannerActionTaken = `clicked_reject: ${rejectBtn.text}`;
            status = "completed";
            await page.waitForTimeout(settleDelayMs);
          } else {
            status = "unable_to_verify";
            bannerActionTaken = "failed_clicking_reject_button";
          }
        } else {
          // Check if reject is buried behind preferences/settings
          const prefBtn = bannerObservation.availableButtons.find(
            (b) => b.type === "preferences"
          );

          if (prefBtn) {
            let prefClicked = false;
            try {
              if (prefBtn.selector) {
                await page.click(prefBtn.selector, { timeout: 3000 });
                prefClicked = true;
              } else {
                await page
                  .locator(`button:has-text("${prefBtn.text}"), a:has-text("${prefBtn.text}")`)
                  .first()
                  .click({ timeout: 3000 });
                prefClicked = true;
              }
            } catch {}

            if (prefClicked) {
              await page.waitForTimeout(800);

              // Look for save/confirm/reject inside preferences modal
              const saveClicked = await page.evaluate(() => {
                const buttons = Array.from(
                  document.querySelectorAll("button, a[role='button'], input[type='submit']")
                ) as HTMLElement[];

                for (const btn of buttons) {
                  const t = (btn.innerText || btn.getAttribute("aria-label") || "").toLowerCase();
                  if (
                    t.includes("save") ||
                    t.includes("confirm") ||
                    t.includes("reject all") ||
                    t.includes("only essential")
                  ) {
                    btn.click();
                    return true;
                  }
                }
                return false;
              });

              if (saveClicked) {
                bannerActionTaken = `rejected_via_preferences: ${prefBtn.text}`;
                status = "completed";
                await page.waitForTimeout(settleDelayMs);
              } else {
                status = "unable_to_verify";
                bannerActionTaken = "preferences_opened_but_save_not_found";
                warnings.push("Opened preferences, but could not locate confirm/save button.");
              }
            } else {
              status = "unable_to_verify";
              bannerActionTaken = "failed_opening_preferences";
            }
          } else {
            // No direct reject and no preferences button
            status = "unable_to_verify";
            bannerActionTaken = "reject_control_not_found";
            warnings.push("Banner detected, but no reject or preferences control was found.");
          }
        }
      }
    }

    // 7. Capture state after interaction
    const cookiesAfterRaw = await context.cookies();
    const cookiesAfter: CookieObservation[] = cookiesAfterRaw.map((c) => ({
      name: c.name,
      domain: c.domain,
      path: c.path,
      expires: c.expires > 0 ? c.expires : undefined,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite:
        c.sameSite === "Strict" || c.sameSite === "Lax" || c.sameSite === "None"
          ? c.sameSite
          : undefined,
      isThirdParty: isThirdPartyUrl(`https://${c.domain.replace(/^\./, "")}`, originUrl),
      observedScenario,
      redactedValueHash: hashSensitiveValue(c.value),
    }));

    // Calculate cookiesSet = cookiesAfter that are newly added or altered
    const cookiesBeforeMap = new Map(
      cookiesBefore.map((c) => [`${c.domain}_${c.name}`, c.redactedValueHash])
    );
    const cookiesSet: CookieObservation[] = cookiesAfter.filter((c) => {
      const key = `${c.domain}_${c.name}`;
      const prevHash = cookiesBeforeMap.get(key);
      return prevHash === undefined || prevHash !== c.redactedValueHash;
    });

    // Capture LocalStorage and SessionStorage items
    const rawStorage = await page.evaluate(() => {
      const local: Array<{ key: string; value: string }> = [];
      const session: Array<{ key: string; value: string }> = [];

      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) local.push({ key: k, value: localStorage.getItem(k) || "" });
        }
      } catch {}

      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k) session.push({ key: k, value: sessionStorage.getItem(k) || "" });
        }
      } catch {}

      return { local, session };
    });

    const storageItems: StorageItem[] = [
      ...rawStorage.local.map((item) => ({
        key: item.key,
        redactedValueHash: hashSensitiveValue(item.value),
        storageType: "localStorage" as const,
      })),
      ...rawStorage.session.map((item) => ({
        key: item.key,
        redactedValueHash: hashSensitiveValue(item.value),
        storageType: "sessionStorage" as const,
      })),
    ];

    // Capture screenshot if requested
    let screenshotBase64: string | undefined = undefined;
    if (options.takeScreenshots !== false) {
      try {
        const buf = await page.screenshot({ type: "jpeg", quality: 60 });
        screenshotBase64 = buf.toString("base64");
      } catch {}
    }

    const completedAt = new Date().toISOString();
    const executionDurationMs = Date.now() - startTime;

    return {
      scenario,
      status,
      bannerDetected: bannerObservation.detected,
      bannerText: bannerObservation.bannerText,
      availableButtons: bannerObservation.availableButtons,
      bannerActionTaken,
      cookiesBefore,
      cookiesAfter,
      cookiesSet,
      storageItems,
      networkRequests,
      trackersFired: Array.from(trackersFiredSet),
      thirdPartyDomainsContacted: Array.from(thirdPartyDomainsSet),
      screenshotBase64,
      startedAt,
      completedAt,
      warnings,
      executionDurationMs,
    };
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (ownsBrowser && browser) await closeBrowser(browser);
  }
}

/**
 * Executes all three consent testing sessions in strict isolation.
 * Guarantees zero cross-contamination of cookies or storage across sessions.
 */
export async function runAllConsentSessions(
  rawUrl: string,
  options: ConsentTestingOptions = {}
): Promise<ConsentTestingResult> {
  const startTime = Date.now();
  const testedAt = new Date().toISOString();
  const warnings: string[] = [];

  // Launch shared browser for orchestrating the 3 independent contexts
  const browser = await getBrowser();

  try {
    // 1. Session 1: No Choice (Passive run)
    const noChoice = await runConsentSession(
      rawUrl,
      "no_choice",
      options,
      browser
    );

    // 2. Session 2: Accept (Accept all cookies)
    const accept = await runConsentSession(
      rawUrl,
      "accept",
      options,
      browser
    );

    // 3. Session 3: Reject (Reject non-essential cookies)
    const reject = await runConsentSession(
      rawUrl,
      "reject",
      options,
      browser
    );

    const bannerDetected =
      noChoice.bannerDetected || accept.bannerDetected || reject.bannerDetected;
    const bannerText =
      noChoice.bannerText || accept.bannerText || reject.bannerText;
    const availableButtons =
      noChoice.availableButtons.length > 0
        ? noChoice.availableButtons
        : accept.availableButtons;

    return {
      targetUrl: rawUrl,
      bannerDetected,
      bannerText,
      availableButtons,
      noChoice,
      accept,
      reject,
      testedAt,
      executionDurationMs: Date.now() - startTime,
      warnings: [
        ...warnings,
        ...noChoice.warnings,
        ...accept.warnings,
        ...reject.warnings,
      ],
    };
  } finally {
    await closeBrowser(browser);
  }
}

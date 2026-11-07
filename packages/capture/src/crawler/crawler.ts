import * as cheerio from "cheerio";
import { PageType, PageObservation, AssetObservation } from "@vibe/contracts";
import { validateTargetUrl, UrlGuardConfig } from "../url-guard";
import http from "http";
import https from "https";

export interface DiscoveredLink {
  url: string;
  normalizedUrl: string;
  isExternal: boolean;
  linkText?: string;
  sourceUrl: string;
}

export interface CrawlResult {
  origin: string;
  targetHost: string;
  pages: PageObservation[];
  importantPages: Partial<Record<PageType, string>>; // Maps pageType to discovered URL
  externalLinks: DiscoveredLink[];
  assets: AssetObservation[];
  sitemapFound: boolean;
  sitemapUrlsCount: number;
  robotsTxtFound: boolean;
  robotsDisallowedPaths: string[];
  warnings: string[];
}

export interface CrawlerConfig {
  maxPages?: number; // default: 15 (per blueprint: 12-15)
  maxResponseSizeBytes?: number; // default: 2MB per HTML document
  timeoutMs?: number; // default: 6000ms per page request
  urlGuardConfig?: UrlGuardConfig;
  customFetcher?: (url: string) => Promise<{ status: number; body: string; headers: Record<string, string> }>;
}

const DEFAULT_MAX_PAGES = 15;
const DEFAULT_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const DEFAULT_TIMEOUT_MS = 6000;

/**
 * Classifies a URL path, slug, and anchor text into an important page type.
 */
export function classifyPageType(urlStr: string, textOrTitle?: string): PageType {
  const combined = `${urlStr.toLowerCase()} ${textOrTitle ? textOrTitle.toLowerCase() : ""}`;

  if (/cookie/i.test(combined)) return "cookies";
  if (/(privacy|data-protection|datenschutz)/i.test(combined)) return "privacy";
  if (/(terms|tos|conditions|agb|user-agreement)/i.test(combined)) return "terms";
  if (/(refund|cancellation|returns|money-back)/i.test(combined)) return "refund";
  if (/(shipping|delivery|dispatch)/i.test(combined)) return "shipping";
  if (/(contact|support|get-in-touch|reach-us)/i.test(combined)) return "contact";
  if (/(about|about-us|company|team|story)/i.test(combined)) return "about";
  if (/(pricing|plans|subscription|tier)/i.test(combined)) return "pricing";
  if (/(login|signin|sign-in|log-in)/i.test(combined)) return "login";
  if (/(signup|register|sign-up|join|create-account)/i.test(combined)) return "signup";
  if (/(checkout|cart|basket|order|pay)/i.test(combined)) return "checkout";

  try {
    const parsed = new URL(urlStr);
    if (parsed.pathname === "" || parsed.pathname === "/") {
      return "home";
    }
  } catch {
    // ignore
  }

  return "general";
}

/**
 * Prioritizes discovered links so that important pages (privacy, terms, refund, contact)
 * are crawled first within the 12-15 page limit.
 */
function getLinkPriority(pageType: PageType): number {
  switch (pageType) {
    case "home":
      return 100;
    case "privacy":
      return 95;
    case "terms":
      return 90;
    case "cookies":
      return 85;
    case "refund":
      return 80;
    case "contact":
      return 75;
    case "about":
      return 72;
    case "pricing":
      return 70;
    case "shipping":
      return 68;
    case "checkout":
      return 65;
    case "login":
      return 60;
    case "signup":
      return 55;
    default:
      return 10;
  }
}

/**
 * Parses robots.txt content to extract Disallowed paths and sitemap pointers.
 */
export function parseRobotsTxt(content: string): {
  disallowedPaths: string[];
  sitemaps: string[];
} {
  const disallowedPaths: string[] = [];
  const sitemaps: string[] = [];

  const lines = content.split(/\r?\n/);
  let isRelevantAgent = true;

  for (const line of lines) {
    const clean = line.split("#")[0]?.trim();
    if (!clean) continue;

    const [key, ...valParts] = clean.split(":");
    const directive = key?.trim().toLowerCase();
    const value = valParts.join(":").trim();

    if (directive === "user-agent") {
      isRelevantAgent = value === "*" || /vibe|compliance|crawler|bot/i.test(value);
    } else if (directive === "disallow" && isRelevantAgent && value) {
      disallowedPaths.push(value);
    } else if (directive === "sitemap" && value) {
      sitemaps.push(value);
    }
  }

  return { disallowedPaths, sitemaps };
}

/**
 * Parses sitemap.xml content to discover same-origin URLs.
 */
export function parseSitemapXml(xmlContent: string, canonicalOrigin: string): string[] {
  const discovered: string[] = [];
  // Quick regex extraction of <loc> tags without requiring heavy XML dependencies
  const locRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
  let match: RegExpExecArray | null;

  while ((match = locRegex.exec(xmlContent)) !== null) {
    const foundUrl = match[1]?.trim();
    if (foundUrl) {
      try {
        const parsed = new URL(foundUrl);
        if (parsed.origin.toLowerCase() === canonicalOrigin.toLowerCase()) {
          discovered.push(foundUrl);
        }
      } catch {
        // invalid URL format, ignore
      }
    }
  }

  return discovered;
}

/**
 * Fetches page content safely with URL Guard enforcement, size limits, and timeout.
 */
async function fetchSafePage(
  urlStr: string,
  config: CrawlerConfig
): Promise<{ status: number; body: string; headers: Record<string, string>; finalUrl: string }> {
  if (config.customFetcher) {
    const customRes = await config.customFetcher(urlStr);
    return { ...customRes, finalUrl: urlStr };
  }

  const guardResult = await validateTargetUrl(urlStr, config.urlGuardConfig);
  if (!guardResult.isSafe) {
    throw new Error(`URL Guard blocked target: ${guardResult.message} (${guardResult.errorCode})`);
  }

  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = config.maxResponseSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;

  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const transport = parsed.protocol === "https:" ? https : http;

    const req = transport.request(
      parsed,
      {
        method: "GET",
        headers: {
          "User-Agent": "VibeRiskScanner/1.0 (Compliance & Risk Auditor; +https://vibe-compliance.local/bot)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: timeoutMs,
      },
      (res) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (typeof v === "string") {
            headers[k.toLowerCase()] = v;
          }
        }

        let body = "";
        let receivedBytes = 0;

        res.setEncoding("utf8");

        res.on("data", (chunk: string) => {
          receivedBytes += Buffer.byteLength(chunk, "utf8");
          if (receivedBytes > maxBytes) {
            req.destroy(new Error(`Response size exceeded limit of ${maxBytes} bytes.`));
            return;
          }
          body += chunk;
        });

        res.on("end", () => {
          resolve({
            status: res.statusCode || 200,
            body,
            headers,
            finalUrl: urlStr,
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Fetch timed out after ${timeoutMs}ms for ${urlStr}`));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}

/**
 * Main Crawler & Page Discovery Engine:
 * - Bounded same-origin crawl (12-15 pages).
 * - Priority queue discovering key compliance pages (privacy, terms, refund, contact).
 * - Extracts assets, internal and external links.
 * - Extracts robots.txt and sitemap.xml.
 */
export async function crawlWebsite(
  startUrl: string,
  config: CrawlerConfig = {}
): Promise<CrawlResult> {
  const maxPages = config.maxPages ?? DEFAULT_MAX_PAGES;

  // 1. Initial Validation
  const initialGuard = await validateTargetUrl(startUrl, config.urlGuardConfig);
  if (!initialGuard.isSafe) {
    throw new Error(`Initial homepage blocked by URL Guard: ${initialGuard.message}`);
  }

  const canonicalOrigin = initialGuard.normalized.origin.toLowerCase();
  const targetHost = initialGuard.normalized.host.toLowerCase();

  const pages: PageObservation[] = [];
  const importantPages: Partial<Record<PageType, string>> = {};
  const externalLinksMap = new Map<string, DiscoveredLink>();
  const assetsMap = new Map<string, AssetObservation>();
  const visitedUrls = new Set<string>();
  const warnings: string[] = [];

  // Priority queue for URLs to visit: { url, pageType, priority, sourceUrl }
  interface QueueItem {
    url: string;
    pageType: PageType;
    priority: number;
    sourceUrl?: string;
  }
  const queue: QueueItem[] = [
    {
      url: initialGuard.normalized.normalized,
      pageType: "home",
      priority: 100,
    },
  ];

  // 2. Discover and inspect robots.txt
  let robotsTxtFound = false;
  let robotsDisallowedPaths: string[] = [];
  try {
    const robotsUrl = `${canonicalOrigin}/robots.txt`;
    const robotsRes = await fetchSafePage(robotsUrl, config);
    if (robotsRes.status >= 200 && robotsRes.status < 300) {
      robotsTxtFound = true;
      const parsedRobots = parseRobotsTxt(robotsRes.body);
      robotsDisallowedPaths = parsedRobots.disallowedPaths;

      // Add discovered sitemaps to queue
      for (const smUrl of parsedRobots.sitemaps) {
        queue.push({
          url: smUrl,
          pageType: "general",
          priority: 50,
          sourceUrl: robotsUrl,
        });
      }
    }
  } catch (_e) {
    // Non-fatal if robots.txt is missing
  }

  // 3. Discover and inspect sitemap.xml
  let sitemapFound = false;
  let sitemapUrlsCount = 0;
  try {
    const sitemapUrl = `${canonicalOrigin}/sitemap.xml`;
    const sitemapRes = await fetchSafePage(sitemapUrl, config);
    if (sitemapRes.status >= 200 && sitemapRes.status < 300) {
      sitemapFound = true;
      const discoveredSitemapUrls = parseSitemapXml(sitemapRes.body, canonicalOrigin);
      sitemapUrlsCount = discoveredSitemapUrls.length;

      for (const sUrl of discoveredSitemapUrls) {
        const pType = classifyPageType(sUrl);
        queue.push({
          url: sUrl,
          pageType: pType,
          priority: getLinkPriority(pType),
          sourceUrl: sitemapUrl,
        });
      }
    }
  } catch (_e) {
    // Non-fatal if sitemap.xml is missing
  }

  // Helper to normalize and deduplicate URLs
  function cleanAndDedupeUrl(rawHref: string, base: string): string | null {
    try {
      const full = new URL(rawHref, base);
      full.hash = ""; // strip fragments
      // Strip trailing slash for consistent matching unless root
      if (full.pathname !== "/" && full.pathname.endsWith("/")) {
        full.pathname = full.pathname.slice(0, -1);
      }
      return full.toString();
    } catch {
      return null;
    }
  }

  // 4. Crawl Loop (Bounded to maxPages)
  while (queue.length > 0 && pages.length < maxPages) {
    // Sort queue by priority descending
    queue.sort((a, b) => b.priority - a.priority);
    const current = queue.shift()!;

    const normUrl = cleanAndDedupeUrl(current.url, canonicalOrigin);
    if (!normUrl || visitedUrls.has(normUrl)) {
      continue;
    }
    visitedUrls.add(normUrl);

    // Skip sitemap.xml or non-html endpoints from the pages array
    if (normUrl.endsWith(".xml") || normUrl.endsWith(".txt")) {
      continue;
    }

    const startTime = Date.now();
    let res: { status: number; body: string; headers: Record<string, string>; finalUrl: string };

    try {
      res = await fetchSafePage(normUrl, config);
    } catch (err: any) {
      warnings.push(`Failed to crawl page ${normUrl}: ${err.message}`);
      continue;
    }

    const loadDurationMs = Date.now() - startTime;
    const $ = cheerio.load(res.body);

    // DOM & Metadata Extraction
    const title = $("title").first().text().trim() || undefined;
    const metaDescription =
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      undefined;
    const language = $("html").attr("lang")?.trim() || undefined;
    const viewport = $('meta[name="viewport"]').attr("content")?.trim() || undefined;

    // Form detection
    const hasLoginForm = $("form").toArray().some((f) => {
      const formHtml = $(f).html() || "";
      return /password/i.test(formHtml);
    });
    const hasPaymentForm = $("form").toArray().some((f) => {
      const formHtml = $(f).html() || "";
      return /card|cvv|stripe|razorpay|payment/i.test(formHtml);
    });
    const hasContactForm = $("form").toArray().some((f) => {
      const formHtml = $(f).html() || "";
      return /message|feedback|contact|email/i.test(formHtml) && !hasLoginForm;
    });

    const pageType = classifyPageType(normUrl, title);

    if (!importantPages[pageType] || pageType !== "general") {
      importantPages[pageType] = normUrl;
    }

    pages.push({
      url: normUrl,
      finalUrl: res.finalUrl,
      httpStatus: res.status,
      pageType,
      title,
      metaDescription,
      language,
      viewport,
      hasLoginForm,
      hasPaymentForm,
      hasContactForm,
      discoveredFromUrl: current.sourceUrl,
      loadDurationMs,
      capturedAt: new Date().toISOString(),
    });

    // Extract Assets (scripts, stylesheets, images, favicons)
    $("script[src]").each((_, el) => {
      const src = $(el).attr("src");
      const fullSrc = src ? cleanAndDedupeUrl(src, normUrl) : null;
      if (fullSrc && !assetsMap.has(fullSrc)) {
        assetsMap.set(fullSrc, {
          url: fullSrc,
          assetType: "script",
          httpStatus: 200,
          isBroken: false,
          hasSri: !!$(el).attr("integrity"),
          sriHash: $(el).attr("integrity") || undefined,
          isWatermarkedSignal: false,
        });
      }
    });

    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr("href");
      const fullHref = href ? cleanAndDedupeUrl(href, normUrl) : null;
      if (fullHref && !assetsMap.has(fullHref)) {
        assetsMap.set(fullHref, {
          url: fullHref,
          assetType: "stylesheet",
          httpStatus: 200,
          isBroken: false,
          hasSri: !!$(el).attr("integrity"),
          sriHash: $(el).attr("integrity") || undefined,
          isWatermarkedSignal: false,
        });
      }
    });

    $("img[src]").each((_, el) => {
      const src = $(el).attr("src");
      const fullSrc = src ? cleanAndDedupeUrl(src, normUrl) : null;
      if (fullSrc && !assetsMap.has(fullSrc)) {
        assetsMap.set(fullSrc, {
          url: fullSrc,
          assetType: "image",
          httpStatus: 200,
          isBroken: false,
          hasSri: false,
          isWatermarkedSignal: /watermark|shutterstock|getty|alamy/i.test(fullSrc),
        });
      }
    });

    // Extract Links (internal priority queue + external link inventory)
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      const fullHref = cleanAndDedupeUrl(href, normUrl);
      if (!fullHref) return;

      try {
        const linkParsed = new URL(fullHref);
        const linkText = $(el).text().trim() || undefined;

        // Check if link points to downloadable document/PDF asset
        if (/\.(pdf|docx?|xlsx?|csv|zip|gz)$/i.test(linkParsed.pathname)) {
          if (!assetsMap.has(fullHref)) {
            assetsMap.set(fullHref, {
              url: fullHref,
              assetType: "document" as any,
              httpStatus: 200,
              isBroken: false,
              hasSri: false,
              isWatermarkedSignal: false,
            });
          }
          return;
        }

        if (linkParsed.origin.toLowerCase() === canonicalOrigin) {
          // Internal link: enqueue for priority discovery
          if (!visitedUrls.has(fullHref)) {
            const pType = classifyPageType(fullHref, linkText);
            queue.push({
              url: fullHref,
              pageType: pType,
              priority: getLinkPriority(pType),
              sourceUrl: normUrl,
            });
          }
        } else {
          // External link: record in external links inventory, do NOT crawl recursively
          if (!externalLinksMap.has(fullHref)) {
            externalLinksMap.set(fullHref, {
              url: fullHref,
              normalizedUrl: fullHref,
              isExternal: true,
              linkText,
              sourceUrl: normUrl,
            });
          }
        }
      } catch {
        // ignore invalid URL
      }
    });

    // Also parse JavaScript route definitions (e.g. Next.js / React Router / SPA navigation)
    $("script").each((_, el) => {
      const scriptContent = $(el).html();
      if (!scriptContent) return;

      // Extract path string patterns like "/privacy", "/terms", "/refund", "/about"
      const pathRegex = /["'](\/(?:privacy|terms|cookies?|contact|pricing|about|refund|shipping)[a-zA-Z0-9_\-\/]*)["']/gi;
      let pathMatch: RegExpExecArray | null;
      while ((pathMatch = pathRegex.exec(scriptContent)) !== null) {
        const matchedPath = pathMatch[1];
        if (matchedPath) {
          const fullJsUrl = cleanAndDedupeUrl(matchedPath, canonicalOrigin);
          if (fullJsUrl && !visitedUrls.has(fullJsUrl)) {
            const pType = classifyPageType(fullJsUrl);
            queue.push({
              url: fullJsUrl,
              pageType: pType,
              priority: getLinkPriority(pType),
              sourceUrl: normUrl,
            });
          }
        }
      }
    });
  }

  return {
    origin: canonicalOrigin,
    targetHost,
    pages,
    importantPages,
    externalLinks: Array.from(externalLinksMap.values()),
    assets: Array.from(assetsMap.values()),
    sitemapFound,
    sitemapUrlsCount,
    robotsTxtFound,
    robotsDisallowedPaths,
    warnings,
  };
}

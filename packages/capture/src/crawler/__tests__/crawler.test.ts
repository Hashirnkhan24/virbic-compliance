import { describe, it, expect } from "vitest";
import {
  classifyPageType,
  parseRobotsTxt,
  parseSitemapXml,
  crawlWebsite,
} from "../crawler";

describe("Website Crawler & Page Discovery", () => {
  describe("1. Page Type Classification", () => {
    it("correctly identifies legal and compliance pages", () => {
      expect(classifyPageType("https://example.com/privacy-policy")).toBe("privacy");
      expect(classifyPageType("https://example.com/terms-of-service")).toBe("terms");
      expect(classifyPageType("https://example.com/cookie-policy")).toBe("cookies");
      expect(classifyPageType("https://example.com/refund-cancellation")).toBe("refund");
      expect(classifyPageType("https://example.com/shipping-policy")).toBe("shipping");
      expect(classifyPageType("https://example.com/contact-us")).toBe("contact");
      expect(classifyPageType("https://example.com/about-our-company")).toBe("about");
      expect(classifyPageType("https://example.com/pricing-plans")).toBe("pricing");
      expect(classifyPageType("https://example.com/login")).toBe("login");
      expect(classifyPageType("https://example.com/signup")).toBe("signup");
      expect(classifyPageType("https://example.com/checkout")).toBe("checkout");
      expect(classifyPageType("https://example.com/")).toBe("home");
      expect(classifyPageType("https://example.com/blog/article-1")).toBe("general");
    });
  });

  describe("2. robots.txt Parsing", () => {
    it("extracts disallowed paths and sitemap pointers", () => {
      const robots = `
User-agent: *
Disallow: /admin
Disallow: /private/data
Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap-news.xml
`;
      const res = parseRobotsTxt(robots);
      expect(res.disallowedPaths).toEqual(["/admin", "/private/data"]);
      expect(res.sitemaps).toEqual([
        "https://example.com/sitemap.xml",
        "https://example.com/sitemap-news.xml",
      ]);
    });
  });

  describe("3. sitemap.xml Parsing", () => {
    it("extracts only same-origin URLs from sitemap XML", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/about</loc>
  </url>
  <url>
    <loc>https://example.com/privacy</loc>
  </url>
  <url>
    <loc>https://thirdparty.com/external-page</loc>
  </url>
</urlset>`;

      const urls = parseSitemapXml(xml, "https://example.com");
      expect(urls).toEqual([
        "https://example.com/about",
        "https://example.com/privacy",
      ]);
    });
  });

  describe("4. End-to-End Crawler with Simulated HTML & JavaScript Navigation", () => {
    const mockSiteDatabase: Record<string, string> = {
      "https://example.com": `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <title>Home - Vibe Brand</title>
            <meta name="description" content="Top quality vibe software" />
            <link rel="stylesheet" href="/styles/main.css" integrity="sha256-test123" />
            <script src="/scripts/bundle.js"></script>
          </head>
          <body>
            <header>
              <nav>
                <a href="/about">About Us</a>
                <a href="/pricing">Pricing</a>
                <a href="https://twitter.com/vibebrand">Twitter Profile</a>
              </nav>
            </header>
            <main>
              <h1>Welcome to Vibe Platform</h1>
              <img src="/images/hero.png" alt="Hero banner" />
              <img src="https://cdn.stockimages.com/watermark/sample.jpg" alt="Watermarked" />
              <a href="/downloads/security-whitepaper.pdf">Download Security PDF</a>
            </main>
            <footer>
              <a href="/privacy">Privacy Policy</a>
              <a href="/terms">Terms & Conditions</a>
              <a href="/cookies">Cookie Notice</a>
              <a href="/contact">Get in Touch</a>
              <a href="/refund">Refund Policy</a>
            </footer>
          </body>
        </html>
      `,
      "https://example.com/privacy": `
        <html><head><title>Privacy Policy</title></head>
        <body><p>We respect your privacy under DPDP 2023.</p></body></html>
      `,
      "https://example.com/terms": `
        <html><head><title>Terms and Conditions</title></head>
        <body><p>Standard terms of service.</p></body></html>
      `,
      "https://example.com/cookies": `
        <html><head><title>Cookie Policy</title></head>
        <body><p>Cookie information and tracking explanation.</p></body></html>
      `,
      "https://example.com/refund": `
        <html><head><title>Refund Policy</title></head>
        <body><p>Full refunds within 14 days of purchase.</p></body></html>
      `,
      "https://example.com/contact": `
        <html><head><title>Contact Us</title></head>
        <body>
          <form action="/submit-contact" method="POST">
            <input type="text" name="name" />
            <textarea name="message"></textarea>
            <button type="submit">Send Message</button>
          </form>
        </body></html>
      `,
      "https://example.com/pricing": `
        <html><head><title>Pricing & Plans</title></head>
        <body>
          <h2>₹499 Launch Plan</h2>
          <form action="/checkout">
            <input type="text" name="card" />
            <button type="submit">Pay Now</button>
          </form>
        </body></html>
      `,
      "https://example.com/about": `
        <html><head><title>About Our Team</title></head>
        <body><p>Building trusted software.</p></body></html>
      `,
      // Simulated SPA with JavaScript route definitions in script tag
      "https://example.com/spa-client": `
        <html>
          <head><title>SPA App</title></head>
          <body>
            <div id="root"></div>
            <script>
              const routes = [
                { path: "/privacy", component: PrivacyPage },
                { path: "/shipping", component: ShippingPage }
              ];
            </script>
          </body>
        </html>
      `,
      "https://example.com/shipping": `
        <html><head><title>Shipping and Delivery</title></head>
        <body><p>Digital delivery within 5 minutes.</p></body></html>
      `,
      "https://example.com/robots.txt": `
        User-agent: *
        Disallow: /admin
        Sitemap: https://example.com/sitemap.xml
      `,
      "https://example.com/sitemap.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/spa-client</loc></url>
        </urlset>
      `,
    };

    it("crawls the website up to limit, prioritizing compliance pages and separating external links", async () => {
      const mockFetcher = async (urlStr: string): Promise<{ status: number; body: string; headers: Record<string, string> }> => {
        // Strip trailing slash for lookup
        const cleanKey = urlStr.endsWith("/") && urlStr !== "https://example.com/"
          ? urlStr.slice(0, -1)
          : urlStr;
        const lookup = cleanKey === "https://example.com/" ? "https://example.com" : cleanKey;

        const body = mockSiteDatabase[lookup];
        if (body) {
          return { status: 200, body, headers: { "content-type": "text/html" } };
        }
        return { status: 404, body: "Not found", headers: { "content-type": "text/plain" } };
      };

      const result = await crawlWebsite("https://example.com", {
        maxPages: 10,
        customFetcher: mockFetcher,
        urlGuardConfig: {
          customDnsResolver: async () => ["93.184.216.34"], // Mock as public IP
        },
      });

      // 1. Basic properties
      expect(result.origin).toBe("https://example.com");
      expect(result.targetHost).toBe("example.com");
      expect(result.robotsTxtFound).toBe(true);
      expect(result.robotsDisallowedPaths).toContain("/admin");
      expect(result.sitemapFound).toBe(true);

      // 2. Page discovery count (strictly under maxPages limit)
      expect(result.pages.length).toBeLessThanOrEqual(10);
      expect(result.pages.length).toBeGreaterThanOrEqual(7);

      // 3. Priority compliance pages discovered
      expect(result.importantPages.privacy).toBe("https://example.com/privacy");
      expect(result.importantPages.terms).toBe("https://example.com/terms");
      expect(result.importantPages.cookies).toBe("https://example.com/cookies");
      expect(result.importantPages.refund).toBe("https://example.com/refund");
      expect(result.importantPages.contact).toBe("https://example.com/contact");
      expect(result.importantPages.about).toBe("https://example.com/about");
      expect(result.importantPages.pricing).toBe("https://example.com/pricing");

      // 4. Form detection signals
      const contactPage = result.pages.find((p) => p.pageType === "contact");
      expect(contactPage?.hasContactForm).toBe(true);

      const pricingPage = result.pages.find((p) => p.pageType === "pricing");
      expect(pricingPage?.hasPaymentForm).toBe(true);

      // 5. Assets extracted (scripts, stylesheets, images, downloadable documents)
      const assetUrls = result.assets.map((a) => a.url);
      expect(assetUrls).toContain("https://example.com/styles/main.css");
      expect(assetUrls).toContain("https://example.com/scripts/bundle.js");
      expect(assetUrls).toContain("https://example.com/images/hero.png");
      expect(assetUrls).toContain("https://example.com/downloads/security-whitepaper.pdf");

      const cssAsset = result.assets.find((a) => a.url === "https://example.com/styles/main.css");
      expect(cssAsset?.hasSri).toBe(true);

      const watermarkedAsset = result.assets.find((a) => a.url.includes("watermark"));
      expect(watermarkedAsset?.isWatermarkedSignal).toBe(true);

      // 6. External links recorded in externalLinks inventory and NOT crawled
      const externalLink = result.externalLinks.find((l) => l.url.includes("twitter.com"));
      expect(externalLink).toBeDefined();
      expect(externalLink?.isExternal).toBe(true);
      expect(result.pages.some((p) => p.url.includes("twitter.com"))).toBe(false);

      // 7. JavaScript / SPA navigation discovery
      expect(result.importantPages.shipping).toBe("https://example.com/shipping");
    });

    it("respects URL Guard and rejects starting from a private address", async () => {
      await expect(
        crawlWebsite("http://192.168.1.1")
      ).rejects.toThrow("Initial homepage blocked by URL Guard");
    });
  });
});

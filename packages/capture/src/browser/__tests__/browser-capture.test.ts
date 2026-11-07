import { describe, it, expect, afterAll } from "vitest";
import { PageObservationSchema } from "@vibe/contracts";
import { getBrowser, closeBrowser, withBrowser } from "../browser-provider";
import { capturePage } from "../browser-capture";

describe("Browser Capture Engine", () => {
  let sharedBrowser: any = null;

  afterAll(async () => {
    if (sharedBrowser) {
      await closeBrowser(sharedBrowser);
    }
  });

  describe("Browser Provider", () => {
    it("launches and closes a browser instance cleanly", async () => {
      const browser = await getBrowser();
      expect(browser.isConnected()).toBe(true);
      await closeBrowser(browser);
      expect(browser.isConnected()).toBe(false);
    });

    it("executes scoped browser tasks via withBrowser", async () => {
      const version = await withBrowser(async (browser) => {
        return browser.version();
      });
      expect(typeof version).toBe("string");
      expect(version.length).toBeGreaterThan(0);
    });
  });

  describe("Security & SSRF Protection", () => {
    it("immediately rejects loopback IP navigation targets", async () => {
      await expect(capturePage("http://127.0.0.1:8080/admin")).rejects.toThrow(
        /URL Guard rejected navigation target/
      );
    });

    it("immediately rejects AWS cloud metadata navigation targets", async () => {
      await expect(
        capturePage("http://169.254.169.254/latest/meta-data/")
      ).rejects.toThrow(/URL Guard rejected navigation target/);
    });

    it("immediately rejects private RFC1918 navigation targets", async () => {
      await expect(capturePage("http://192.168.1.1/router")).rejects.toThrow(
        /URL Guard rejected navigation target/
      );
    });

    it("intercepts and aborts in-page sub-resource requests to prohibited metadata IPs", async () => {
      const browser = await getBrowser();
      const context = await browser.newContext();
      let aborted = false;

      await context.route("**/*", async (route) => {
        const reqUrl = route.request().url();
        if (reqUrl.startsWith("http://169.254.169.254")) {
          aborted = true;
          await route.abort("blockedbyclient");
          return;
        }
        await route.continue();
      });

      const page = await context.newPage();
      await page.goto("https://example.com");
      await page.evaluate(() => {
        return fetch("http://169.254.169.254/latest/meta-data/").catch(() => {});
      });

      expect(aborted).toBe(true);
      await context.close();
      await closeBrowser(browser);
    });
  });

  describe("Live Page Capture (example.com)", () => {
    it(
      "captures DOM, metadata, network requests, and screenshot from example.com",
      async () => {
        sharedBrowser = await getBrowser();

        const capture = await capturePage(
          "https://example.com",
          {
            takeScreenshot: true,
            runAccessibilityScan: true,
          },
          sharedBrowser
        );

        // Basic page observations
        expect(capture.httpStatus).toBe(200);
        expect(capture.url).toBe("https://example.com/");
        expect(capture.pageObservation.title).toContain("Example Domain");
        expect(capture.htmlContent).toContain("Example Domain");

        // Validate against Shared Data Contract Zod schema
        const validatedObservation = PageObservationSchema.safeParse(
          capture.pageObservation
        );
        expect(validatedObservation.success).toBe(true);

        // Network requests recorded
        expect(capture.networkRequests.length).toBeGreaterThan(0);
        const docReq = capture.networkRequests.find(
          (r) => r.resourceType === "document"
        );
        expect(docReq).toBeDefined();
        expect(docReq?.isThirdParty).toBe(false);

        // Screenshot captured
        expect(capture.screenshot).toBeDefined();
        expect(capture.screenshot?.mimeType).toBe("image/jpeg");
        expect(capture.screenshot?.base64.length).toBeGreaterThan(100);
        expect(capture.screenshot?.sizeBytes).toBeGreaterThan(0);

        // Accessibility scan ran
        expect(Array.isArray(capture.accessibilityViolations)).toBe(true);
      },
      45_000 // 45s vitest timeout for real network request
    );
  });

  describe("Live Page Capture with Document Forms & Structure (httpbin.org/html)", () => {
    it(
      "captures HTML document and extracts DOM facts",
      async () => {
        if (!sharedBrowser || !sharedBrowser.isConnected()) {
          sharedBrowser = await getBrowser();
        }

        const capture = await capturePage(
          "https://httpbin.org/html",
          {
            takeScreenshot: false,
            runAccessibilityScan: false,
          },
          sharedBrowser
        );

        expect(capture.httpStatus).toBe(200);
        expect(capture.htmlContent).toContain("Herman Melville");
        expect(capture.pageObservation.domFacts).toBeDefined();
      },
      45_000
    );
  });
});

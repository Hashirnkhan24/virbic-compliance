import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { getBrowser, closeBrowser } from "../../browser/browser-provider";
import { runConsentSession, runAllConsentSessions } from "../consent-runner";

describe("Consent Testing Engine", () => {
  let server: http.Server;
  let port: number;
  let sharedBrowser: any = null;

  beforeAll(async () => {
    sharedBrowser = await getBrowser();

    server = http.createServer((req, res) => {
      const url = req.url || "/";

      if (url === "/compliant-banner") {
        // Sets essential cookie on load
        res.writeHead(200, {
          "Content-Type": "text/html",
          "Set-Cookie": "essential_session=sess_123; Path=/; HttpOnly; SameSite=Lax",
        });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Compliant Banner Site</title></head>
            <body>
              <h1>Welcome to Test Site</h1>
              <div id="onetrust-banner-sdk" style="position:fixed; bottom:0; background:#eee; padding:20px; width:100%;">
                <p>We use cookies to improve your experience and for marketing analytics.</p>
                <button id="onetrust-reject-all-handler">Reject All</button>
                <button id="onetrust-accept-btn-handler">Accept All</button>
              </div>
              <script>
                document.getElementById('onetrust-accept-btn-handler').addEventListener('click', function() {
                  document.cookie = "marketing_consent=granted; Path=/;";
                  fetch('https://www.google-analytics.com/analytics.js').catch(function(){});
                  document.getElementById('onetrust-banner-sdk').style.display = 'none';
                });
                document.getElementById('onetrust-reject-all-handler').addEventListener('click', function() {
                  document.cookie = "marketing_consent=denied; Path=/;";
                  document.getElementById('onetrust-banner-sdk').style.display = 'none';
                });
              </script>
            </body>
          </html>
        `);
      } else if (url === "/phantom-reject") {
        // Dark pattern / deceptive CMP: Reject button still fires trackers!
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Phantom Reject Site</title></head>
            <body>
              <div class="cookie-notice" style="padding:15px; background:#fff;">
                <p>Cookie consent notice</p>
                <button class="btn-decline">Reject Non-Essential</button>
                <button class="btn-allow">Allow All</button>
              </div>
              <script>
                document.querySelector('.btn-decline').addEventListener('click', function() {
                  // Sneakily still set tracking cookie and fire Meta pixel
                  document.cookie = "ad_tracking_id=sneaky_tracker_123; Path=/;";
                  fetch('https://connect.facebook.net/en_US/fbevents.js').catch(function(){});
                  localStorage.setItem('persistent_tracker', 'leak_456');
                });
              </script>
            </body>
          </html>
        `);
      } else if (url === "/asymmetric-banner") {
        // Banner with NO reject button (forced accept)
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Forced Consent</title></head>
            <body>
              <div id="cookie-banner" style="padding:10px;">
                <p>By using this website you agree to our use of all cookies.</p>
                <button id="btn-ok">I Accept</button>
              </div>
            </body>
          </html>
        `);
      } else if (url === "/no-banner") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>No Banner Site</title></head>
            <body>
              <h1>Simple Site Without Any Banner</h1>
            </body>
          </html>
        `);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as any;
        port = address.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (sharedBrowser) {
      await closeBrowser(sharedBrowser);
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  const getTestUrl = (path: string) => `http://127.0.0.1:${port}${path}`;

  // Config allowing local test port & mock DNS to bypass SSRF blocking for the test server
  const getTestOptions = () => ({
    timeoutMs: 15_000,
    settleDelayMs: 400,
    takeScreenshots: false,
    urlGuardConfig: {
      allowedPorts: [80, 443, port],
      customDnsResolver: async (host: string) => {
        if (host === "127.0.0.1") return ["93.184.216.34"];
        return ["93.184.216.34"];
      },
    },
  });

  describe("Security & Guard Rules", () => {
    it("rejects cloud metadata navigation destinations immediately", async () => {
      await expect(
        runConsentSession("http://169.254.169.254/latest/meta-data/", "no_choice")
      ).rejects.toThrow(/URL Guard rejected/);
    });
  });

  describe("Session 1: 'no_choice' (Passive observation)", () => {
    it("observes banner and pre-consent state without clicking any buttons", async () => {
      const result = await runConsentSession(
        getTestUrl("/compliant-banner"),
        "no_choice",
        getTestOptions(),
        sharedBrowser
      );

      expect(result.scenario).toBe("no_choice");
      expect(result.status).toBe("completed");
      expect(result.bannerDetected).toBe(true);
      expect(result.bannerActionTaken).toBe("none_passive_observation");
      expect(result.availableButtons.length).toBeGreaterThanOrEqual(2);

      // Pre-consent cookie captured
      const essentialCookie = result.cookiesBefore.find(
        (c) => c.name === "essential_session"
      );
      expect(essentialCookie).toBeDefined();

      // In no_choice run, marketing cookies must NOT be set
      const marketingCookie = result.cookiesAfter.find(
        (c) => c.name === "marketing_consent"
      );
      expect(marketingCookie).toBeUndefined();
    });
  });

  describe("Session 2: 'accept' (Accept all cookies)", () => {
    it("locates and clicks accept button, capturing resulting cookies and trackers", async () => {
      const result = await runConsentSession(
        getTestUrl("/compliant-banner"),
        "accept",
        getTestOptions(),
        sharedBrowser
      );

      expect(result.scenario).toBe("accept");
      expect(result.status).toBe("completed");
      expect(result.bannerDetected).toBe(true);
      expect(result.bannerActionTaken).toContain("clicked_accept");

      // Verify newly set marketing cookie is captured
      const marketingCookie = result.cookiesSet.find(
        (c) => c.name === "marketing_consent"
      );
      expect(marketingCookie).toBeDefined();

      // Verify tracker URL was identified
      expect(result.trackersFired.length).toBeGreaterThanOrEqual(1);
      expect(result.trackersFired[0]).toContain("google-analytics.com");
    });
  });

  describe("Session 3: 'reject' (Reject cookies)", () => {
    it("locates and clicks reject button, verifying marketing trackers are NOT fired", async () => {
      const result = await runConsentSession(
        getTestUrl("/compliant-banner"),
        "reject",
        getTestOptions(),
        sharedBrowser
      );

      expect(result.scenario).toBe("reject");
      expect(result.status).toBe("completed");
      expect(result.bannerDetected).toBe(true);
      expect(result.bannerActionTaken).toContain("clicked_reject");

      // The denied consent cookie was set, but NOT google analytics tracker
      const deniedCookie = result.cookiesSet.find(
        (c) => c.name === "marketing_consent"
      );
      expect(deniedCookie).toBeDefined();
      expect(result.trackersFired.length).toBe(0);
    });
  });

  describe("Invariant: Never assume Reject actually rejects (Phantom Reject Detection)", () => {
    it("truthfully captures tracking cookies and tracker calls even after user clicks Reject", async () => {
      const result = await runConsentSession(
        getTestUrl("/phantom-reject"),
        "reject",
        getTestOptions(),
        sharedBrowser
      );

      expect(result.scenario).toBe("reject");
      expect(result.bannerActionTaken).toContain("clicked_reject");

      // Verify that our engine truthfully records the tracking cookie set post-reject
      const sneakyCookie = result.cookiesSet.find(
        (c) => c.name === "ad_tracking_id"
      );
      expect(sneakyCookie).toBeDefined();

      // Verify that our engine truthfully records the Meta Pixel tracker firing post-reject
      expect(result.trackersFired.length).toBeGreaterThanOrEqual(1);
      expect(result.trackersFired[0]).toContain("facebook.net");

      // Verify that localStorage bypass was captured
      const storageLeak = result.storageItems.find(
        (s) => s.key === "persistent_tracker"
      );
      expect(storageLeak).toBeDefined();
      expect(storageLeak?.storageType).toBe("localStorage");
    });
  });

  describe("Banner Absence & Missing Controls", () => {
    it("does not treat absence of a banner alone as a violation", async () => {
      const result = await runConsentSession(
        getTestUrl("/no-banner"),
        "no_choice",
        getTestOptions(),
        sharedBrowser
      );

      expect(result.bannerDetected).toBe(false);
      expect(result.status).toBe("no_banner_found");
      expect(result.bannerActionTaken).toBe("none_passive_observation");
    });

    it("returns 'unable_to_verify' when banner exists but reject button is missing", async () => {
      const result = await runConsentSession(
        getTestUrl("/asymmetric-banner"),
        "reject",
        getTestOptions(),
        sharedBrowser
      );

      expect(result.bannerDetected).toBe(true);
      expect(result.status).toBe("unable_to_verify");
      expect(result.bannerActionTaken).toBe("reject_control_not_found");
    });
  });

  describe("Strict Context Isolation Guarantee", () => {
    it("guarantees zero cookie or storage leakage across sessions", async () => {
      // 1. Run accept session which sets marketing_consent
      const acceptRun = await runConsentSession(
        getTestUrl("/compliant-banner"),
        "accept",
        getTestOptions(),
        sharedBrowser
      );
      expect(acceptRun.cookiesSet.some((c) => c.name === "marketing_consent")).toBe(true);

      // 2. Immediately run a new reject session in a new context
      const rejectRun = await runConsentSession(
        getTestUrl("/compliant-banner"),
        "reject",
        getTestOptions(),
        sharedBrowser
      );

      // Pre-consent cookies in rejectRun must NOT contain marketing_consent from acceptRun
      const contaminatedPreCookie = rejectRun.cookiesBefore.find(
        (c) => c.name === "marketing_consent"
      );
      expect(contaminatedPreCookie).toBeUndefined();
    });
  });

  describe("Orchestration: runAllConsentSessions on Live Public Site", () => {
    it(
      "runs all 3 sessions sequentially in isolated contexts on example.com",
      async () => {
        const audit = await runAllConsentSessions("https://example.com", {
          timeoutMs: 25_000,
          settleDelayMs: 500,
          takeScreenshots: false,
        });

        expect(audit.targetUrl).toBe("https://example.com");
        expect(audit.noChoice.scenario).toBe("no_choice");
        expect(audit.accept.scenario).toBe("accept");
        expect(audit.reject.scenario).toBe("reject");

        // example.com has no banner
        expect(audit.noChoice.status).toBe("no_banner_found");
        expect(audit.accept.status).toBe("no_banner_found");
        expect(audit.reject.status).toBe("no_banner_found");
      },
      60_000
    );
  });
});

import { chromium, type Browser } from "playwright-core";
import type { BrowserProviderConfig } from "./browser-types";

/**
 * Provider-neutral browser acquisition adapter.
 * Supports:
 * 1. Remote WebSocket / CDP endpoint (e.g. Browserless, Browserbase, or decoupled Docker worker).
 * 2. Vercel / AWS Lambda serverless execution via @sparticuz/chromium (when runtime supported).
 * 3. Local Chromium via playwright-core for development and integration testing.
 */
export async function getBrowser(config?: BrowserProviderConfig): Promise<Browser> {
  // 1. Remote browser connection via WebSocket or CDP
  const remoteEndpoint =
    config?.wsEndpoint ||
    process.env.BROWSER_WS_ENDPOINT ||
    process.env.BROWSER_CDP_ENDPOINT;

  if (remoteEndpoint) {
    try {
      if (
        remoteEndpoint.startsWith("http://") ||
        remoteEndpoint.startsWith("https://") ||
        remoteEndpoint.startsWith("ws://") ||
        remoteEndpoint.startsWith("wss://")
      ) {
        return await chromium.connectOverCDP(remoteEndpoint);
      }
      return await chromium.connect(remoteEndpoint);
    } catch (remoteError) {
      console.warn("Failed to connect to remote browser endpoint:", remoteError);
      // Fall through to local/serverless launch
    }
  }

  // 2. Serverless environment detection (Vercel / AWS Lambda)
  const isServerless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  );

  if (isServerless) {
    try {
      // Dynamic import to avoid failure on non-Linux platforms (e.g. local Windows development)
      const sparticuzModule = await import("@sparticuz/chromium");
      const sparticuzChromium = sparticuzModule.default || sparticuzModule;

      const executablePath = await sparticuzChromium.executablePath();
      return await chromium.launch({
        args: [...sparticuzChromium.args, ...(config?.args || [])],
        executablePath,
        headless: (sparticuzChromium as any).headless ?? true,
      });
    } catch (sparticuzError) {
      console.warn(
        "Failed to launch @sparticuz/chromium in serverless environment, attempting standard launch:",
        sparticuzError
      );
    }
  }

  // 3. Standard local Chromium launch
  const defaultArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-features=AudioServiceOutOfProcess",
    "--no-first-run",
    "--no-zygote",
  ];

  return await chromium.launch({
    headless: config?.headless ?? true,
    executablePath:
      config?.executablePath ||
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      undefined,
    args: config?.args ? [...defaultArgs, ...config.args] : defaultArgs,
  });
}

/**
 * Safely closes a browser instance.
 */
export async function closeBrowser(browser?: Browser | null): Promise<void> {
  if (!browser) return;
  try {
    if (browser.isConnected()) {
      await browser.close();
    }
  } catch (error) {
    console.warn("Error while closing browser:", error);
  }
}

/**
 * Executes a scoped browser task with guaranteed cleanup.
 */
export async function withBrowser<T>(
  callback: (browser: Browser) => Promise<T>,
  config?: BrowserProviderConfig
): Promise<T> {
  const browser = await getBrowser(config);
  try {
    return await callback(browser);
  } finally {
    await closeBrowser(browser);
  }
}

import http from "http";
import https from "https";
import {
  validateTargetUrl,
  validateIpAddress,
  UrlGuardConfig,
  UrlGuardError,
  UrlGuardErrorCode,
} from "./url-guard";

export interface SafeFetchResult {
  ok: boolean;
  status?: number;
  finalUrl: string;
  redirectChain: string[];
  headers: Record<string, string>;
  error?: UrlGuardError;
}

/**
 * Safe HTTP request validator that follows redirects safely:
 * - Pre-validates destination URL and all DNS resolved IPs.
 * - Enforces maximum redirect limits (default 5).
 * - Intercepts 301, 302, 307, 308 redirects and validates the next hop.
 * - Revalidates DNS immediately before each connection to mitigate DNS rebinding attacks.
 * - Bounded request timeout.
 */
export async function safeValidateAndFollow(
  initialUrl: string,
  config: UrlGuardConfig = {}
): Promise<SafeFetchResult> {
  const maxRedirects = config.maxRedirects ?? 5;
  const timeoutMs = config.fetchTimeoutMs ?? 8000;

  let currentUrl = initialUrl;
  const redirectChain: string[] = [initialUrl];

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    // 1. Validate current target URL before establishing network connection
    const guardCheck = await validateTargetUrl(currentUrl, config);
    if (!guardCheck.isSafe) {
      return {
        ok: false,
        finalUrl: currentUrl,
        redirectChain,
        headers: {},
        error: guardCheck,
      };
    }

    // 2. Perform safe HEAD/GET probe to check response & redirects
    try {
      const stepResult = await executeSafeProbe(currentUrl, timeoutMs);

      // 3. Handle redirects (301, 302, 303, 307, 308)
      if (
        stepResult.status >= 300 &&
        stepResult.status < 400 &&
        stepResult.location
      ) {
        if (redirectCount >= maxRedirects) {
          return {
            ok: false,
            finalUrl: currentUrl,
            redirectChain,
            headers: stepResult.headers,
            error: {
              isSafe: false,
              errorCode: "REDIRECT_LIMIT_EXCEEDED",
              message: `Maximum redirect limit (${maxRedirects}) exceeded.`,
              url: currentUrl,
            },
          };
        }

        // Resolve relative redirects against current URL
        const nextUrl = new URL(stepResult.location, currentUrl).toString();
        redirectChain.push(nextUrl);
        currentUrl = nextUrl;
        continue;
      }

      // Final terminal response reached
      return {
        ok: true,
        status: stepResult.status,
        finalUrl: currentUrl,
        redirectChain,
        headers: stepResult.headers,
      };
    } catch (err: any) {
      return {
        ok: false,
        finalUrl: currentUrl,
        redirectChain,
        headers: {},
        error: {
          isSafe: false,
          errorCode: (err.code as UrlGuardErrorCode) || "TIMEOUT_EXCEEDED",
          message: err.message || "Failed to establish safe connection.",
          url: currentUrl,
        },
      };
    }
  }

  return {
    ok: false,
    finalUrl: currentUrl,
    redirectChain,
    headers: {},
    error: {
      isSafe: false,
      errorCode: "REDIRECT_LIMIT_EXCEEDED",
      message: "Exceeded maximum redirects.",
      url: currentUrl,
    },
  };
}

interface ProbeResponse {
  status: number;
  location?: string;
  headers: Record<string, string>;
}

/**
 * Executes a single HTTP/HTTPS probe with custom socket validation
 * to ensure the connection IP is not prohibited right at connection time.
 */
function executeSafeProbe(
  urlStr: string,
  timeoutMs: number
): Promise<ProbeResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const isHttps = parsed.protocol === "https:";
    const transport = isHttps ? https : http;

    const req = transport.request(
      parsed,
      {
        method: "HEAD", // Minimal bytes probe
        headers: {
          "User-Agent": "VibeRiskScanner/1.0 (Security Guard Validation)",
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

        resolve({
          status: res.statusCode || 200,
          location: res.headers.location,
          headers,
        });

        res.resume(); // Discard body
      }
    );

    // Socket-level IP check immediately upon connection
    req.on("socket", (socket) => {
      socket.on("lookup", (_err, address) => {
        if (address) {
          const ipCheck = validateIpAddress(address);
          if (ipCheck.isProhibited) {
            req.destroy(
              new Error(
                `Connection intercepted: destination IP ${address} is prohibited.`
              )
            );
          }
        }
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error(`Connection timed out after ${timeoutMs}ms`));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}

import { createHash } from "node:crypto";
import { getDomain } from "tldts";
import type { HeaderObservation } from "@vibe/contracts";

/**
 * Parameters that commonly carry credentials, tokens, or PII.
 */
const SENSITIVE_QUERY_PARAMS = new Set([
  "token",
  "access_token",
  "id_token",
  "refresh_token",
  "auth",
  "apikey",
  "api_key",
  "key",
  "secret",
  "password",
  "passwd",
  "pwd",
  "session",
  "sessionid",
  "session_id",
  "email",
  "code",
  "otp",
  "code_verifier",
  "signature",
  "sig",
]);

/**
 * Request/response headers that should have their values redacted.
 */
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
]);

/**
 * Strips sensitive query parameters from a URL string.
 */
export function sanitizeUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    let modified = false;

    for (const key of Array.from(url.searchParams.keys())) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_QUERY_PARAMS.has(lowerKey) || lowerKey.includes("secret") || lowerKey.includes("token")) {
        url.searchParams.set(key, "[REDACTED]");
        modified = true;
      }
    }

    return modified ? url.toString() : urlStr;
  } catch {
    return urlStr;
  }
}

/**
 * Redacts sensitive headers (e.g. Authorization, Cookie) in an array of headers.
 */
export function sanitizeHeaders(
  headers: Array<{ name: string; value: string }>
): HeaderObservation[] {
  return headers.map((h) => {
    const lowerName = h.name.toLowerCase();
    if (SENSITIVE_HEADERS.has(lowerName)) {
      return {
        name: h.name,
        value: `[REDACTED_LEN_${h.value.length}]`,
      };
    }
    return {
      name: h.name,
      value: h.value,
    };
  });
}

/**
 * Creates a deterministic SHA-256 hash of a string (e.g. cookie value).
 * Returns empty string if value is empty.
 */
export function hashSensitiveValue(value: string): string {
  if (!value) return "";
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Determines whether a target URL/domain is third-party relative to the primary origin.
 */
export function isThirdPartyUrl(targetUrl: string, originUrl: string): boolean {
  try {
    const targetParsed = new URL(targetUrl);
    const originParsed = new URL(originUrl);

    // If hosts match exactly, it's first-party
    if (targetParsed.hostname === originParsed.hostname) {
      return false;
    }

    // Compare apex domains using tldts
    const targetDomain = getDomain(targetParsed.hostname);
    const originDomain = getDomain(originParsed.hostname);

    if (targetDomain && originDomain && targetDomain === originDomain) {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

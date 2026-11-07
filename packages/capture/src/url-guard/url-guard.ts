import ipaddr from "ipaddr.js";
import { parse as parseDomain } from "tldts";
import * as dns from "dns/promises";
import { NormalizedUrl } from "@vibe/contracts";

export type UrlGuardErrorCode =
  | "INVALID_URL_FORMAT"
  | "UNSUPPORTED_PROTOCOL"
  | "USERINFO_NOT_ALLOWED"
  | "UNSUPPORTED_PORT"
  | "DNS_RESOLUTION_FAILED"
  | "PROHIBITED_IP_ADDRESS"
  | "LOOPBACK_IP_BLOCKED"
  | "PRIVATE_NETWORK_BLOCKED"
  | "CARRIER_GRADE_NAT_BLOCKED"
  | "LINK_LOCAL_BLOCKED"
  | "MULTICAST_BLOCKED"
  | "CLOUD_METADATA_BLOCKED"
  | "DNS_REBINDING_SUSPECTED"
  | "REDIRECT_LIMIT_EXCEEDED"
  | "REDIRECT_BLOCKED_UNSAFE_DESTINATION"
  | "TIMEOUT_EXCEEDED";

export interface UrlGuardError {
  isSafe: false;
  errorCode: UrlGuardErrorCode;
  message: string;
  url: string;
  resolvedIps?: string[];
}

export interface UrlGuardSuccess {
  isSafe: true;
  normalized: NormalizedUrl;
  resolvedIps: string[];
}

export type UrlGuardResult = UrlGuardSuccess | UrlGuardError;

export interface UrlGuardConfig {
  allowedProtocols?: ("http:" | "https:")[];
  allowedPorts?: number[]; // default: [80, 443]
  maxRedirects?: number; // default: 5
  dnsTimeoutMs?: number; // default: 3000ms
  fetchTimeoutMs?: number; // default: 8000ms
  customDnsResolver?: (hostname: string) => Promise<string[]>;
}

export const DEFAULT_ALLOWED_PORTS = [80, 443];
export const DEFAULT_MAX_REDIRECTS = 5;
export const DEFAULT_DNS_TIMEOUT_MS = 3000;
export const DEFAULT_FETCH_TIMEOUT_MS = 8000;

// Specific Cloud Metadata endpoints to explicitly block
const CLOUD_METADATA_IPS = [
  "169.254.169.254", // AWS, GCP, Azure, OpenStack, DigitalOcean
  "fd00:ec2::254", // AWS IPv6 metadata
  "100.100.100.200", // Alibaba Cloud metadata
];

/**
 * Normalizes input URL string, strips fragments, validates protocol,
 * ensures no embedded credentials (e.g. user:pass@host), and parses domain.
 */
export function normalizeUrl(inputUrl: string): {
  normalized?: NormalizedUrl;
  error?: UrlGuardError;
} {
  let parsed: URL;
  try {
    const trimmed = inputUrl.trim();
    // Pre-check for raw control characters or whitespace
    if (/[\s\r\n\t]/.test(trimmed)) {
      return {
        error: {
          isSafe: false,
          errorCode: "INVALID_URL_FORMAT",
          message: "URL contains prohibited whitespace or control characters.",
          url: inputUrl,
        },
      };
    }
    parsed = new URL(trimmed);
  } catch (_e) {
    return {
      error: {
        isSafe: false,
        errorCode: "INVALID_URL_FORMAT",
        message: "Malformed URL syntax.",
        url: inputUrl,
      },
    };
  }

  // 1. Only HTTP and HTTPS
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      error: {
        isSafe: false,
        errorCode: "UNSUPPORTED_PROTOCOL",
        message: `Protocol "${parsed.protocol}" is unsupported. Only HTTP and HTTPS are permitted.`,
        url: inputUrl,
      },
    };
  }

  // 2. Reject credentials in URL (user:pass@host)
  if (parsed.username || parsed.password) {
    return {
      error: {
        isSafe: false,
        errorCode: "USERINFO_NOT_ALLOWED",
        message: "URLs with embedded userinfo/credentials are not permitted for security.",
        url: inputUrl,
      },
    };
  }

  // 3. Port check
  let port: number | undefined;
  if (parsed.port) {
    port = parseInt(parsed.port, 10);
    if (isNaN(port) || port <= 0 || port > 65535) {
      return {
        error: {
          isSafe: false,
          errorCode: "UNSUPPORTED_PORT",
          message: `Port "${parsed.port}" is malformed.`,
          url: inputUrl,
        },
      };
    }
  }

  // 4. Strip fragments
  parsed.hash = "";

  // 5. Extract domain using tldts
  const tldResult = parseDomain(parsed.hostname);
  const domain = tldResult.domain || parsed.hostname;
  const subdomain = tldResult.subdomain || undefined;

  const normalized: NormalizedUrl = {
    raw: inputUrl,
    normalized: parsed.toString(),
    origin: parsed.origin,
    host: parsed.hostname.toLowerCase(),
    domain,
    subdomain,
    protocol: parsed.protocol as "http:" | "https:",
    port,
  };

  return { normalized };
}

/**
 * Validates an IP address (IPv4 or IPv6) against all prohibited ranges:
 * - Loopback (127.0.0.0/8, ::1)
 * - Private (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7)
 * - Carrier-grade NAT (100.64.0.0/10)
 * - Link-local (169.254.0.0/16, fe80::/10)
 * - Multicast (224.0.0.0/4, ff00::/8)
 * - Cloud metadata (169.254.169.254, etc.)
 * - Reserved & broadcast ranges
 */
export function validateIpAddress(ipString: string): {
  isProhibited: boolean;
  errorCode?: UrlGuardErrorCode;
  reason?: string;
} {
  // Check exact cloud metadata hits first
  if (CLOUD_METADATA_IPS.includes(ipString)) {
    return {
      isProhibited: true,
      errorCode: "CLOUD_METADATA_BLOCKED",
      reason: `Destination IP ${ipString} is a protected cloud instance metadata service.`,
    };
  }

  let parsedIp: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsedIp = ipaddr.parse(ipString);
  } catch (_e) {
    return {
      isProhibited: true,
      errorCode: "PROHIBITED_IP_ADDRESS",
      reason: `Could not parse IP address ${ipString}`,
    };
  }

  // If IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:169.254.169.254), convert to IPv4
  if (parsedIp.kind() === "ipv6" && (parsedIp as ipaddr.IPv6).isIPv4MappedAddress()) {
    parsedIp = (parsedIp as ipaddr.IPv6).toIPv4Address();
  }

  const range = parsedIp.range();

  switch (range) {
    case "loopback":
      return {
        isProhibited: true,
        errorCode: "LOOPBACK_IP_BLOCKED",
        reason: `Loopback IP ${ipString} is blocked.`,
      };
    case "private":
    case "uniqueLocal":
      return {
        isProhibited: true,
        errorCode: "PRIVATE_NETWORK_BLOCKED",
        reason: `Private RFC1918 / Unique Local IPv6 ${ipString} is blocked.`,
      };
    case "carrierGradeNat":
      return {
        isProhibited: true,
        errorCode: "CARRIER_GRADE_NAT_BLOCKED",
        reason: `Carrier-grade NAT IP ${ipString} is blocked.`,
      };
    case "linkLocal":
      return {
        isProhibited: true,
        errorCode: "LINK_LOCAL_BLOCKED",
        reason: `Link-local IP ${ipString} is blocked.`,
      };
    case "multicast":
      return {
        isProhibited: true,
        errorCode: "MULTICAST_BLOCKED",
        reason: `Multicast IP ${ipString} is blocked.`,
      };
    case "reserved":
    case "broadcast":
    case "unspecified":
      return {
        isProhibited: true,
        errorCode: "PROHIBITED_IP_ADDRESS",
        reason: `Reserved / Special range IP ${ipString} (${range}) is blocked.`,
      };
    default:
      return { isProhibited: false };
  }
}

/**
 * Resolves DNS A and AAAA records with bounded timeout.
 */
async function resolveDnsWithTimeout(
  hostname: string,
  timeoutMs: number,
  customResolver?: (host: string) => Promise<string[]>
): Promise<string[]> {
  if (customResolver) {
    return customResolver(hostname);
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`DNS resolution timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  const dnsPromise = (async () => {
    // If hostname is already a valid IP literal, return it directly
    try {
      ipaddr.parse(hostname);
      return [hostname];
    } catch {
      // Not an IP literal, proceed to DNS lookup
    }

    const [aRecords, aaaaRecords] = await Promise.allSettled([
      dns.resolve4(hostname),
      dns.resolve6(hostname),
    ]);

    const ips: string[] = [];
    if (aRecords.status === "fulfilled") {
      ips.push(...aRecords.value);
    }
    if (aaaaRecords.status === "fulfilled") {
      ips.push(...aaaaRecords.value);
    }

    if (ips.length === 0) {
      throw new Error(`No DNS records found for host "${hostname}"`);
    }

    return ips;
  })();

  return Promise.race([dnsPromise, timeoutPromise]);
}

/**
 * Comprehensive URL Guard Validator:
 * 1. Normalizes URL and validates syntax, protocol, and port.
 * 2. Inspects host against localhost / internal names.
 * 3. Validates allowed ports.
 * 4. Resolves DNS records (A and AAAA).
 * 5. Inspects every resolved IP against private, loopback, link-local, and cloud metadata ranges.
 */
export async function validateTargetUrl(
  inputUrl: string,
  config: UrlGuardConfig = {}
): Promise<UrlGuardResult> {
  const allowedPorts = config.allowedPorts || DEFAULT_ALLOWED_PORTS;
  const dnsTimeoutMs = config.dnsTimeoutMs || DEFAULT_DNS_TIMEOUT_MS;

  // 1. Normalization & structural syntax checks
  const { normalized, error } = normalizeUrl(inputUrl);
  if (error || !normalized) {
    return error!;
  }

  // 2. Reject obvious string-level localhost / internal names first
  const lowerHost = normalized.host;
  if (
    lowerHost === "localhost" ||
    lowerHost.endsWith(".localhost") ||
    lowerHost.endsWith(".local") ||
    lowerHost.endsWith(".internal") ||
    lowerHost.endsWith(".arpa")
  ) {
    return {
      isSafe: false,
      errorCode: "LOOPBACK_IP_BLOCKED",
      message: `Target host "${lowerHost}" is a restricted internal or local domain.`,
      url: inputUrl,
    };
  }

  // If host is an IP literal and no mock customDnsResolver is supplied, validate it immediately
  if (!config.customDnsResolver) {
    try {
      ipaddr.parse(lowerHost);
      const ipCheck = validateIpAddress(lowerHost);
      if (ipCheck.isProhibited) {
        return {
          isSafe: false,
          errorCode: ipCheck.errorCode || "PROHIBITED_IP_ADDRESS",
          message: ipCheck.reason || `IP ${lowerHost} is prohibited.`,
          url: inputUrl,
          resolvedIps: [lowerHost],
        };
      }
    } catch {
      // Not an IP literal, continue
    }
  }

  // 3. Validate Port
  if (normalized.port && !allowedPorts.includes(normalized.port)) {
    return {
      isSafe: false,
      errorCode: "UNSUPPORTED_PORT",
      message: `Port ${normalized.port} is not allowed. Permitted ports: ${allowedPorts.join(", ")}.`,
      url: inputUrl,
    };
  }

  // 4. DNS Resolution
  let resolvedIps: string[];
  try {
    resolvedIps = await resolveDnsWithTimeout(
      normalized.host,
      dnsTimeoutMs,
      config.customDnsResolver
    );
  } catch (err: any) {
    return {
      isSafe: false,
      errorCode: "DNS_RESOLUTION_FAILED",
      message: `DNS resolution failed for "${normalized.host}": ${err.message || err}`,
      url: inputUrl,
    };
  }

  // 5. Evaluate all resolved IPs
  for (const ip of resolvedIps) {
    const ipValidation = validateIpAddress(ip);
    if (ipValidation.isProhibited) {
      return {
        isSafe: false,
        errorCode: ipValidation.errorCode || "PROHIBITED_IP_ADDRESS",
        message: ipValidation.reason || `IP address ${ip} is prohibited.`,
        url: inputUrl,
        resolvedIps,
      };
    }
  }

  return {
    isSafe: true,
    normalized,
    resolvedIps,
  };
}

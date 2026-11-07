import { describe, it, expect } from "vitest";
import {
  normalizeUrl,
  validateIpAddress,
  validateTargetUrl,
} from "../url-guard";

describe("URL Guard & SSRF Protection", () => {
  describe("1. URL Normalization & Protocol Constraints", () => {
    it("accepts valid http and https URLs", () => {
      const res1 = normalizeUrl("https://example.com/path?foo=bar#hash");
      expect(res1.error).toBeUndefined();
      expect(res1.normalized?.normalized).toBe("https://example.com/path?foo=bar");
      expect(res1.normalized?.protocol).toBe("https:");
      expect(res1.normalized?.host).toBe("example.com");

      const res2 = normalizeUrl("http://example.com");
      expect(res2.error).toBeUndefined();
      expect(res2.normalized?.protocol).toBe("http:");
    });

    it("rejects non-HTTP protocols (file, ftp, javascript, data, gopher)", () => {
      const prohibited = [
        "file:///etc/passwd",
        "ftp://example.com/files",
        "javascript:alert(1)",
        "data:text/html,test",
        "gopher://127.0.0.1",
      ];
      for (const url of prohibited) {
        const res = normalizeUrl(url);
        expect(res.error).toBeDefined();
        expect(res.error?.errorCode).toBe("UNSUPPORTED_PROTOCOL");
      }
    });

    it("rejects credentials in URL (user:pass@host)", () => {
      const res = normalizeUrl("https://admin:secret123@example.com");
      expect(res.error).toBeDefined();
      expect(res.error?.errorCode).toBe("USERINFO_NOT_ALLOWED");
    });

    it("rejects malformed URLs and whitespace characters", () => {
      const invalid = [
        "not a url",
        "https://exam ple.com",
        "https://example.com\r\n/path",
        "https://:80",
      ];
      for (const url of invalid) {
        const res = normalizeUrl(url);
        expect(res.error).toBeDefined();
        expect(res.error?.errorCode).toBe("INVALID_URL_FORMAT");
      }
    });
  });

  describe("2. IP Address Validation & Range Blocking", () => {
    it("blocks localhost and loopback IPv4 addresses (127.0.0.0/8)", () => {
      const loopbacks = ["127.0.0.1", "127.0.0.2", "127.1.2.3"];
      for (const ip of loopbacks) {
        const check = validateIpAddress(ip);
        expect(check.isProhibited).toBe(true);
        expect(check.errorCode).toBe("LOOPBACK_IP_BLOCKED");
      }
    });

    it("blocks IPv6 loopback (::1)", () => {
      const check = validateIpAddress("::1");
      expect(check.isProhibited).toBe(true);
      expect(check.errorCode).toBe("LOOPBACK_IP_BLOCKED");
    });

    it("blocks private RFC 1918 IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)", () => {
      const privateIps = [
        "10.0.0.1",
        "10.254.0.1",
        "172.16.0.1",
        "172.31.255.255",
        "192.168.1.1",
        "192.168.0.254",
      ];
      for (const ip of privateIps) {
        const check = validateIpAddress(ip);
        expect(check.isProhibited).toBe(true);
        expect(check.errorCode).toBe("PRIVATE_NETWORK_BLOCKED");
      }
    });

    it("blocks private IPv6 ranges (fc00::/7, fe80::/10 link-local)", () => {
      const privateV6 = ["fc00::1", "fd12:3456:789a:1::1", "fe80::1ff:fe00:1"];
      for (const ip of privateV6) {
        const check = validateIpAddress(ip);
        expect(check.isProhibited).toBe(true);
      }
    });

    it("blocks cloud metadata instance endpoints (169.254.169.254, fd00:ec2::254)", () => {
      const metadataIps = ["169.254.169.254", "fd00:ec2::254", "100.100.100.200"];
      for (const ip of metadataIps) {
        const check = validateIpAddress(ip);
        expect(check.isProhibited).toBe(true);
        expect(check.errorCode).toBe("CLOUD_METADATA_BLOCKED");
      }
    });

    it("blocks IPv4-mapped IPv6 representations of prohibited IPs (::ffff:127.0.0.1)", () => {
      const mappedLoopback = "::ffff:127.0.0.1";
      const check1 = validateIpAddress(mappedLoopback);
      expect(check1.isProhibited).toBe(true);
      expect(check1.errorCode).toBe("LOOPBACK_IP_BLOCKED");

      const mappedMetadata = "::ffff:169.254.169.254";
      const check2 = validateIpAddress(mappedMetadata);
      expect(check2.isProhibited).toBe(true);
      expect(check2.errorCode).toBe("LINK_LOCAL_BLOCKED");
    });

    it("allows valid public IP addresses", () => {
      const publicIps = ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111"];
      for (const ip of publicIps) {
        const check = validateIpAddress(ip);
        expect(check.isProhibited).toBe(false);
      }
    });
  });

  describe("3. End-to-End URL Validation & DNS Mocking", () => {
    it("blocks hostname 'localhost' and internal TLDs immediately", async () => {
      const blockedHosts = [
        "http://localhost",
        "http://localhost:8080",
        "https://service.internal",
        "http://db.local",
      ];
      for (const url of blockedHosts) {
        const res = await validateTargetUrl(url);
        expect(res.isSafe).toBe(false);
        if (!res.isSafe) {
          expect(res.errorCode).toBe("LOOPBACK_IP_BLOCKED");
        }
      }
    });

    it("detects and blocks domains resolving to private/metadata IPs", async () => {
      // Mock resolver returning private IP for an innocent-looking domain
      const customResolver = async (_host: string) => ["192.168.1.50"];
      const res = await validateTargetUrl("https://innocent-looking-domain.com", {
        customDnsResolver: customResolver,
      });

      expect(res.isSafe).toBe(false);
      if (!res.isSafe) {
        expect(res.errorCode).toBe("PRIVATE_NETWORK_BLOCKED");
      }
    });

    it("detects and blocks domains resolving to cloud metadata IP", async () => {
      const customResolver = async (_host: string) => ["169.254.169.254"];
      const res = await validateTargetUrl("https://evil-metadata.com", {
        customDnsResolver: customResolver,
      });

      expect(res.isSafe).toBe(false);
      if (!res.isSafe) {
        expect(res.errorCode).toBe("CLOUD_METADATA_BLOCKED");
      }
    });

    it("detects DNS rebinding / mixed records where one IP is private", async () => {
      // Domain with both public and private IP in round-robin DNS
      const customResolver = async (_host: string) => ["93.184.216.34", "10.0.0.1"];
      const res = await validateTargetUrl("https://rebind-test.com", {
        customDnsResolver: customResolver,
      });

      expect(res.isSafe).toBe(false);
      if (!res.isSafe) {
        expect(res.errorCode).toBe("PRIVATE_NETWORK_BLOCKED");
      }
    });

    it("passes for genuine public domain with public IP", async () => {
      const customResolver = async (_host: string) => ["93.184.216.34"];
      const res = await validateTargetUrl("https://example.com", {
        customDnsResolver: customResolver,
      });

      expect(res.isSafe).toBe(true);
      if (res.isSafe) {
        expect(res.normalized.host).toBe("example.com");
        expect(res.resolvedIps).toEqual(["93.184.216.34"]);
      }
    });
  });
});

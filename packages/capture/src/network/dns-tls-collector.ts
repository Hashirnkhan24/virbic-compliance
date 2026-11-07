import * as dns from "node:dns/promises";
import * as tls from "node:tls";
import type { DnsObservation, DnsRecord, TlsObservation } from "@vibe/contracts";

const CDN_NS_KEYWORDS = [
  "cloudflare",
  "awsdns",
  "cloudfront",
  "akamai",
  "fastly",
  "azure-dns",
  "googledomains",
  "domaincontrol",
];

/**
 * Collects DNS records (A, AAAA, MX, TXT, NS, SPF, DMARC) for a target hostname.
 */
export async function collectDnsObservations(
  hostname: string,
  timeoutMs: number = 5000
): Promise<DnsObservation> {
  const records: DnsRecord[] = [];
  const resolvedIps: string[] = [];
  let spfRecord: string | undefined = undefined;
  let dmarcRecord: string | undefined = undefined;
  let isCloudflareOrCdn = false;

  const withTimeout = <T>(promise: Promise<T>, fallback: T): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
    ]);

  // 1. Resolve A records
  try {
    const aRecords = await withTimeout(dns.resolve4(hostname, { ttl: true }), []);
    for (const r of aRecords) {
      resolvedIps.push(r.address);
      records.push({ type: "A", value: r.address, ttl: r.ttl });
    }
  } catch {}

  // 2. Resolve AAAA records
  try {
    const aaaaRecords = await withTimeout(dns.resolve6(hostname, { ttl: true }), []);
    for (const r of aaaaRecords) {
      resolvedIps.push(r.address);
      records.push({ type: "AAAA", value: r.address, ttl: r.ttl });
    }
  } catch {}

  // 3. Resolve MX records
  try {
    const mxRecords = await withTimeout(dns.resolveMx(hostname), []);
    for (const r of mxRecords) {
      records.push({ type: "MX", value: `${r.priority} ${r.exchange}` });
    }
  } catch {}

  // 4. Resolve TXT records & SPF
  try {
    const txtRecords = await withTimeout(dns.resolveTxt(hostname), []);
    for (const chunks of txtRecords) {
      const fullTxt = chunks.join("");
      records.push({ type: "TXT", value: fullTxt });
      if (fullTxt.toLowerCase().startsWith("v=spf1")) {
        spfRecord = fullTxt;
      }
    }
  } catch {}

  // 5. Query DMARC record
  try {
    const dmarcTxt = await withTimeout(dns.resolveTxt(`_dmarc.${hostname}`), []);
    for (const chunks of dmarcTxt) {
      const fullTxt = chunks.join("");
      if (fullTxt.toLowerCase().startsWith("v=dmarc1")) {
        dmarcRecord = fullTxt;
        records.push({ type: "TXT", value: `_dmarc: ${fullTxt}` });
        break;
      }
    }
  } catch {}

  // 6. Resolve NS records & CDN detection
  try {
    const nsRecords = await withTimeout(dns.resolveNs(hostname), []);
    for (const ns of nsRecords) {
      records.push({ type: "NS", value: ns });
      const lowerNs = ns.toLowerCase();
      if (CDN_NS_KEYWORDS.some((kw) => lowerNs.includes(kw))) {
        isCloudflareOrCdn = true;
      }
    }
  } catch {}

  return {
    resolvedIps,
    records,
    spfRecord,
    dmarcRecord,
    hasDkimSignal: false,
    isCloudflareOrCdn,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Connects to port 443 via TLS and extracts certificate observations.
 */
export async function collectTlsObservations(
  hostname: string,
  port: number = 443,
  timeoutMs: number = 6000
): Promise<TlsObservation> {
  return new Promise<TlsObservation>((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({
          valid: false,
          enforcesHttps: false,
          hasMixedContentWarnings: false,
        });
      }
    }, timeoutMs);

    try {
      const socket = tls.connect(
        {
          host: hostname,
          port,
          servername: hostname,
          rejectUnauthorized: false, // Inspect certificate even if invalid
        },
        () => {
          if (settled) {
            socket.destroy();
            return;
          }
          settled = true;
          clearTimeout(timer);

          try {
            const cert = socket.getPeerCertificate();
            const authorized = socket.authorized;
            const protocol = socket.getProtocol() || undefined;
            const cipher = socket.getCipher();

            let validFrom: string | undefined = undefined;
            let validTo: string | undefined = undefined;
            let daysRemaining: number | undefined = undefined;

            if (cert.valid_from) {
              validFrom = new Date(cert.valid_from).toISOString();
            }
            if (cert.valid_to) {
              const toDate = new Date(cert.valid_to);
              validTo = toDate.toISOString();
              daysRemaining = Math.max(
                0,
                Math.floor((toDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              );
            }

            const formatCertField = (field: any): string | undefined => {
              if (!field) return undefined;
              if (typeof field === "string") return field;
              if (Array.isArray(field)) return field.join(", ");
              if (typeof field === "object") {
                const val = field.O || field.CN;
                if (val) return Array.isArray(val) ? val.join(", ") : String(val);
                return JSON.stringify(field);
              }
              return String(field);
            };

            const issuerStr = formatCertField(cert.issuer);
            const subjectStr = formatCertField(cert.subject);

            socket.destroy();

            resolve({
              valid: authorized,
              issuer: issuerStr,
              subject: subjectStr,
              validFrom,
              validTo,
              daysRemaining,
              protocol,
              cipherSuite: cipher?.name,
              enforcesHttps: true,
              hasMixedContentWarnings: false,
            });
          } catch {
            socket.destroy();
            resolve({
              valid: false,
              enforcesHttps: false,
              hasMixedContentWarnings: false,
            });
          }
        }
      );

      socket.on("error", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          socket.destroy();
          resolve({
            valid: false,
            enforcesHttps: false,
            hasMixedContentWarnings: false,
          });
        }
      });
    } catch {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({
          valid: false,
          enforcesHttps: false,
          hasMixedContentWarnings: false,
        });
      }
    }
  });
}

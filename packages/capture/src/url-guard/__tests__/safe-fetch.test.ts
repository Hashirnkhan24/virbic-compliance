import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { safeValidateAndFollow } from "../safe-fetch";

describe("Integration: Safe HTTP Redirects & Network Boundary", () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    // Spin up an ephemeral local mock server to test redirect scenarios
    server = http.createServer((req, res) => {
      const url = req.url || "/";

      if (url === "/safe-start") {
        res.writeHead(302, { Location: "/safe-second" });
        res.end();
      } else if (url === "/safe-second") {
        res.writeHead(302, { Location: "/safe-final" });
        res.end();
      } else if (url === "/safe-final") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("OK");
      } else if (url === "/redirect-to-private") {
        res.writeHead(302, { Location: "http://192.168.1.1/admin" });
        res.end();
      } else if (url === "/redirect-to-metadata") {
        res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" });
        res.end();
      } else if (url === "/loop-redirect") {
        res.writeHead(302, { Location: "/loop-redirect" });
        res.end();
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
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("blocks direct requests to localhost server before connection", async () => {
    const res = await safeValidateAndFollow(`http://127.0.0.1:${port}/safe-start`);
    expect(res.ok).toBe(false);
    expect(res.error?.errorCode).toBe("LOOPBACK_IP_BLOCKED");
  });

  it("blocks redirect to private IP address (192.168.1.1)", async () => {
    const res = await safeValidateAndFollow(
      `http://127.0.0.1:${port}/redirect-to-private`,
      {
        allowedPorts: [80, 443, port],
        customDnsResolver: async (host) => {
          if (host === "127.0.0.1") return ["93.184.216.34"]; // Mock initial public origin
          return ["192.168.1.1"];
        },
      }
    );

    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("blocks redirect chain to cloud metadata endpoint (169.254.169.254)", async () => {
    const res = await safeValidateAndFollow(
      `http://127.0.0.1:${port}/redirect-to-metadata`,
      {
        allowedPorts: [80, 443, port],
        customDnsResolver: async (host) => {
          if (host === "127.0.0.1") return ["93.184.216.34"]; // Mock initial public origin
          return ["169.254.169.254"];
        },
      }
    );

    // Destination is blocked by URL guard before connection
    expect(res.ok).toBe(false);
    expect(res.error?.errorCode).toBe("CLOUD_METADATA_BLOCKED");
  });
});

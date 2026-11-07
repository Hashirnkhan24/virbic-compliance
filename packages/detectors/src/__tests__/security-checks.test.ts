import { describe, it, expect, beforeEach } from "vitest";
import {
	d1ExposedSecretsCheck,
	d5HttpsTlsCheck,
	d6SecurityHeadersCheck,
	d7CookieFlagsCheck,
	d9SourceMapsCheck,
	d12FrontendSensitiveDataCheck,
} from "../index";
import { DetectionEngine } from "../framework/detection-engine";
import {
	createMockSnapshot,
	createMockContext,
	createMockAsset,
} from "./test-helpers";

describe("Wave 1 Security Checks (D1, D5, D6, D7, D9, D12)", () => {
	let engine: DetectionEngine;

	beforeEach(() => {
		engine = new DetectionEngine();
		engine.register(d1ExposedSecretsCheck);
		engine.register(d5HttpsTlsCheck);
		engine.register(d6SecurityHeadersCheck);
		engine.register(d7CookieFlagsCheck);
		engine.register(d9SourceMapsCheck);
		engine.register(d12FrontendSensitiveDataCheck);
	});

	describe("D1: Exposed API keys/secrets in JS", () => {
		it("flags critical issue when AWS access key or Stripe secret is leaked in script", async () => {
			const dummyKey = ["sk", "live", "1234567890abcdef12345678"].join("_");
			const snapshot = createMockSnapshot({
				pages: [
					{
						url: "https://example.com/",
						finalUrl: "https://example.com/",
						httpStatus: 200,
						pageType: "home",
						title: "Home",
						domFacts: {
							scripts: [
								{
									content:
										`const stripeKey = '${dummyKey}';`,
								},
							],
						},
						hasLoginForm: false,
						hasPaymentForm: false,
						hasContactForm: false,
						loadDurationMs: 200,
						capturedAt: new Date().toISOString(),
					},
				],
			});
			const ctx = createMockContext(snapshot.scanId);
			const { output: res } = await engine.executeCheck("D1", snapshot, ctx);
			expect(res.status).toBe("issue_found");
			expect(res.severity).toBe("critical");
			expect(res.reasonCode).toBe("EXPOSED_SECRET_IN_FRONTEND_CODE");
			expect(res.remediationTemplateId).toBe(
				"revoke_and_rotate_exposed_secrets"
			);

			// Verify invariant: Raw secret is masked in evidence
			const evId = res.evidenceIds[0]!;
			const ev = ctx.evidenceCollector.getEvidenceById(evId);
			expect(
				JSON.stringify(ev?.structuredValue).includes(dummyKey)
			).toBe(false);
			expect(
				JSON.stringify(ev?.structuredValue).includes("sk_live_****************")
			).toBe(true);
		});

		it("passes when no high-entropy keys or cloud secrets exist", async () => {
			const snapshot = createMockSnapshot();
			const ctx = createMockContext(snapshot.scanId);
			const { output: res } = await engine.executeCheck("D1", snapshot, ctx);
			expect(res.status).toBe("passed");
			expect(res.reasonCode).toBe("NO_EXPOSED_SECRETS_DETECTED");
		});
	});

	describe("D5: HTTPS / TLS enforcement", () => {
		it("passes when certificate is valid and TLS 1.3 is negotiated", async () => {
			const snapshot = createMockSnapshot();
			const ctx = createMockContext(snapshot.scanId);
			const { output: res } = await engine.executeCheck("D5", snapshot, ctx);
			expect(res.status).toBe("passed");
			expect(res.reasonCode).toBe("TLS_HEALTHY");
		});

		it("flags critical issue when TLS certificate is expired or invalid", async () => {
			const snapshot = createMockSnapshot({
				tls: {
					valid: false,
					enforcesHttps: true,
					hasMixedContentWarnings: false,
					protocol: "TLSv1.2",
					issuer: "Self-signed",
					subject: "example.com",
					validFrom: "2020-01-01T00:00:00Z",
					validTo: "2021-01-01T00:00:00Z",
					daysRemaining: -300,
				},
			});
			const ctx = createMockContext(snapshot.scanId);
			const { output: res } = await engine.executeCheck("D5", snapshot, ctx);
			expect(res.status).toBe("issue_found");
			expect(res.severity).toBe("critical");
			expect(res.reasonCode).toBe("TLS_CERTIFICATE_INVALID");
		});
	});

	describe("D6: Security headers", () => {
		it("flags issue when critical headers like HSTS or X-Content-Type-Options are absent", async () => {
			const snapshot = createMockSnapshot({
				responseHeaders: [{ name: "Content-Type", value: "text/html" }],
			});
			const ctx = createMockContext(snapshot.scanId);
			const { output: res } = await engine.executeCheck("D6", snapshot, ctx);
			expect(res.status).toBe("issue_found");
			expect(res.severity).toBe("high");
			expect(res.reasonCode).toBe("SECURITY_HEADERS_MISSING");
		});
	});

	describe("D7: Cookie security flags", () => {
		it("flags issue when sensitive session cookies lack Secure or HttpOnly flags", async () => {
			const snapshot = createMockSnapshot({
				cookies: [
					{
						name: "auth_token",
						domain: "example.com",
						path: "/",
						httpOnly: false,
						secure: false,
						isThirdParty: false,
						observedScenario: "pre_consent",
						redactedValueHash: "123",
					},
				],
			});
			const ctx = createMockContext(snapshot.scanId);
			const { output: res } = await engine.executeCheck("D7", snapshot, ctx);
			expect(res.status).toBe("issue_found");
			expect(res.severity).toBe("high");
			expect(res.reasonCode).toBe("COOKIE_MISSING_SECURE_FLAG");
		});
	});

	describe("D9: Source maps exposed", () => {
		it("flags issue when production .map file is publicly reachable", async () => {
			const snapshot = createMockSnapshot({
				assets: [
					createMockAsset({
						url: "https://example.com/main.bundle.js.map",
						assetType: "sourcemap",
						httpStatus: 200,
						isBroken: false,
					}),
				],
			});
			const ctx = createMockContext(snapshot.scanId);
			const { output: res } = await engine.executeCheck("D9", snapshot, ctx);
			expect(res.status).toBe("issue_found");
			expect(res.severity).toBe("low");
			expect(res.reasonCode).toBe("SOURCE_MAP_EXPOSED_IN_PRODUCTION");
		});
	});

	describe("D12: Sensitive data in frontend", () => {
		it("flags critical issue when database connection string is exposed", async () => {
			const snapshot = createMockSnapshot({
				pages: [
					{
						url: "https://example.com/",
						finalUrl: "https://example.com/",
						httpStatus: 200,
						pageType: "home",
						title: "Home",
						domFacts: {
							scripts: [
								{
									content:
										'const dbUri = "postgres://admin:secret123@db.prod.internal:5432/main";',
								},
							],
						},
						hasLoginForm: false,
						hasPaymentForm: false,
						hasContactForm: false,
						loadDurationMs: 200,
						capturedAt: new Date().toISOString(),
					},
				],
			});
			const ctx = createMockContext(snapshot.scanId);
			const { output: res } = await engine.executeCheck("D12", snapshot, ctx);
			expect(res.status).toBe("issue_found");
			expect(res.severity).toBe("critical");
			expect(res.reasonCode).toBe("SENSITIVE_DATA_LEAK_IN_FRONTEND");
		});
	});
});

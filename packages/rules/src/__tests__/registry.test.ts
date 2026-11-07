import { describe, it, expect } from "vitest";
import { CheckRegistry, WAVE_1_REGISTRY, type CheckRegistryEntry } from "../registry";

describe("CheckRegistry", () => {
  it("registers and retrieves check entries", () => {
    const registry = new CheckRegistry();
    const testEntry: CheckRegistryEntry = {
      id: "TEST_1",
      version: "1.0.0",
      title: "Test Check",
      description: "Test check description",
      module: "security",
      wave: "W1",
      priority: 10,
      defaultSeverity: "high",
      jurisdictions: [],
      legalReferences: ["Test Law"],
      exposureModelIds: [],
      reviewDate: "2025-10-01",
      enabled: true,
    };

    registry.register(testEntry);
    expect(registry.has("TEST_1")).toBe(true);
    expect(registry.get("TEST_1")).toEqual(testEntry);
    expect(registry.size).toBe(1);
  });

  it("loads default Wave 1 registry containing all ~41 checks", () => {
    const registry = new CheckRegistry();
    registry.registerAll(WAVE_1_REGISTRY);

    expect(registry.size).toBeGreaterThanOrEqual(30);
    expect(registry.has("A1")).toBe(true);
    expect(registry.has("D5")).toBe(true);
    expect(registry.has("B2")).toBe(true);
  });

  it("filters checks by wave", () => {
    const registry = new CheckRegistry();
    registry.registerAll(WAVE_1_REGISTRY);

    const w1Checks = registry.getByWave("W1");
    expect(w1Checks.length).toBe(registry.size);
    expect(w1Checks.every((c) => c.wave === "W1")).toBe(true);
  });

  it("filters checks by module", () => {
    const registry = new CheckRegistry();
    registry.registerAll(WAVE_1_REGISTRY);

    const privacyChecks = registry.getByModule("privacy");
    expect(privacyChecks.length).toBeGreaterThanOrEqual(3);
    expect(privacyChecks.every((c) => c.module === "privacy")).toBe(true);
  });

  it("filters checks by customer-confirmed jurisdictions", () => {
    const registry = new CheckRegistry();
    registry.registerAll(WAVE_1_REGISTRY);

    // Universal checks have jurisdictions: []
    // India-only checks have ["india"]
    // US-only checks (A10) have ["us"]
    const indiaApplicable = registry.getApplicable(["india"]);
    const usApplicable = registry.getApplicable(["us"]);

    // A10 is US-specific (CCPA opt out)
    expect(indiaApplicable.some((c) => c.id === "A10")).toBe(false);
    expect(usApplicable.some((c) => c.id === "A10")).toBe(true);

    // D5 is universal (security)
    expect(indiaApplicable.some((c) => c.id === "D5")).toBe(true);
    expect(usApplicable.some((c) => c.id === "D5")).toBe(true);
  });
});

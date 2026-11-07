import type { Jurisdiction } from "@vibe/contracts";

export interface ExposureModelDefinition {
  id: string;
  name: string;
  jurisdiction: Jurisdiction;
  statutoryMaxInr: number;
  plausibleDirectCostMinInr: number;
  plausibleDirectCostMaxInr: number;
  remediationCostEstimateInr: number;
  operationalImpact: string;
  statutoryBasis: string;
  applicableCheckIds: string[];
}

/**
 * Source-backed exposure models reviewed against active statutory legislation.
 * Invariant: No made-up enforcement probabilities or arbitrarily fabricated sums.
 */
export const REVIEWED_EXPOSURE_MODELS: Record<string, ExposureModelDefinition> = {
  dpdp_penalty_range: {
    id: "dpdp_penalty_range",
    name: "Digital Personal Data Protection Act (DPDP 2023) Exposure",
    jurisdiction: "india",
    statutoryMaxInr: 2500000000, // ₹250 crore statutory maximum under DPDP Schedule 1
    plausibleDirectCostMinInr: 50000,
    plausibleDirectCostMaxInr: 2500000,
    remediationCostEstimateInr: 35000,
    operationalImpact:
      "Inquiry and audit by Data Protection Board of India, formal compliance directives, and public notice.",
    statutoryBasis:
      "Digital Personal Data Protection Act, 2023, Sections 4-9 and Schedule (Penalties up to ₹250 Cr for significant data breaches and unconsented tracking).",
    applicableCheckIds: ["A1", "A5", "A6", "B1", "B2", "B4", "B6", "I2", "D7", "D12"],
  },
  consumer_protection_misleading: {
    id: "consumer_protection_misleading",
    name: "Consumer Protection Act 2019 (Misleading Claims & Dark Patterns)",
    jurisdiction: "india",
    statutoryMaxInr: 5000000, // ₹50 lakh statutory maximum under Sec 21
    plausibleDirectCostMinInr: 25000,
    plausibleDirectCostMaxInr: 500000,
    remediationCostEstimateInr: 15000,
    operationalImpact:
      "Notice from Central Consumer Protection Authority (CCPA), forced correction of dark patterns, and advertising takedown.",
    statutoryBasis:
      "Consumer Protection Act 2019, Section 21 & Guidelines for Prevention of Dark Patterns 2023.",
    applicableCheckIds: ["B3", "E2", "E5", "F7"],
  },
  gdpr_standard_exposure: {
    id: "gdpr_standard_exposure",
    name: "GDPR Transparency & Unconsented Processing Risk",
    jurisdiction: "eu",
    statutoryMaxInr: 1800000000, // €20M / 4% global turnover cap under GDPR Art. 83 (~₹180 Cr equivalent)
    plausibleDirectCostMinInr: 100000,
    plausibleDirectCostMaxInr: 5000000,
    remediationCostEstimateInr: 50000,
    operationalImpact:
      "Supervisory Authority (DPA) investigation, mandatory data processing suspension, and formal reprimand.",
    statutoryBasis:
      "EU General Data Protection Regulation (GDPR), Articles 5, 6, 12, 13, and 83.",
    applicableCheckIds: ["A1", "A5", "A6", "B1", "B2", "B4", "B6", "B7", "I2"],
  },
  ccpa_statutory_exposure: {
    id: "ccpa_statutory_exposure",
    name: "California Consumer Privacy Act (CCPA / CPRA) Risk",
    jurisdiction: "us",
    statutoryMaxInr: 625000, // ~$7,500 (~₹6.25 lakh) per intentional statutory violation under Cal. Civ. Code § 1798.155
    plausibleDirectCostMinInr: 50000,
    plausibleDirectCostMaxInr: 1500000,
    remediationCostEstimateInr: 25000,
    operationalImpact:
      "California Privacy Protection Agency (CPPA) enforcement audit, cure period inquiry, and mandatory opt-out implementation.",
    statutoryBasis:
      "California Civil Code § 1798.120 and § 1798.155 (Enforcement by CPPA / Attorney General).",
    applicableCheckIds: ["A10", "A1", "B6", "I2"],
  },
};

/**
 * Returns matching exposure models for a check ID filtered by customer-confirmed jurisdictions.
 */
export function getExposureModelsForCheck(
  checkId: string,
  confirmedJurisdictions: Jurisdiction[] = ["india"]
): ExposureModelDefinition[] {
  const models: ExposureModelDefinition[] = [];

  for (const model of Object.values(REVIEWED_EXPOSURE_MODELS)) {
    if (
      confirmedJurisdictions.includes(model.jurisdiction) &&
      model.applicableCheckIds.includes(checkId)
    ) {
      models.push(model);
    }
  }

  return models;
}

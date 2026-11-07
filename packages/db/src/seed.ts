import * as dotenv from "dotenv";
import { resolve } from "path";
import { getDb } from "./index";
import { checkMetadata, exposureModels } from "./schema";
import rawChecks from "./checks-seed.json";

dotenv.config({ path: resolve(__dirname, "../../../.env") });
dotenv.config({ path: resolve(__dirname, "../../.env") });
dotenv.config({ path: resolve(__dirname, "../../../apps/web/.env.local") });

function getModuleFromCheckId(id: string): string {
  const prefix = id.charAt(0).toUpperCase();
  switch (prefix) {
    case "A":
      return "privacy";
    case "B":
      return "cookies";
    case "C":
      return "accessibility";
    case "D":
      return "security";
    case "E":
      return "legal";
    case "F":
      return "consumer";
    case "G":
      return "ip";
    case "H":
      return "quality";
    case "I":
      return "third_party";
    default:
      return "general";
  }
}

export async function seedDatabase(connectionString?: string) {
  const db = getDb(connectionString);

  console.log("🌱 Seeding source-backed exposure models...");
  const initialExposureModels = [
    {
      id: "dpdp_penalty_range",
      name: "Digital Personal Data Protection Act (DPDP 2023) Exposure",
      jurisdiction: "india",
      statutoryMaxInr: "2500000000.00", // ₹250 crore statutory cap under Schedule 1
      plausibleDirectCostMinInr: "50000.00",
      plausibleDirectCostMaxInr: "2500000.00",
      remediationCostEstimateInr: "35000.00",
      operationalImpact: "Inquiry by Data Protection Board of India, mandatory remediation, and reputational loss.",
      statutoryBasis: "Digital Personal Data Protection Act, 2023, Sections 4-9 and Schedule (Penalties up to ₹250 Cr for significant breaches).",
      reviewDate: new Date(),
    },
    {
      id: "consumer_protection_misleading",
      name: "Consumer Protection Act 2019 (Misleading Claims & Dark Patterns)",
      jurisdiction: "india",
      statutoryMaxInr: "5000000.00", // ₹50 lakh statutory maximum
      plausibleDirectCostMinInr: "25000.00",
      plausibleDirectCostMaxInr: "500000.00",
      remediationCostEstimateInr: "15000.00",
      operationalImpact: "Notice from Central Consumer Protection Authority (CCPA), forced correction, and ad takedown.",
      statutoryBasis: "Consumer Protection Act 2019, Section 21 & Guidelines for Prevention of Dark Patterns 2023.",
      reviewDate: new Date(),
    },
    {
      id: "gdpr_standard_exposure",
      name: "GDPR Transparency & Consent Risk",
      jurisdiction: "eu",
      statutoryMaxInr: "1800000000.00", // €20M / 4% global turnover (~₹180 Cr equivalent)
      plausibleDirectCostMinInr: "100000.00",
      plausibleDirectCostMaxInr: "5000000.00",
      remediationCostEstimateInr: "50000.00",
      operationalImpact: "DPA investigation, formal compliance order, processing halt.",
      statutoryBasis: "EU General Data Protection Regulation (GDPR) Art. 83.",
      reviewDate: new Date(),
    },
  ];

  for (const model of initialExposureModels) {
    await db
      .insert(exposureModels)
      .values(model)
      .onConflictDoUpdate({
        target: exposureModels.id,
        set: model,
      });
  }

  console.log(`🌱 Seeding ${rawChecks.length} checks from blueprint library...`);
  for (const check of rawChecks) {
    const checkModule = getModuleFromCheckId(check.checkId);
    const requiredEvidenceList = check.evidenceInput
      .split(/[,+]/)
      .map((s) => s.trim().toLowerCase());

    const isEnabledWave = check.wave === "W1"; // Wave 1 is active by default for MMP

    await db
      .insert(checkMetadata)
      .values({
        checkId: check.checkId,
        version: "1.0.0",
        module: checkModule,
        title: check.title,
        description: `${check.title} (${check.evidenceInput})`,
        detectorPath: check.detectorPath,
        requiredEvidence: requiredEvidenceList,
        method: check.method,
        enabledInWave: check.wave,
        isEnabled: isEnabledWave,
        remediationTemplate: `Review and implement required fixes for ${check.title}. Verify associated evidence locators.`,
        exposureModelId: checkModule === "privacy" ? "dpdp_penalty_range" : null,
        legalReferences: checkModule === "privacy" ? ["DPDP 2023", "GDPR"] : [],
        lastReviewedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: checkMetadata.checkId,
        set: {
          title: check.title,
          detectorPath: check.detectorPath,
          enabledInWave: check.wave,
          isEnabled: isEnabledWave,
          method: check.method,
        },
      });
  }

  console.log("✅ Seed completed successfully!");
}

// Allow direct CLI execution if executed directly with node/tsx
if (process.argv[1]?.includes("seed")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}

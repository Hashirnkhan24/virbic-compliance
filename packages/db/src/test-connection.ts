import * as dotenv from "dotenv";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";

// packages/db working dir is C:\Users\Hashir\Desktop\vibe-compliance-checker\packages\db
dotenv.config({ path: resolve(__dirname, "../../../.env") });
dotenv.config({ path: resolve(__dirname, "../../.env") });
dotenv.config({ path: resolve(__dirname, "../../../apps/web/.env.local") });

async function testConnection() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL is not set.");
    console.error("Resolved paths checked from:", __dirname);
    process.exit(1);
  }

  console.log("🔍 Testing Neon PostgreSQL connection...");
  try {
    const sql = neon(url);
    const result = await sql`SELECT NOW() as current_time, version() as pg_version;`;
    console.log("✅ Successfully connected to Neon PostgreSQL!");
    console.log("🕒 Current DB Time:", result[0]?.current_time);
    console.log("🐘 PostgreSQL Version:", result[0]?.pg_version);
  } catch (err: any) {
    console.error("❌ Database connection failed:", err.message || err);
    process.exit(1);
  }
}

testConnection();

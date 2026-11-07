import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Neon Serverless Database Client
 * Works across Vercel edge/serverless runtimes and local Node.js.
 */
export function getDb(connectionString?: string) {
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Please provide a valid Neon PostgreSQL connection string."
    );
  }

  // Neon connection cache configuration
  neonConfig.fetchConnectionCache = true;

  const sql = neon(url);
  return drizzle(sql, { schema });
}

export type DbClient = ReturnType<typeof getDb>;

// Export all schema tables, enums, and relations
export * from "./schema";
export * from "./persistence/evidence-persistence";

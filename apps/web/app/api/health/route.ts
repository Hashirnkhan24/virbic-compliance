import { NextResponse } from "next/server";
import { HealthCheckResponseSchema } from "@vibe/contracts";
import { env } from "@/lib/env";

export async function GET() {
  const healthData = {
    status: "ok" as const,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "0.1.0",
    environment: env.NODE_ENV,
  };

  const parsed = HealthCheckResponseSchema.safeParse(healthData);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Internal schema validation error", details: parsed.error.format() },
      { status: 500 }
    );
  }

  return NextResponse.json(parsed.data, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

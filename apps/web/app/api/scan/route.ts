import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ScanRequestSchema } from "@vibe/contracts";
import { validateTargetUrl } from "@vibe/capture";
import { ScanStore } from "@/lib/scan-store";
import { runScan } from "@/lib/scan-runner";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = ScanRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid scan request",
          details: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { url, jurisdictions } = parsed.data;

    // Fast-path URL Guard verification
    const guard = await validateTargetUrl(url);
    if (!guard.isSafe) {
      return NextResponse.json(
        {
          error: "Target URL rejected for safety reasons",
          message: guard.message,
        },
        { status: 400 }
      );
    }

    const scanId = randomUUID();
    const scan = await ScanStore.createScan({
      id: scanId,
      targetUrl: guard.normalized.normalized,
      targetHost: guard.normalized.host,
      jurisdictions,
      scannerVersion: "1.0.0",
      rulesetVersion: "1.0.0",
    });

    // Run the scan pipeline asynchronously in the background
    // (Do not await - return immediately so client can poll)
    runScan(scanId).catch((err) => {
      console.error(`Unhandled error in background scan ${scanId}:`, err);
    });

    return NextResponse.json(
      {
        scanId: scan.id,
        targetUrl: scan.targetUrl,
        status: scan.status,
        currentStage: scan.currentStage,
        createdAt: scan.createdAt,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Error creating scan:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

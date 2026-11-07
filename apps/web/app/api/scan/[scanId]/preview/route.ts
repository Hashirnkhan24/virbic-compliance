import { NextRequest, NextResponse } from "next/server";
import { FreeScanPreviewSchema } from "@vibe/contracts";
import { ScanStore } from "@/lib/scan-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    const scan = await ScanStore.getScan(scanId);

    if (!scan) {
      return NextResponse.json(
        { error: "Scan not found", scanId },
        { status: 404 }
      );
    }

    if (scan.status === "pending" || scan.status === "running") {
      return NextResponse.json(
        {
          error: "Scan in progress",
          status: scan.status,
          currentStage: scan.currentStage,
        },
        { status: 202 }
      );
    }

    if (scan.status === "failed") {
      return NextResponse.json(
        {
          error: "Scan failed",
          status: "failed",
          errorMessage: scan.errorMessage ?? "An error occurred during scanning.",
        },
        { status: 422 }
      );
    }

    if (!scan.freePreview) {
      return NextResponse.json(
        { error: "Free preview data unavailable", scanId },
        { status: 500 }
      );
    }

    // Validate against strict allowlisted FreeScanPreviewSchema
    const validated = FreeScanPreviewSchema.safeParse(scan.freePreview);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Preview validation contract violation",
          issues: validated.error.issues,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to retrieve preview", message: err.message },
      { status: 500 }
    );
  }
}

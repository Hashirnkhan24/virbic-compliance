import { NextRequest, NextResponse } from "next/server";
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

    return NextResponse.json({
      id: scan.id,
      targetUrl: scan.targetUrl,
      targetHost: scan.targetHost,
      status: scan.status,
      currentStage: scan.currentStage,
      score: scan.score,
      isPaid: scan.isPaid,
      events: scan.events,
      errorMessage: scan.errorMessage,
      createdAt: scan.createdAt,
      startedAt: scan.startedAt,
      finishedAt: scan.finishedAt,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to retrieve scan status", message: err.message },
      { status: 500 }
    );
  }
}

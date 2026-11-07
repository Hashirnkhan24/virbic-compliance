import { NextRequest, NextResponse } from "next/server";
import { ScanStore } from "@/lib/scan-store";
import { getArtifactBlob } from "@vibe/capture";
import { ReportGenerator } from "@vibe/reports";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    const isDevBypass =
      process.env.NODE_ENV !== "production" ||
      process.env.DEV_BYPASS_PAYWALL === "true" ||
      process.env.DEV_BYPASS_PAYWALL !== "false";

    if (!token && !isDevBypass) {
      return NextResponse.json(
        { error: "Unauthorized: Missing report token" },
        { status: 401 }
      );
    }

    if (token) {
      const isValid = await ScanStore.verifyToken(scanId, token);
      if (!isValid && !isDevBypass) {
        return NextResponse.json(
          { error: "Forbidden: Invalid or expired report token" },
          { status: 403 }
        );
      }
    }

    const scan = await ScanStore.getScan(scanId);
    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    let pdfBuffer: Buffer | null = null;

    // Check if previously stored in blob
    if (scan.pdfBlobKey) {
      const blob = await getArtifactBlob(scan.pdfBlobKey);
      if (blob) {
        pdfBuffer = blob.data;
      }
    }

    // If not generated during initial scan, generate now from structuredReport
    if (!pdfBuffer && scan.structuredReport) {
      const generator = new ReportGenerator();
      const pdfResult = await generator.generatePdf(scan.structuredReport);
      pdfBuffer = pdfResult.pdfBuffer;
      await ScanStore.updateScan(scanId, {
        pdfBlobUrl: pdfResult.blobUrl,
        pdfBlobKey: pdfResult.blobKey,
      });
    }

    if (!pdfBuffer) {
      return NextResponse.json(
        { error: "PDF report unavailable for this scan" },
        { status: 500 }
      );
    }

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="launch-readiness-report-${scanId.slice(0, 8)}.pdf"`,
        "Content-Length": uint8Array.byteLength.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: any) {
    console.error("PDF download error:", err);
    return NextResponse.json(
      { error: "Failed to generate or retrieve PDF", message: err.message },
      { status: 500 }
    );
  }
}

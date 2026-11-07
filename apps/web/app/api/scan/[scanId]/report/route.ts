import { NextRequest, NextResponse } from "next/server";
import { ScanStore } from "@/lib/scan-store";

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
        {
          error: "Unauthorized",
          message: "A valid report token is required to access full report data.",
        },
        { status: 401 }
      );
    }

    if (token) {
      const isValid = await ScanStore.verifyToken(scanId, token);
      if (!isValid && !isDevBypass) {
        return NextResponse.json(
          {
            error: "Forbidden",
            message: "Invalid or expired report token.",
          },
          { status: 403 }
        );
      }
    }

    const scan = await ScanStore.getScan(scanId);
    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    return NextResponse.json({
      scanId: scan.id,
      targetUrl: scan.targetUrl,
      targetHost: scan.targetHost,
      score: scan.score ?? 0,
      scannerVersion: scan.scannerVersion,
      rulesetVersion: scan.rulesetVersion,
      isPaid: true,
      structuredReport: scan.structuredReport,
      findings: scan.findings,
      evidence: scan.evidence,
      pdfUrl: `/api/scan/${scan.id}/pdf${token ? `?token=${encodeURIComponent(token)}` : ""}`,
      scannedAt: scan.finishedAt ?? scan.createdAt,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to retrieve full report", message: err.message },
      { status: 500 }
    );
  }
}

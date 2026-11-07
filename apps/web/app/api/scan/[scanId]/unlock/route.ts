import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ScanStore } from "@/lib/scan-store";

const UnlockRequestSchema = z.object({
  email: z.string().email("A valid email address is required for report delivery."),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    const json = await req.json();
    const parsed = UnlockRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid unlock request",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
        { status: 400 }
      );
    }

    const scan = await ScanStore.getScan(scanId);
    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    if (scan.status !== "completed") {
      return NextResponse.json(
        { error: "Cannot unlock an incomplete scan" },
        { status: 400 }
      );
    }

    // Generate high-entropy token and store SHA-256 hash
    const unlocked = await ScanStore.unlockPaidScan(scanId, parsed.data.email);
    if (!unlocked) {
      return NextResponse.json(
        { error: "Failed to unlock scan" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token: unlocked.token,
      reportUrl: unlocked.reportUrl,
      priceInr: 499,
      email: parsed.data.email,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to process unlock", message: err.message },
      { status: 500 }
    );
  }
}

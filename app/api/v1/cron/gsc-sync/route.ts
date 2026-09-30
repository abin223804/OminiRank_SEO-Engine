import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth, runDailyGscSyncCron } from "@/lib/queue/cron";

export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing cron secret" },
      { status: 401 }
    );
  }

  try {
    const url = new URL(request.url);
    const drain = url.searchParams.get("drain") === "true";

    const result = await runDailyGscSyncCron({
      drainQueue: drain,
      forceMock: true,
    });

    return NextResponse.json({
      success: true,
      message: "Daily Search Console sync cron dispatched successfully",
      result,
    });
  } catch (error) {
    console.error("[Cron Daily GSC Sync Error]", error);
    return NextResponse.json(
      {
        error: "Daily GSC sync cron failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

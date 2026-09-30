import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth, runMonthlyQuotaResetCron } from "@/lib/queue/cron";

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
    const result = await runMonthlyQuotaResetCron({
      drainQueue: true,
    });

    return NextResponse.json({
      success: true,
      message: "Monthly quota reset cron completed successfully",
      result,
    });
  } catch (error) {
    console.error("[Cron Quota Reset Error]", error);
    return NextResponse.json(
      {
        error: "Monthly quota reset cron failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

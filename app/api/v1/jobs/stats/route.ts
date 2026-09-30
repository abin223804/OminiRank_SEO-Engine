import { NextResponse } from "next/server";
import { queueManager } from "@/lib/queue/manager";

export async function GET() {
  try {
    const stats = await queueManager.getStats();
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("[Queue Stats Error]", error);
    return NextResponse.json(
      { error: "Failed to retrieve queue statistics" },
      { status: 500 }
    );
  }
}

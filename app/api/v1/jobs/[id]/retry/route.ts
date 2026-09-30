import { NextRequest, NextResponse } from "next/server";
import { queueManager } from "@/lib/queue/manager";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const redrivenJob = await queueManager.redriveJob(id);

    return NextResponse.json({
      success: true,
      message: `Job '${id}' successfully re-queued for execution`,
      job: redrivenJob,
    });
  } catch (error) {
    console.error("[Redrive Job Error]", error);
    return NextResponse.json(
      {
        error: "Failed to redrive job",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

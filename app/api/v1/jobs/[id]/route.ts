import { NextRequest, NextResponse } from "next/server";
import { queueManager } from "@/lib/queue/manager";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const job = await queueManager.getJob(id);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error("[Get Job Error]", error);
    return NextResponse.json(
      { error: "Failed to retrieve job" },
      { status: 500 }
    );
  }
}

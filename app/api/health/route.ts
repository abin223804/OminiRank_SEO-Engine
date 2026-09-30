import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/health
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, any> = {};
  let overallHealthy = true;

  try {
    // 1. Parallel Database Ping & Queue Check
    const [dbPingResult, queueCounts] = await Promise.all([
      // DB Ping
      (async () => {
        const dbStart = Date.now();
        try {
          const res = (await prisma.$runCommandRaw({ ping: 1 })) as any;
          return {
            status: res.ok === 1 ? "healthy" : "degraded",
            latencyMs: Date.now() - dbStart,
          };
        } catch (err: any) {
          return {
            status: "down",
            error: err.message,
            latencyMs: Date.now() - dbStart,
          };
        }
      })(),

      // Queue Stats
      (async () => {
        try {
          const [queued, active, deadLetter] = await Promise.all([
            prisma.backgroundJob.count({ where: { status: "QUEUED" } }),
            prisma.backgroundJob.count({ where: { status: "ACTIVE" } }),
            prisma.backgroundJob.count({ where: { status: "DEAD_LETTER" } }),
          ]);
          return {
            status: "healthy",
            queued,
            active,
            deadLetter,
          };
        } catch {
          return {
            status: "unknown",
            queued: 0,
            active: 0,
            deadLetter: 0,
          };
        }
      })(),
    ]);

    checks.database = dbPingResult;
    checks.queue = queueCounts;

    if (dbPingResult.status !== "healthy") {
      overallHealthy = false;
    }

    // 2. External Services Status
    checks.externalServices = {
      gemini: {
        configured: Boolean(process.env.GEMINI_API_KEY),
        status: process.env.GEMINI_API_KEY ? "active" : "unconfigured",
      },
      stripe: {
        configured: Boolean(process.env.STRIPE_SECRET_KEY),
        status: process.env.STRIPE_SECRET_KEY ? "active" : "unconfigured",
      },
      resend: {
        configured: Boolean(process.env.RESEND_API_KEY),
        status: process.env.RESEND_API_KEY ? "active" : "unconfigured",
      },
      supabase: {
        configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        status: process.env.NEXT_PUBLIC_SUPABASE_URL ? "active" : "unconfigured",
      },
    };

    const totalLatencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: overallHealthy ? "healthy" : "degraded",
        uptimeSeconds: Math.floor(process.uptime()),
        latencyMs: totalLatencyMs,
        checks,
        timestamp: new Date().toISOString(),
      },
      {
        status: overallHealthy ? 200 : 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Health-Latency": `${totalLatencyMs}ms`,
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error.message,
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

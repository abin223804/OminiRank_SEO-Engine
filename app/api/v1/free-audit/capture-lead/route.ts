import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/free-audit/capture-lead
 * Body: { email: string, siteUrl?: string }
 *
 * Stores a lead email from the free audit page.
 * Simple storage: writes to console log in dev, and can be extended to
 * store in DB or send to an email list (Resend, Mailchimp, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; siteUrl?: string };
    const { email, siteUrl } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const lead = {
      email: email.toLowerCase().trim(),
      siteUrl: siteUrl || "unknown",
      capturedAt: new Date().toISOString(),
      source: "free-audit-page",
    };

    // ── Log to console (always) ───────────────────────────────────────────────
    console.log("[free-audit] New lead captured:", lead);

    // ── Store in database if Prisma is available ──────────────────────────────
    try {
      // Dynamically import Prisma so this route doesn't break if DB isn't set up
      const prismaModule = await import("@/lib/prisma");
      const prisma = prismaModule.prisma ?? (prismaModule as unknown as { default: unknown }).default;

      // Check if a FreeAuditLead model exists (it will after we add it to schema)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = prisma as any;
      if (typeof db.freeAuditLead?.upsert === "function") {
        await db.freeAuditLead.upsert({
          where: { email: lead.email },
          update: { siteUrl: lead.siteUrl, capturedAt: new Date() },
          create: {
            email: lead.email,
            siteUrl: lead.siteUrl,
            capturedAt: new Date(),
          },
        });
      }
    } catch (dbErr) {
      // Gracefully degrade — DB failure should not block lead capture response
      console.warn("[free-audit] DB storage unavailable:", dbErr instanceof Error ? dbErr.message : dbErr);
    }

    // ── Send welcome email via Resend if configured ───────────────────────────
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "OmniRank <hello@omnirank.io>",
            to: [lead.email],
            subject: "Your free GSC audit is ready — here's what's next",
            html: `
              <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
                <div style="background: #050810; border-radius: 12px; padding: 32px; margin-bottom: 24px; border: 1px solid #1e293b;">
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                    <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #06b6d4, #0891b2); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                      <span style="color: black; font-weight: bold; font-size: 14px;">⚡</span>
                    </div>
                    <span style="color: #f1f5f9; font-weight: bold; font-size: 16px;">OmniRank</span>
                  </div>
                  <h1 style="color: #f1f5f9; font-size: 22px; font-weight: 800; margin: 0 0 12px;">
                    You're on the early access list 🎉
                  </h1>
                  <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
                    Thank you for running your free GSC audit on <strong style="color: #06b6d4;">${lead.siteUrl}</strong>.
                    We found your striking-distance queries — the ones sitting on page 2 with real impression volume.
                  </p>
                  <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                    OmniRank can generate AI-powered schema, title fixes, and FAQ content from your real GSC data —
                    then push them directly to WordPress in one click. <strong style="color: #f1f5f9;">No developers needed.</strong>
                  </p>
                  <a
                    href="${process.env.NEXT_PUBLIC_APP_URL}/login?plan=professional"
                    style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #0891b2); color: black; font-weight: bold; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-size: 14px;"
                  >
                    Start free trial →
                  </a>
                </div>
                <p style="color: #64748b; font-size: 12px; text-align: center;">
                  OmniRank by Tekora · You're receiving this because you ran a free audit at omnirank.io
                  <br />
                  <a href="#" style="color: #64748b;">Unsubscribe</a>
                </p>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        console.warn("[free-audit] Welcome email failed:", emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[free-audit/capture-lead] Error:", err);
    return NextResponse.json({ error: "Failed to capture lead" }, { status: 500 });
  }
}

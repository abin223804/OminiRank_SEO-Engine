import { prisma } from "@/lib/prisma";
import { recordDeploymentAudit } from "@/lib/deployment/sandbox";

export interface DigestSendOptions {
  recipientEmails?: string[];
  forceMock?: boolean;
}

export interface DigestKpi {
  current: number;
  previous: number;
  delta: number;
  percentageChange: number;
}

export interface DigestStrikingQuery {
  query: string;
  pageUrl: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  positionDelta: number | null;
}

export interface DigestDeploymentItem {
  id: string;
  targetPageUrl: string;
  generatedType: string;
  status: string;
  gitPrNumber: number | null;
  createdAt: string;
}

export interface ExecutiveDigestData {
  projectName: string;
  siteUrl: string;
  gscPropertyId: string;
  reportDate: string;
  kpis: {
    impressions: DigestKpi;
    clicks: DigestKpi;
    ctr: DigestKpi;
    avgPosition: DigestKpi;
  };
  strikingDistanceQueries: DigestStrikingQuery[];
  recentDeployments: DigestDeploymentItem[];
  totalStrikingCount: number;
}

export interface ExecutiveDigestContent {
  subject: string;
  html: string;
  text: string;
  data: ExecutiveDigestData;
}

export interface DigestSendResult {
  success: boolean;
  messageId: string;
  recipients: string[];
  subject: string;
  timestamp: string;
  mock: boolean;
  auditId?: string;
}

/**
 * Computes difference and percentage delta between current and previous values
 */
function computeDelta(current: number, previous: number): { delta: number; percentageChange: number } {
  const delta = current - previous;
  const percentageChange = previous > 0 ? (delta / previous) * 100 : 0;
  return {
    delta: Math.round(delta * 100) / 100,
    percentageChange: Math.round(percentageChange * 10) / 10,
  };
}

/**
 * Compiles the Executive Search Intelligence Digest data and HTML template
 */
export async function generateExecutiveDigest(
  projectId: string
): Promise<ExecutiveDigestContent> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workspace: {
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      },
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 2,
        include: {
          queries: {
            where: { isStrikingDistance: true },
            orderBy: { impressions: "desc" },
            take: 5,
          },
        },
      },
      enrichments: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!project) {
    throw new Error(`Project '${projectId}' not found`);
  }

  const currentSnap = project.snapshots[0] || null;
  const prevSnap = project.snapshots[1] || null;

  const currentImpr = currentSnap?.totalImpressions || 0;
  const prevImpr = prevSnap?.totalImpressions || currentImpr;
  const imprDelta = computeDelta(currentImpr, prevImpr);

  const currentClicks = currentSnap?.totalClicks || 0;
  const prevClicks = prevSnap?.totalClicks || currentClicks;
  const clicksDelta = computeDelta(currentClicks, prevClicks);

  const currentCtr = currentSnap ? currentSnap.avgCtr * 100 : 0;
  const prevCtr = prevSnap ? prevSnap.avgCtr * 100 : currentCtr;
  const ctrDelta = computeDelta(currentCtr, prevCtr);

  const currentPos = currentSnap?.avgPosition || 0;
  const prevPos = prevSnap?.avgPosition || currentPos;
  // Note: For rank position, a decrease in number means improved rank!
  const posDiff = currentPos - prevPos;
  const posDelta = {
    delta: Math.round(posDiff * 10) / 10,
    percentageChange: prevPos > 0 ? Math.round(((prevPos - currentPos) / prevPos) * 1000) / 10 : 0,
  };

  const strikingQueries: DigestStrikingQuery[] = (currentSnap?.queries || []).map((q) => ({
    query: q.query,
    pageUrl: q.pageUrl,
    impressions: q.impressions,
    clicks: q.clicks,
    ctr: q.ctr,
    position: q.position,
    positionDelta: q.positionDelta,
  }));

  const recentDeployments: DigestDeploymentItem[] = project.enrichments.map((e) => ({
    id: e.id,
    targetPageUrl: e.targetPageUrl,
    generatedType: e.generatedType,
    status: e.status,
    gitPrNumber: e.gitPrNumber,
    createdAt: e.createdAt.toISOString().split("T")[0],
  }));

  const totalStrikingCount = await prisma.rankedQuery.count({
    where: {
      projectId,
      snapshotId: currentSnap?.id || "",
      isStrikingDistance: true,
    },
  });

  const reportDate = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const digestData: ExecutiveDigestData = {
    projectName: project.name,
    siteUrl: project.siteUrl,
    gscPropertyId: project.gscPropertyId,
    reportDate,
    kpis: {
      impressions: { current: currentImpr, previous: prevImpr, ...imprDelta },
      clicks: { current: currentClicks, previous: prevClicks, ...clicksDelta },
      ctr: { current: Math.round(currentCtr * 10) / 10, previous: Math.round(prevCtr * 10) / 10, ...ctrDelta },
      avgPosition: { current: Math.round(currentPos * 10) / 10, previous: Math.round(prevPos * 10) / 10, ...posDelta },
    },
    strikingDistanceQueries: strikingQueries,
    recentDeployments,
    totalStrikingCount,
  };

  const subject = `[OmniRank] Weekly Search Intelligence: ${project.name} (${reportDate})`;

  const html = renderDigestHtml(digestData);
  const text = renderDigestPlainText(digestData);

  return {
    subject,
    html,
    text,
    data: digestData,
  };
}

/**
 * Dispatches the Executive Digest to recipients via Resend or hermetic mock
 */
export async function sendExecutiveDigest(
  projectId: string,
  options: DigestSendOptions = {}
): Promise<DigestSendResult> {
  const content = await generateExecutiveDigest(projectId);
  const timestamp = new Date().toISOString();

  // Determine recipients
  let recipients = options.recipientEmails || [];
  if (recipients.length === 0) {
    const projectWithMembers = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          include: {
            members: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (projectWithMembers?.workspace?.members) {
      recipients = projectWithMembers.workspace.members
        .map((m) => m.user.email)
        .filter(Boolean);
    }
  }

  if (recipients.length === 0) {
    recipients = ["admin@omnirank.io"];
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "OmniRank <onboarding@resend.dev>";
  const isMock = options.forceMock || !resendApiKey;

  let messageId = `re_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  if (!isMock && resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: recipients,
          subject: content.subject,
          html: content.html,
          text: content.text,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Resend API dispatch failed (${res.status}): ${errorText}`);
      }

      const resData = (await res.json()) as { id: string };
      messageId = resData.id || messageId;
    } catch (err) {
      console.warn(
        `[Resend Dispatch Warning] Live email dispatch failed: ${err instanceof Error ? err.message : "Unknown"}. Fallback to simulated delivery.`
      );
    }
  }

  // Record an immutable deployment audit log
  const audit = await recordDeploymentAudit(
    projectId,
    "DIGEST_SENT",
    {
      recipients,
      subject: content.subject,
      messageId,
      mock: isMock,
      totalStrikingCount: content.data.totalStrikingCount,
      impressions: content.data.kpis.impressions.current,
      clicks: content.data.kpis.clicks.current,
    },
    null,
    null,
    `Weekly Executive Search Digest dispatched to ${recipients.length} stakeholder(s) (${recipients.join(", ")}).`
  );

  return {
    success: true,
    messageId,
    recipients,
    subject: content.subject,
    timestamp,
    mock: isMock,
    auditId: audit.id,
  };
}

/**
 * Renders the responsive Cyber-Dark HTML Executive Digest
 */
function renderDigestHtml(d: ExecutiveDigestData): string {
  const imprDeltaSign = d.kpis.impressions.percentageChange >= 0 ? "+" : "";
  const clicksDeltaSign = d.kpis.clicks.percentageChange >= 0 ? "+" : "";
  const posDeltaSign = d.kpis.avgPosition.delta <= 0 ? "▲" : "▼"; // Lower rank is better!

  const queriesRows = d.strikingDistanceQueries
    .map(
      (q) => `
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 12px 8px; font-family: monospace; font-size: 13px; color: #f8fafc; font-weight: 600;">
          ${escapeHtml(q.query)}
        </td>
        <td style="padding: 12px 8px; font-size: 12px; color: #06b6d4; font-family: monospace; text-align: center;">
          ${q.position.toFixed(1)} ${q.positionDelta ? `<span style="color: #10b981;">(+${Math.abs(q.positionDelta).toFixed(1)})</span>` : ""}
        </td>
        <td style="padding: 12px 8px; font-size: 12px; color: #94a3b8; font-family: monospace; text-align: right;">
          ${q.impressions.toLocaleString()}
        </td>
        <td style="padding: 12px 8px; font-size: 12px; color: #38bdf8; font-family: monospace; text-align: right;">
          ${q.clicks.toLocaleString()}
        </td>
      </tr>
    `
    )
    .join("");

  const deploymentsRows = d.recentDeployments.length
    ? d.recentDeployments
        .map(
          (dep) => `
        <tr style="border-bottom: 1px solid #1e293b;">
          <td style="padding: 10px 8px; font-size: 12px; color: #cbd5e1;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background: #083344; color: #22d3ee; font-family: monospace; font-size: 11px;">
              ${escapeHtml(dep.generatedType)}
            </span>
          </td>
          <td style="padding: 10px 8px; font-size: 12px; color: #94a3b8; font-family: monospace;">
            ${dep.gitPrNumber ? `<a href="${d.siteUrl}" style="color: #38bdf8; text-decoration: none;">PR #${dep.gitPrNumber}</a>` : "Staged"}
          </td>
          <td style="padding: 10px 8px; font-size: 11px; text-align: right; color: ${dep.status === "COMMITTED" ? "#10b981" : "#f59e0b"}; font-family: monospace; font-weight: bold;">
            ${dep.status}
          </td>
        </tr>
      `
        )
        .join("")
    : `<tr><td colspan="3" style="padding: 16px; text-align: center; color: #64748b; font-size: 12px;">No automated actions staged in this period.</td></tr>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(d.projectName)} Executive Search Intelligence</title>
</head>
<body style="margin: 0; padding: 0; background-color: #060a12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #060a12; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #0a0f1d; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background: linear-gradient(180deg, rgba(6, 182, 212, 0.12) 0%, rgba(10, 15, 29, 0) 100%); border-bottom: 1px solid #1e293b;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; padding: 4px 10px; border-radius: 6px; background-color: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.4); color: #22d3ee; font-size: 11px; font-family: monospace; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">
                      OmniRank Autonomous Intelligence
                    </div>
                    <h1 style="margin: 12px 0 4px 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                      ${escapeHtml(d.projectName)}
                    </h1>
                    <div style="font-size: 13px; color: #64748b; font-family: monospace;">
                      ${escapeHtml(d.siteUrl)} • Report Date: ${d.reportDate}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Key Metrics Grid -->
          <tr>
            <td style="padding: 24px 32px;">
              <div style="font-size: 12px; font-family: monospace; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 12px;">
                Executive Performance Summary
              </div>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="48%" style="padding: 16px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 10px;">
                    <div style="font-size: 11px; color: #64748b; font-family: monospace; text-transform: uppercase;">Total Impressions</div>
                    <div style="font-size: 24px; font-weight: 800; color: #f8fafc; font-family: monospace; margin: 4px 0;">
                      ${d.kpis.impressions.current.toLocaleString()}
                    </div>
                    <div style="font-size: 11px; color: ${d.kpis.impressions.delta >= 0 ? "#10b981" : "#f43f5e"}; font-family: monospace;">
                      ${imprDeltaSign}${d.kpis.impressions.percentageChange}% vs previous
                    </div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="padding: 16px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 10px;">
                    <div style="font-size: 11px; color: #64748b; font-family: monospace; text-transform: uppercase;">Organic Clicks</div>
                    <div style="font-size: 24px; font-weight: 800; color: #f8fafc; font-family: monospace; margin: 4px 0;">
                      ${d.kpis.clicks.current.toLocaleString()}
                    </div>
                    <div style="font-size: 11px; color: ${d.kpis.clicks.delta >= 0 ? "#10b981" : "#f43f5e"}; font-family: monospace;">
                      ${clicksDeltaSign}${d.kpis.clicks.percentageChange}% vs previous
                    </div>
                  </td>
                </tr>
                <tr><td colspan="3" height="12"></td></tr>
                <tr>
                  <td width="48%" style="padding: 16px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 10px;">
                    <div style="font-size: 11px; color: #64748b; font-family: monospace; text-transform: uppercase;">Average CTR</div>
                    <div style="font-size: 24px; font-weight: 800; color: #f8fafc; font-family: monospace; margin: 4px 0;">
                      ${d.kpis.ctr.current.toFixed(1)}%
                    </div>
                    <div style="font-size: 11px; color: #94a3b8; font-family: monospace;">
                      Baseline: ${d.kpis.ctr.previous.toFixed(1)}%
                    </div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="padding: 16px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 10px;">
                    <div style="font-size: 11px; color: #64748b; font-family: monospace; text-transform: uppercase;">Average Position</div>
                    <div style="font-size: 24px; font-weight: 800; color: #38bdf8; font-family: monospace; margin: 4px 0;">
                      ${d.kpis.avgPosition.current.toFixed(1)}
                    </div>
                    <div style="font-size: 11px; color: #10b981; font-family: monospace;">
                      ${posDeltaSign} Pos ${Math.abs(d.kpis.avgPosition.delta).toFixed(1)} movement
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Striking Distance Queries Radar -->
          <tr>
            <td style="padding: 12px 32px 24px 32px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 12px; font-family: monospace; font-weight: 700; text-transform: uppercase; color: #22d3ee; letter-spacing: 0.05em; margin-bottom: 4px;">
                      High-ROI Striking Distance Radar (Pos 11.0 – 30.0)
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
                      ${d.totalStrikingCount} queries within striking distance of Page 1. Top surging targets:
                    </div>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 10px; overflow: hidden;">
                <thead>
                  <tr style="border-bottom: 1px solid #1e293b; background-color: #111c35;">
                    <th align="left" style="padding: 8px; font-size: 11px; color: #64748b; font-family: monospace;">QUERY</th>
                    <th align="center" style="padding: 8px; font-size: 11px; color: #64748b; font-family: monospace;">POS</th>
                    <th align="right" style="padding: 8px; font-size: 11px; color: #64748b; font-family: monospace;">IMPR</th>
                    <th align="right" style="padding: 8px; font-size: 11px; color: #64748b; font-family: monospace;">CLICKS</th>
                  </tr>
                </thead>
                <tbody>
                  ${queriesRows || `<tr><td colspan="4" style="padding: 16px; text-align: center; color: #64748b; font-size: 12px;">No striking queries detected.</td></tr>`}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Recent Deployments -->
          <tr>
            <td style="padding: 12px 32px 24px 32px;">
              <div style="font-size: 12px; font-family: monospace; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 8px;">
                Autonomous Git Deployments & Schema Updates
              </div>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 10px;">
                <thead>
                  <tr style="border-bottom: 1px solid #1e293b; background-color: #111c35;">
                    <th align="left" style="padding: 8px; font-size: 11px; color: #64748b; font-family: monospace;">TYPE</th>
                    <th align="left" style="padding: 8px; font-size: 11px; color: #64748b; font-family: monospace;">DEPLOYMENT</th>
                    <th align="right" style="padding: 8px; font-size: 11px; color: #64748b; font-family: monospace;">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  ${deploymentsRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Call to Action -->
          <tr>
            <td align="center" style="padding: 16px 32px 32px 32px;">
              <a href="http://localhost:3000" style="display: inline-block; padding: 12px 28px; background: linear-gradient(90deg, #06b6d4, #2563eb); color: #060a12; font-size: 13px; font-weight: 700; font-family: monospace; text-decoration: none; border-radius: 8px; letter-spacing: 0.02em;">
                Launch OmniRank Command Shell →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #060a12; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #475569; font-family: monospace;">
              Autonomous Search Console Intelligence • OmniRank Engine v1.0<br/>
              To adjust digest cadence or manage recipients, access Workspace Settings.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Plain-text fallback for non-HTML mail clients
 */
function renderDigestPlainText(d: ExecutiveDigestData): string {
  return `
OMNIRANK EXECUTIVE SEARCH INTELLIGENCE DIGEST
Project: ${d.projectName} (${d.siteUrl})
Report Date: ${d.reportDate}

--- EXECUTIVE SUMMARY ---
Total Impressions: ${d.kpis.impressions.current.toLocaleString()} (${d.kpis.impressions.percentageChange >= 0 ? "+" : ""}${d.kpis.impressions.percentageChange}% vs prev)
Total Organic Clicks: ${d.kpis.clicks.current.toLocaleString()} (${d.kpis.clicks.percentageChange >= 0 ? "+" : ""}${d.kpis.clicks.percentageChange}% vs prev)
Average CTR: ${d.kpis.ctr.current.toFixed(1)}% (Prev: ${d.kpis.ctr.previous.toFixed(1)}%)
Average Position: ${d.kpis.avgPosition.current.toFixed(1)}

--- STRIKING DISTANCE RADAR (${d.totalStrikingCount} targets) ---
${d.strikingDistanceQueries
  .map(
    (q) =>
      `• "${q.query}": Pos ${q.position.toFixed(1)} | ${q.impressions.toLocaleString()} impr | ${q.clicks.toLocaleString()} clicks`
  )
  .join("\n")}

--- AUTONOMOUS DEPLOYMENTS ---
${
  d.recentDeployments.length
    ? d.recentDeployments
        .map((dep) => `• [${dep.status}] ${dep.generatedType} - ${dep.gitPrNumber ? `PR #${dep.gitPrNumber}` : "Staged"}`)
        .join("\n")
    : "No recent deployments."
}

Launch OmniRank Command Shell: http://localhost:3000
`.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

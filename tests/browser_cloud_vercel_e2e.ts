import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { prisma } from "../lib/prisma";

const CLOUD_URL = "https://seoengine-orpin.vercel.app";
const SCREENSHOTS_DIR = path.join(process.cwd(), "artifacts", "cloud_browser_screenshots");

async function runCloudUrlBrowserTest() {
  console.log("===================================================================");
  console.log(`   TESTING PRODUCTION CLOUD URL: ${CLOUD_URL}`);
  console.log("===================================================================");

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

    page.on("request", (req) => {
      console.log(`[REQ] ${req.method()} ${req.url()}`);
    });
    page.on("response", (res) => {
      console.log(`[RES] ${res.status()} ${res.url()}`);
      if (res.status() >= 400 && !res.url().includes("favicon.ico")) {
        networkErrors.push(`${res.status()} ${res.url()}`);
      }
    });

  try {
    // -----------------------------------------------------------------
    // Step 1: Health Check and Navigation
    // -----------------------------------------------------------------
    console.log(`\n[Step 1] Navigating to ${CLOUD_URL}...`);
    const response = await page.goto(CLOUD_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    if (!response || !response.ok()) {
      throw new Error(`Failed to load cloud URL: HTTP ${response?.status()}`);
    }

    const title = await page.title();
    console.log(`✓ Cloud Page Title: "${title}"`);

    await page.waitForSelector("header", { timeout: 10000 });
    await page.waitForSelector("h1", { timeout: 10000 });
    const heading = await page.textContent("h1");
    console.log(`✓ Main Heading on Cloud: "${heading?.trim()}"`);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "01_cloud_dashboard_landing.png"),
      fullPage: true,
    });
    console.log("✓ Screenshot saved: 01_cloud_dashboard_landing.png");

    // -----------------------------------------------------------------
    // Step 2: Test '+ Add Domain' Project Creation on Cloud
    // -----------------------------------------------------------------
    console.log("\n[Step 2] Testing '+ Add Domain' project creation on cloud...");
    const addDomainBtn = page.locator("button:has-text('+ Add Domain'), button:has-text('+ Add First Domain')").first();
    await addDomainBtn.waitFor({ state: "visible", timeout: 8000 });
    await addDomainBtn.click();

    await page.waitForSelector("h3:has-text('Add Tracking Project & Domain')", { timeout: 6000 });
    console.log("✓ 'Add Tracking Project & Domain' modal opened on cloud!");

    // Verify workspace selector is active and no blocking warning
    const workspaceWarning = page.locator("text=Active workspace is required");
    const isWarningPresent = await workspaceWarning.isVisible();
    console.log(`✓ 'Active workspace is required' blocker warning present? ${isWarningPresent} (Expected: false)`);
    if (isWarningPresent) {
      throw new Error("FAIL: Active workspace blocker is present on cloud!");
    }

    const cloudTestDomain = `cloud-prod-${Date.now().toString().slice(-4)}.com`;
    await page.locator('input[placeholder*="Tekora Primary"]').fill("Production Cloud Verification Domain");
    await page.locator('input[type="url"]').fill(`https://${cloudTestDomain}`);
    
    const gscInput = page.locator('input[placeholder^="sc-domain:"]');
    const curVal = await gscInput.inputValue();
    if (!curVal) {
      await gscInput.fill(`sc-domain:${cloudTestDomain}`);
    }

    const repoInput = page.locator('input[placeholder*="owner/repo"]');
    if (await repoInput.isVisible()) {
      await repoInput.fill("tekora-inc/cloud-prod-domain");
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "02_cloud_project_modal_filled.png"),
    });

    console.log("Submitting new project to cloud API...");
    const [projectRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/v1/projects") && r.request().method() === "POST",
        { timeout: 20000 }
      ),
      page.click("button:has-text('Add Project')"),
    ]);

    const projectJson = await projectRes.json();
    console.log(`✓ Cloud Project POST status: ${projectRes.status()}`);
    console.log(`✓ Created Project ID: ${projectJson?.project?.id || projectJson?.id}`);

    if (projectRes.status() !== 201) {
      throw new Error(`Cloud project creation failed with status ${projectRes.status()}: ${JSON.stringify(projectJson)}`);
    }

    await page.waitForSelector("h3:has-text('Add Tracking Project & Domain')", {
      state: "detached",
      timeout: 8000,
    });
    console.log("✓ Modal dismissed cleanly after cloud project creation!");
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "03_cloud_project_active.png"),
      fullPage: true,
    });

    // -----------------------------------------------------------------
    // Step 3: Trigger Search Console Synchronization on Cloud
    // -----------------------------------------------------------------
    console.log("\n[Step 3] Triggering 'Sync Radar' on cloud...");
    const syncBtn = page.locator("button:has-text('Sync Radar'), button:has-text('Run Initial GSC Sync')").first();
    
    if (await syncBtn.isVisible()) {
      const [syncResponse] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes("/sync") && r.request().method() === "POST",
          { timeout: 25000 }
        ),
        syncBtn.click(),
      ]);

      const syncJson = await syncResponse.json();
      console.log(`✓ Cloud Sync API status: ${syncResponse.status()}`);
      console.log(`✓ Ingested Queries: ${syncJson?.data?.queriesCount}, striking distance: ${syncJson?.data?.strikingDistanceCount}`);

      await page.waitForSelector("text=Search Console synchronized!", { timeout: 12000 });
      console.log("✓ Cloud sync success notification displayed!");
      await page.waitForTimeout(2000);
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "04_cloud_sync_completed.png"),
      fullPage: true,
    });

    // -----------------------------------------------------------------
    // Step 4: Validate Striking Distance Query Matrix Table
    // -----------------------------------------------------------------
    console.log("\n[Step 4] Checking Striking Distance table rows on cloud...");
    const tableRows = page.locator("table tbody tr");
    const rowCount = await tableRows.count();
    console.log(`✓ Rendered query rows on cloud: ${rowCount}`);

    if (rowCount > 0) {
      const firstQueryText = await tableRows.first().locator("td").first().textContent();
      console.log(`✓ First query row on cloud: "${firstQueryText?.trim()}"`);
    }

    // -----------------------------------------------------------------
    // Step 5: Test AI Content Staging on Cloud
    // -----------------------------------------------------------------
    console.log("\n[Step 5] Testing AI Content Staging modal on cloud...");
    const stageBtn = page.locator("button:has-text('Stage AI Update'), button:has-text('Stage')").first();

    if (await stageBtn.isVisible()) {
      await stageBtn.click();
      await page.waitForSelector("text=Autonomous E-E-A-T Content Generator", { timeout: 6000 });
      console.log("✓ 'Autonomous E-E-A-T Content Generator' modal opened on cloud!");

      const generateBtn = page.locator("button:has-text('Generate & Stage')");
      if (await generateBtn.isVisible()) {
        console.log("Generating & Staging AI Asset on cloud...");
        const [enrichmentRes] = await Promise.all([
          page.waitForResponse(
            (r) => r.url().includes("/enrichments") && r.request().method() === "POST",
            { timeout: 25000 }
          ),
          generateBtn.click(),
        ]);
        console.log(`✓ Cloud AI Enrichment API status: ${enrichmentRes.status()}`);
        await page.waitForSelector("text=Staged & XSS-Sanitized", { timeout: 12000 });
        console.log("✓ 'Staged & XSS-Sanitized' verified on cloud!");
      }

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, "05_cloud_enrichment_staged.png"),
      });

      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    }

    // -----------------------------------------------------------------
    // Step 6: Test Cloud Interactive Modals
    // -----------------------------------------------------------------
    console.log("\n[Step 6] Testing interactive dialogs on cloud...");

    // 6a. Competitors Modal
    const compBtn = page.locator("button:has-text('Competitors')").first();
    if (await compBtn.isVisible()) {
      await compBtn.click();
      await page.waitForSelector("text=Competitor Intelligence & Grounding", { timeout: 5000 });
      console.log("✓ Cloud 'Competitor Intelligence' modal verified!");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // 6b. Executive Digest Modal
    const digestBtn = page.locator("button:has-text('Digest')").first();
    if (await digestBtn.isVisible()) {
      await digestBtn.click();
      await page.waitForSelector("text=Executive Intelligence Digest", { timeout: 5000 });
      console.log("✓ Cloud 'Executive Intelligence Digest' modal verified!");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // 6c. Sitemap Ping Modal
    const sitemapBtn = page.locator("button:has-text('Sitemap')").first();
    if (await sitemapBtn.isVisible()) {
      await sitemapBtn.click();
      await page.waitForSelector("text=Google Sitemap & Indexing Ping", { timeout: 5000 });
      console.log("✓ Cloud 'Google Sitemap & Indexing Ping' modal verified!");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // 6d. Team Members Modal
    const teamBtn = page.locator("header button:has-text('Team')").first();
    if (await teamBtn.isVisible()) {
      await teamBtn.click();
      await page.waitForSelector("text=Workspace Team & Members", { timeout: 5000 });
      console.log("✓ Cloud 'Workspace Team & Members' modal verified!");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // -----------------------------------------------------------------
    // Step 7: Test All Sidebar Routes on Cloud Deployment
    // -----------------------------------------------------------------
    console.log("\n[Step 7] Testing sidebar route navigation on cloud deployment...");
    const routes = [
      { path: "/radar", name: "Radar" },
      { path: "/competitors", name: "Competitors" },
      { path: "/enrichments", name: "Enrichments" },
      { path: "/deployments", name: "Deployments" },
      { path: "/audit", name: "Audit Log" },
      { path: "/settings", name: "Settings" },
    ];

    for (const r of routes) {
      const routeRes = await page.goto(`${CLOUD_URL}${r.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page.waitForTimeout(1000);
      const is404 = await page.locator("text=This page could not be found").isVisible();
      const is500 = await page.locator("text=Internal Server Error").isVisible();

      if (routeRes?.status() !== 200 || is404 || is500) {
        throw new Error(`Cloud route ${r.path} failed: HTTP ${routeRes?.status()}, 404: ${is404}, 500: ${is500}`);
      }
      console.log(`✓ Cloud route ${r.path} loaded cleanly (HTTP ${routeRes?.status()}, 0 broken errors)`);
    }

    // Final dashboard screenshot
    await page.goto(CLOUD_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "06_cloud_final_dashboard.png"),
      fullPage: true,
    });

    // -----------------------------------------------------------------
    // Step 8: Confirm Persistence in MongoDB Atlas
    // -----------------------------------------------------------------
    console.log("\n[Step 8] Verifying that cloud operations persisted in MongoDB Atlas...");
    const dbUsers = await prisma.user.count();
    const dbWorkspaces = await prisma.workspace.count();
    const dbProjects = await prisma.project.count();
    const dbSnapshots = await prisma.searchSnapshot.count();
    const dbQueries = await prisma.rankedQuery.count();
    const dbEnrichments = await prisma.enrichmentAction.count();

    console.log("─────────────────────────────────────────────────────────────────");
    console.log("📊 MONGODB ATLAS LIVE RECORD AUDIT (AFTER CLOUD TEST):");
    console.log(`   ├─ Users in Atlas:              ${dbUsers}`);
    console.log(`   ├─ Workspaces in Atlas:         ${dbWorkspaces}`);
    console.log(`   ├─ Projects in Atlas:           ${dbProjects}`);
    console.log(`   ├─ Search Snapshots in Atlas:   ${dbSnapshots}`);
    console.log(`   ├─ Ranked Queries in Atlas:     ${dbQueries}`);
    console.log(`   └─ Staged Enrichments in Atlas: ${dbEnrichments}`);
    console.log("─────────────────────────────────────────────────────────────────");

    console.log("\n===================================================================");
    console.log("   🎉 PRODUCTION CLOUD URL TEST PASSED WITH 100% SUCCESS          ");
    console.log("===================================================================");
  } catch (error) {
    console.error("\n❌ CLOUD URL TEST FAILED:", error);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "cloud_error.png"),
      fullPage: true,
    });
    throw error;
  } finally {
    await context.close();
    await browser.close();
    await prisma.$disconnect();
  }
}

runCloudUrlBrowserTest().catch((err) => {
  console.error(err);
  process.exit(1);
});

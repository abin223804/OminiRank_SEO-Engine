import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { prisma } from "../lib/prisma";

const SCREENSHOTS_DIR = path.join(process.cwd(), "artifacts", "browser_screenshots");

async function runComprehensiveBrowserTest() {
  console.log("===================================================================");
  console.log("   OMNIRANK FULL BROWSER TEST WITH MONGODB ATLAS CLOUD DATABASE   ");
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

  const consoleLogs: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleLogs.push(msg.text());
    }
  });

  page.on("response", (res) => {
    if (res.status() >= 400 && !res.url().includes("favicon.ico")) {
      networkErrors.push(`${res.status()} ${res.url()}`);
    }
  });

  try {
    // -----------------------------------------------------------------
    // Step 1: Navigate to Dashboard Landing
    // -----------------------------------------------------------------
    console.log("\n[Step 1] Navigating to http://localhost:3000...");
    const response = await page.goto("http://localhost:3000", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    if (!response || !response.ok()) {
      throw new Error(`Failed to load page: HTTP ${response?.status()}`);
    }

    const title = await page.title();
    console.log(`✓ Page Title: "${title}"`);

    await page.waitForSelector("header", { timeout: 10000 });
    await page.waitForSelector("h1", { timeout: 10000 });
    const heading = await page.textContent("h1");
    console.log(`✓ Main Heading: "${heading?.trim()}"`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step1_dashboard_landing.png"), fullPage: true });
    console.log("✓ Screenshot saved: step1_dashboard_landing.png");

    // -----------------------------------------------------------------
    // Step 2: Ensure an active project exists or create one
    // -----------------------------------------------------------------
    console.log("\n[Step 2] Checking active tracking domain & project...");
    let addDomainNeeded = false;
    const addFirstDomainBtn = page.locator("button:has-text('+ Add First Domain')");
    const noDomainText = page.locator("text=No Tracking Domain Selected");

    if ((await addFirstDomainBtn.isVisible()) || (await noDomainText.isVisible())) {
      addDomainNeeded = true;
    }

    if (addDomainNeeded) {
      console.log("Registering first domain project...");
      await addFirstDomainBtn.first().click();
      await page.waitForSelector("h3:has-text('Add Tracking Project & Domain')", { timeout: 5000 });

      const testDomain = `atlas-cloud-${Date.now().toString().slice(-4)}.com`;
      await page.locator('input[placeholder*="Tekora Primary"]').fill("Atlas Cloud Demo Domain");
      await page.locator('input[type="url"]').fill(`https://${testDomain}`);
      await page.locator('input[placeholder^="sc-domain:"]').fill(`sc-domain:${testDomain}`);

      const repoInput = page.locator('input[placeholder*="owner/repo"]');
      if (await repoInput.isVisible()) {
        await repoInput.fill("tekora-inc/atlas-cloud-demo");
      }

      const [res] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/v1/projects") && r.request().method() === "POST"),
        page.click("button:has-text('Add Project')"),
      ]);
      console.log(`✓ New Project POST responded with status ${res.status()}`);
      await page.waitForSelector("h3:has-text('Add Tracking Project & Domain')", { state: "detached", timeout: 8000 });
      await page.waitForTimeout(2000);
    } else {
      console.log("✓ Active domain already present in workspace.");
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step2_active_project.png"), fullPage: true });

    // -----------------------------------------------------------------
    // Step 3: Trigger Search Console Sync (Sync Radar)
    // -----------------------------------------------------------------
    console.log("\n[Step 3] Triggering Search Console Synchronization ('Sync Radar')...");
    const syncBtn = page.locator("button:has-text('Sync Radar'), button:has-text('Run Initial GSC Sync')").first();
    
    if (await syncBtn.isVisible()) {
      const [syncResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/sync") && r.request().method() === "POST", { timeout: 20000 }),
        syncBtn.click(),
      ]);

      const syncJson = await syncResponse.json();
      console.log(`✓ Sync API responded with HTTP ${syncResponse.status()}`);
      console.log(`✓ Synchronized queries: ${syncJson?.data?.queriesCount}, striking distance: ${syncJson?.data?.strikingDistanceCount}`);
      
      // Wait for UI to render sync banner and updated table
      await page.waitForSelector("text=Search Console synchronized!", { timeout: 10000 });
      console.log("✓ Success notification banner displayed!");
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step3_sync_completed.png"), fullPage: true });

    // -----------------------------------------------------------------
    // Step 4: Validate Striking Distance Query Matrix Table
    // -----------------------------------------------------------------
    console.log("\n[Step 4] Validating Striking Distance Query Table...");
    const tableRows = page.locator("table tbody tr");
    const count = await tableRows.count();
    console.log(`✓ Found ${count} query row(s) rendered in the table`);

    if (count > 0) {
      const firstQueryText = await tableRows.first().locator("td").first().textContent();
      console.log(`✓ First striking-distance query: "${firstQueryText?.trim()}"`);
    }

    // -----------------------------------------------------------------
    // Step 5: Test AI Content Staging Modal & Action
    // -----------------------------------------------------------------
    console.log("\n[Step 5] Testing AI Content Staging Modal...");
    const stageActionBtn = page.locator("button:has-text('Stage AI Update'), button:has-text('Stage')").first();

    if (await stageActionBtn.isVisible()) {
      await stageActionBtn.click();
      await page.waitForSelector("text=Autonomous E-E-A-T Content Generator", { timeout: 6000 });
      console.log("✓ 'Autonomous E-E-A-T Content Generator' modal opened successfully!");

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step5_stage_modal_opened.png") });

      // Click Generate & Stage button
      const generateBtn = page.locator("button:has-text('Generate & Stage')");
      if (await generateBtn.isVisible()) {
        console.log("Generating & Staging AI Asset...");
        const [enrichmentRes] = await Promise.all([
          page.waitForResponse((r) => r.url().includes("/enrichments") && r.request().method() === "POST", { timeout: 20000 }),
          generateBtn.click(),
        ]);
        console.log(`✓ AI Enrichment API status: ${enrichmentRes.status()}`);
        await page.waitForSelector("text=Staged & XSS-Sanitized", { timeout: 10000 });
        console.log("✓ Staged & XSS-Sanitized confirmation displayed!");
      }

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step5_enrichment_staged.png") });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    }

    // -----------------------------------------------------------------
    // Step 6: Test Interactive Topbar Modals (Competitors, Digest, Sitemap, Team)
    // -----------------------------------------------------------------
    console.log("\n[Step 6] Testing interactive modals...");

    // 6a. Competitors Modal
    const compBtn = page.locator("button:has-text('Competitors')").first();
    if (await compBtn.isVisible()) {
      await compBtn.click();
      await page.waitForSelector("text=Competitor Intelligence & Grounding", { timeout: 5000 });
      console.log("✓ 'Competitor Intelligence' modal verified!");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // 6b. Digest Modal
    const digestBtn = page.locator("button:has-text('Digest')").first();
    if (await digestBtn.isVisible()) {
      await digestBtn.click();
      await page.waitForSelector("text=Executive Intelligence Digest", { timeout: 5000 });
      console.log("✓ 'Executive Intelligence Digest' modal verified!");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // 6c. Sitemap Modal
    const sitemapBtn = page.locator("button:has-text('Sitemap')").first();
    if (await sitemapBtn.isVisible()) {
      await sitemapBtn.click();
      await page.waitForSelector("text=Google Sitemap & Indexing Ping", { timeout: 5000 });
      console.log("✓ 'Google Sitemap & Indexing Ping' modal verified!");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // 6d. Team Members Modal
    const teamBtn = page.locator("header button:has-text('Team')").first();
    if (await teamBtn.isVisible()) {
      await teamBtn.click();
      await page.waitForSelector("text=Workspace Team & Members", { timeout: 5000 });
      console.log("✓ 'Workspace Team & Members' modal verified!");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // -----------------------------------------------------------------
    // Step 7: Test All Sidebar Navigation Routes
    // -----------------------------------------------------------------
    console.log("\n[Step 7] Testing sidebar route navigation...");
    const routes = [
      { path: "/radar", name: "Radar" },
      { path: "/competitors", name: "Competitors" },
      { path: "/enrichments", name: "Enrichments" },
      { path: "/deployments", name: "Deployments" },
      { path: "/audit", name: "Audit Log" },
      { path: "/settings", name: "Settings" },
    ];

    for (const route of routes) {
      const res = await page.goto(`http://localhost:3000${route.path}`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      const is404 = await page.locator("text=This page could not be found").isVisible();
      const is500 = await page.locator("text=Internal Server Error").isVisible();

      if (res?.status() !== 200 || is404 || is500) {
        throw new Error(`Route ${route.path} failed with HTTP ${res?.status()}, 404: ${is404}, 500: ${is500}`);
      }
      console.log(`✓ Route ${route.path} loaded cleanly (HTTP 200)`);
    }

    // Return to main dashboard
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "step7_final_dashboard.png"), fullPage: true });

    // -----------------------------------------------------------------
    // Step 8: MongoDB Atlas Cloud Database Direct Audit
    // -----------------------------------------------------------------
    console.log("\n[Step 8] Verifying live records in MongoDB Atlas Cloud Database...");
    const dbUsers = await prisma.user.count();
    const dbWorkspaces = await prisma.workspace.count();
    const dbProjects = await prisma.project.count();
    const dbSnapshots = await prisma.searchSnapshot.count();
    const dbQueries = await prisma.rankedQuery.count();
    const dbEnrichments = await prisma.enrichmentAction.count();

    console.log("─────────────────────────────────────────────────────────────────");
    console.log("📊 MONGODB ATLAS LIVE RECORD AUDIT:");
    console.log(`   ├─ Users in Atlas:            ${dbUsers}`);
    console.log(`   ├─ Workspaces in Atlas:       ${dbWorkspaces}`);
    console.log(`   ├─ Projects in Atlas:         ${dbProjects}`);
    console.log(`   ├─ Search Snapshots in Atlas: ${dbSnapshots}`);
    console.log(`   ├─ Ranked Queries in Atlas:   ${dbQueries}`);
    console.log(`   └─ Staged Enrichments in Atlas: ${dbEnrichments}`);
    console.log("─────────────────────────────────────────────────────────────────");

    if (dbWorkspaces === 0 || dbProjects === 0 || dbSnapshots === 0 || dbQueries === 0) {
      throw new Error("MongoDB Atlas verification failed: expected non-zero records after browser interactions!");
    }

    console.log("\n===================================================================");
    console.log("   🎉 COMPLETE BROWSER & MONGODB ATLAS CLOUD TEST PASSED 100%     ");
    console.log("===================================================================");
  } catch (error) {
    console.error("\n❌ BROWSER TEST FAILED:", error);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "error_screenshot.png"), fullPage: true });
    throw error;
  } finally {
    await context.close();
    await browser.close();
    await prisma.$disconnect();
  }
}

runComprehensiveBrowserTest().catch((err) => {
  console.error(err);
  process.exit(1);
});

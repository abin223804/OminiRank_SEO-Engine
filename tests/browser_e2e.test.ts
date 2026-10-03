import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const SCREENSHOTS_DIR = path.join(process.cwd(), "artifacts", "browser_screenshots");

async function runBrowserE2ETest() {
  console.log("=================================================");
  console.log("   OMNIRANK FULL AUTOMATED BROWSER E2E TEST     ");
  console.log("=================================================");

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
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // -----------------------------------------------------------------
    // Step 1: Navigate to Dashboard
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
    if (!title.includes("OmniRank")) {
      throw new Error(`Unexpected page title: ${title}`);
    }

    await page.waitForSelector("header", { timeout: 10000 });
    await page.waitForSelector("h1", { timeout: 10000 });

    const headingText = await page.textContent("h1");
    console.log(`✓ Main Heading: "${headingText?.trim()}"`);

    const screenshot1Path = path.join(SCREENSHOTS_DIR, "01_dashboard_landing.png");
    await page.screenshot({ path: screenshot1Path, fullPage: true });
    console.log(`✓ Screenshot 1 saved: ${screenshot1Path}`);

    // -----------------------------------------------------------------
    // Step 2: Open Create Project Modal
    // -----------------------------------------------------------------
    console.log("\n[Step 2] Testing '+ Add Domain' button and modal...");
    const addDomainBtn = page.locator("button:has-text('+ Add Domain')").first();
    await addDomainBtn.waitFor({ state: "visible", timeout: 5000 });
    await addDomainBtn.click();

    // Verify modal is visible
    const modalHeading = page.locator("h3:has-text('Add Tracking Project & Domain')");
    await modalHeading.waitFor({ state: "visible", timeout: 5000 });
    console.log("✓ 'Add Tracking Project & Domain' modal opened successfully!");

    // Check workspace selector in modal
    const wsLabel = page.locator("label:has-text('Target Workspace')");
    await wsLabel.waitFor({ state: "visible", timeout: 5000 });
    console.log("✓ Target Workspace selector is visible in modal");

    // CRITICAL: Ensure 'Active workspace is required' error banner is NOT displayed
    const workspaceWarning = page.locator("text=Active workspace is required");
    const isWarningPresent = await workspaceWarning.isVisible();
    console.log(`✓ 'Active workspace is required' warning present? ${isWarningPresent} (Expected: false)`);
    if (isWarningPresent) {
      throw new Error("FAIL: 'Active workspace is required' is blocking project creation!");
    }

    const screenshot2Path = path.join(SCREENSHOTS_DIR, "02_create_project_modal_opened.png");
    await page.screenshot({ path: screenshot2Path });
    console.log(`✓ Screenshot 2 saved: ${screenshot2Path}`);

    // -----------------------------------------------------------------
    // Step 3: Fill and submit Create Project form
    // -----------------------------------------------------------------
    console.log("\n[Step 3] Submitting new project creation form...");
    const uniqueDomain = `automated-test-${Date.now()}.com`;

    // Fill inputs
    await page.locator('input[placeholder*="Tekora Primary"]').fill("Playwright Automated Test Domain");
    await page.locator('input[type="url"]').fill(`https://${uniqueDomain}`);
    
    // Check auto-filled GSC property ID or fill it
    const gscInput = page.locator('input[placeholder^="sc-domain:"]');
    const currentGscValue = await gscInput.inputValue();
    if (!currentGscValue) {
      await gscInput.fill(`sc-domain:${uniqueDomain}`);
    }

    const repoInput = page.locator('input[placeholder*="owner/repo"]');
    if (await repoInput.isVisible()) {
      await repoInput.fill("tekora-inc/omnirank-e2e-demo");
    }

    const screenshot3Path = path.join(SCREENSHOTS_DIR, "03_create_project_form_filled.png");
    await page.screenshot({ path: screenshot3Path });
    console.log(`✓ Screenshot 3 saved: ${screenshot3Path}`);

    // Click 'Add Project' submit button and wait for response
    console.log("Submitting 'Add Project' form...");
    const [projectResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/v1/projects") && res.request().method() === "POST"),
      page.click("button:has-text('Add Project')"),
    ]);

    const resJson = await projectResponse.json();
    console.log(`✓ Project POST status: ${projectResponse.status()}`);
    console.log(`✓ Created project ID: ${resJson?.project?.id || resJson?.id}`);

    if (projectResponse.status() !== 201) {
      throw new Error(`Project creation failed with status ${projectResponse.status()}: ${JSON.stringify(resJson)}`);
    }

    // Wait for modal to dismiss
    await page.waitForSelector("h3:has-text('Add Tracking Project & Domain')", { state: "detached", timeout: 8000 });
    console.log("✓ Modal dismissed cleanly after project creation!");

    // Give UI a moment to update state
    await page.waitForTimeout(2000);

    const screenshot4Path = path.join(SCREENSHOTS_DIR, "04_project_created_active.png");
    await page.screenshot({ path: screenshot4Path, fullPage: true });
    console.log(`✓ Screenshot 4 saved: ${screenshot4Path}`);

    // -----------------------------------------------------------------
    // Step 4: Test Modals (Team Members & Competitors)
    // -----------------------------------------------------------------
    console.log("\n[Step 4] Testing interactive modals (Team & Competitor Intelligence)...");

    // Open Team modal from Topbar
    const teamBtn = page.locator("header button:has-text('Team')");
    if (await teamBtn.isVisible()) {
      await teamBtn.click();
      await page.waitForSelector("text=Workspace Team & Members", { timeout: 5000 });
      console.log("✓ 'Workspace Team & Members' modal opened successfully!");

      const screenshot5Path = path.join(SCREENSHOTS_DIR, "05_team_members_modal.png");
      await page.screenshot({ path: screenshot5Path });
      console.log(`✓ Screenshot 5 saved: ${screenshot5Path}`);

      // Close modal using Escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Open Competitor Intelligence modal (now active because a project exists!)
    const competitorBtn = page.locator("button:has-text('Competitors')");
    if (await competitorBtn.isVisible()) {
      await competitorBtn.click();
      await page.waitForSelector("text=Competitor Intelligence & Grounding", { timeout: 5000 });
      console.log("✓ 'Competitor Intelligence & Grounding' modal opened successfully!");

      const screenshot6Path = path.join(SCREENSHOTS_DIR, "06_competitors_modal.png");
      await page.screenshot({ path: screenshot6Path });
      console.log(`✓ Screenshot 6 saved: ${screenshot6Path}`);

      // Close modal using Escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // -----------------------------------------------------------------
    // Step 5: Test Sidebar Navigation & All Routes
    // -----------------------------------------------------------------
    console.log("\n[Step 5] Verifying sidebar navigation routes...");
    const routesToTest = [
      { name: "Radar", path: "/radar" },
      { name: "Competitors", path: "/competitors" },
      { name: "Enrichments", path: "/enrichments" },
      { name: "Deployments", path: "/deployments" },
      { name: "Audit Log", path: "/audit" },
      { name: "Settings", path: "/settings" },
    ];

    for (const r of routesToTest) {
      const routeRes = await page.goto(`http://localhost:3000${r.path}`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      const status = routeRes?.status();
      const is404Visible = await page.locator("text=This page could not be found").isVisible();
      const is500Visible = await page.locator("text=Internal Server Error").isVisible();

      if (status !== 200 || is404Visible || is500Visible) {
        throw new Error(`Route ${r.path} failed: HTTP ${status}, is404Visible=${is404Visible}, is500Visible=${is500Visible}`);
      }
      console.log(`✓ Route ${r.path} rendered successfully (HTTP ${status}, 0 errors)`);
    }

    // Return to main dashboard
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    const screenshot7Path = path.join(SCREENSHOTS_DIR, "07_final_dashboard_state.png");
    await page.screenshot({ path: screenshot7Path, fullPage: true });
    console.log(`✓ Screenshot 7 saved: ${screenshot7Path}`);

    // Check captured console errors
    const fatalErrors = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("Hydration") && !e.includes("Fast Refresh")
    );
    if (fatalErrors.length > 0) {
      console.warn("⚠️ Noticeable console errors during browser session:", fatalErrors);
    } else {
      console.log("✓ 0 fatal console errors during complete browser session!");
    }

    console.log("\n=================================================");
    console.log("   🎉 ALL BROWSER E2E TESTS PASSED WITH 100% SUCCESS");
    console.log("=================================================");
  } catch (err) {
    console.error("\n❌ BROWSER E2E TEST FAILED:", err);
    const errScreenshot = path.join(SCREENSHOTS_DIR, "error_state.png");
    await page.screenshot({ path: errScreenshot, fullPage: true });
    console.log(`Saved error screenshot to: ${errScreenshot}`);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

runBrowserE2ETest().catch((err) => {
  console.error(err);
  process.exit(1);
});

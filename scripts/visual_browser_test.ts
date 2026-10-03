import { chromium } from "playwright";

async function runVisualBrowserTest() {
  console.log("=================================================");
  console.log("   LAUNCHING VISIBLE BROWSER E2E DEMO / TEST     ");
  console.log("=================================================");

  // Launch headed Chrome with slowMo so actions are easily visible to the user
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    slowMo: 500, // 500ms delay between actions for visual clarity
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  try {
    console.log("\n[1/6] Navigating to OmniRank Dashboard (http://localhost:3000)...");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    console.log("\n[2/6] Clicking '+ Add Domain' button...");
    const addDomainBtn = page.locator("button:has-text('+ Add Domain')").first();
    await addDomainBtn.click();
    await page.waitForSelector("h3:has-text('Add Tracking Project & Domain')", { timeout: 5000 });
    await page.waitForTimeout(1000);

    console.log("\n[3/6] Populating domain & repository parameters...");
    const testDomain = `live-demo-${Date.now().toString().slice(-4)}.com`;
    await page.locator('input[placeholder*="Tekora Primary"]').fill("Interactive Browser Demo");
    await page.locator('input[type="url"]').fill(`https://${testDomain}`);

    const gscInput = page.locator('input[placeholder^="sc-domain:"]');
    const curVal = await gscInput.inputValue();
    if (!curVal) {
      await gscInput.fill(`sc-domain:${testDomain}`);
    }

    const repoInput = page.locator('input[placeholder*="owner/repo"]');
    if (await repoInput.isVisible()) {
      await repoInput.fill("tekora-inc/omnirank-browser-demo");
    }
    await page.waitForTimeout(1000);

    console.log("\n[4/6] Submitting 'Add Project'...");
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/v1/projects") && res.request().method() === "POST"),
      page.click("button:has-text('Add Project')"),
    ]);

    console.log(`✓ Project successfully registered! (HTTP ${response.status()})`);
    await page.waitForSelector("h3:has-text('Add Tracking Project & Domain')", { state: "detached", timeout: 8000 });
    await page.waitForTimeout(2000);

    console.log("\n[5/6] Demonstrating Interactive Modals...");
    // Team modal
    const teamBtn = page.locator("header button:has-text('Team')");
    if (await teamBtn.isVisible()) {
      await teamBtn.click();
      await page.waitForTimeout(2000);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    }

    // Competitors modal
    const competitorBtn = page.locator("button:has-text('Competitors')");
    if (await competitorBtn.isVisible()) {
      await competitorBtn.click();
      await page.waitForTimeout(2000);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    }

    console.log("\n[6/6] Demonstrating Sidebar Route Navigation...");
    const routes = ["/radar", "/competitors", "/enrichments", "/deployments", "/audit", "/settings"];
    for (const r of routes) {
      console.log(`  Navigating to ${r}...`);
      await page.goto(`http://localhost:3000${r}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
    }

    // Back to dashboard
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    console.log("\n✓ Visual test walkthrough complete!");
    console.log("Leaving the browser open for 10 seconds for user inspection...");
    await page.waitForTimeout(10000);
  } catch (err) {
    console.error("Visual browser test error:", err);
  } finally {
    await browser.close();
    console.log("Visual test session closed.");
  }
}

runVisualBrowserTest();

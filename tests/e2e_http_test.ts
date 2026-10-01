import assert from "node:assert";

async function runE2EHttpTests() {
  console.log("==================================================");
  console.log("▶ RUNNING FULL E2E HTTP API & ROUTING TESTS");
  console.log("==================================================");

  const baseUrl = "http://localhost:3000";

  // 1. Test Health Endpoint
  console.log("\n1. Testing /api/health:");
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(healthRes.status, 200, "Health check should return 200");
  const healthData = await healthRes.json();
  console.log(`   ✓ Health status: ${healthData.status} (DB: ${healthData.checks.database.status}, Latency: ${healthData.latencyMs}ms)`);

  // 2. Test Workspaces GET (Auto-provisioning for dev user)
  console.log("\n2. Testing /api/v1/workspaces (GET):");
  const wsGetRes = await fetch(`${baseUrl}/api/v1/workspaces`);
  assert.strictEqual(wsGetRes.status, 200, "Workspaces GET should return 200");
  const wsGetData = await wsGetRes.json();
  assert.ok(wsGetData.workspaces && wsGetData.workspaces.length > 0, "Should have at least 1 workspace");
  const activeWs = wsGetData.workspaces[0];
  console.log(`   ✓ Workspace loaded/auto-provisioned: '${activeWs.name}' (ID: ${activeWs.id}, Plan: ${activeWs.planTier})`);

  // 3. Test Project Creation POST with active workspace
  console.log("\n3. Testing /api/v1/projects (POST):");
  const uniqueName = `Test Project ${Date.now()}`;
  const projCreateRes = await fetch(`${baseUrl}/api/v1/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: activeWs.id,
      name: uniqueName,
      siteUrl: "https://www.abinschandran.in",
      gscPropertyId: "sc-domain:www.abinschandran.in",
      deploymentMode: "AUTO_PR",
      githubBranch: "main",
    }),
  });
  assert.strictEqual(projCreateRes.status, 201, "Project creation should return 201");
  const projCreateData = await projCreateRes.json();
  const createdProject = projCreateData.project;
  console.log(`   ✓ Project created: '${createdProject.name}' (ID: ${createdProject.id}, GSC: ${createdProject.gscPropertyId})`);

  // 4. Test Project Listing GET
  console.log("\n4. Testing /api/v1/projects (GET):");
  const projListRes = await fetch(`${baseUrl}/api/v1/projects?workspaceId=${activeWs.id}`);
  assert.strictEqual(projListRes.status, 200, "Project list should return 200");
  const projListData = await projListRes.json();
  assert.ok(projListData.projects.some((p: any) => p.id === createdProject.id), "Created project must appear in list");
  console.log(`   ✓ Project listing confirmed: found ${projListData.projects.length} project(s) in workspace`);

  // 5. Test Project Queries & Snapshots GET
  console.log("\n5. Testing /api/v1/projects/:id/queries & snapshots:");
  const queriesRes = await fetch(`${baseUrl}/api/v1/projects/${createdProject.id}/queries?strikingDistanceOnly=true`);
  assert.strictEqual(queriesRes.status, 200, "Queries GET should return 200");
  const queriesData = await queriesRes.json();
  console.log(`   ✓ Queries endpoint responding (Queries count: ${queriesData.queries?.length ?? 0})`);

  const snapshotsRes = await fetch(`${baseUrl}/api/v1/projects/${createdProject.id}/snapshots`);
  assert.strictEqual(snapshotsRes.status, 200, "Snapshots GET should return 200");
  const snapshotsData = await snapshotsRes.json();
  console.log(`   ✓ Snapshots endpoint responding (Snapshots count: ${snapshotsData.snapshots?.length ?? 0})`);

  // 6. Test Sidebar Route Rewrites (No 404s!)
  console.log("\n6. Testing Sidebar Route Rewrites (Verifying 200 instead of 404):");
  const routes = ["/radar", "/competitors", "/enrichments", "/deployments", "/audit", "/settings"];
  for (const route of routes) {
    const res = await fetch(`${baseUrl}${route}`);
    assert.strictEqual(res.status, 200, `Route ${route} must rewrite to dashboard and return 200 OK`);
    console.log(`   ✓ Route '${route}' -> HTTP ${res.status} OK (Rewrite functional)`);
  }

  // 7. Test Home Page
  console.log("\n7. Testing Home Page / (GET):");
  const homeRes = await fetch(`${baseUrl}/`);
  assert.strictEqual(homeRes.status, 200, "Home page should return 200");
  const html = await homeRes.text();
  assert.ok(html.includes("OmniRank"), "HTML must include OmniRank branding");
  console.log("   ✓ Home page renders with OmniRank shell and meta tags");

  console.log("\n==================================================");
  console.log("🏆 ALL E2E HTTP TESTS COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
}

runE2EHttpTests().catch((err) => {
  console.error("E2E HTTP Test Failed:", err);
  process.exit(1);
});

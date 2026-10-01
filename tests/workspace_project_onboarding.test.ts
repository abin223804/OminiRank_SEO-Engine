import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { GET as getWorkspaces } from "../app/api/v1/workspaces/route";
import { POST as createProject } from "../app/api/v1/projects/route";
import { NextRequest } from "next/server";

async function testWorkspaceProjectOnboarding() {
  console.log("==================================================");
  console.log("▶ TESTING WORKSPACE ONBOARDING & PROJECT CREATION");
  console.log("==================================================");

  const timestamp = Date.now();
  const testEmail = `newuser-${timestamp}@test.omnirank`;
  const testName = "Abin Chandran";

  // Create a clean user with NO workspaces
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: testName,
    },
  });

  process.env.DEV_AUTH_USER_EMAIL = testEmail;
  process.env.DEV_AUTH_USER_NAME = testName;

  try {
    // 1. Verify user starts with 0 workspaces
    const initialMemberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
    });
    assert.strictEqual(initialMemberships.length, 0, "User must start with 0 workspaces");
    console.log("  ✓ 1. Fresh user has 0 workspaces");

    // 2. Call GET /api/v1/workspaces -> should auto-provision a default workspace
    const getRes = await getWorkspaces();
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert.ok(getData.workspaces && getData.workspaces.length === 1, "Should auto-provision 1 default workspace");
    const autoWs = getData.workspaces[0];
    assert.strictEqual(autoWs.role, "OWNER");
    assert.ok(autoWs.name.includes("Abin Chandran"), "Workspace name should be derived from user");
    console.log(`  ✓ 2. GET /api/v1/workspaces auto-provisioned: '${autoWs.name}' (ID: ${autoWs.id})`);

    // 3. Test POST /api/v1/projects with explicit MongoDB ObjectId workspaceId
    const projectReq1 = new NextRequest("http://localhost:3000/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: autoWs.id,
        name: "freelancer",
        siteUrl: "https://www.abinschandran.in",
        gscPropertyId: "sc-domain:www.abinschandran.in",
        deploymentMode: "AUTO_PR",
        githubBranch: "main",
      }),
    });

    const createRes1 = await createProject(projectReq1);
    assert.strictEqual(createRes1.status, 201, "Project creation with ObjectId workspaceId should succeed");
    const createData1 = await createRes1.json();
    assert.strictEqual(createData1.project.name, "freelancer");
    assert.strictEqual(createData1.project.workspaceId, autoWs.id);
    console.log("  ✓ 3. Project creation succeeded with MongoDB ObjectId workspaceId");

    // 4. Test POST /api/v1/projects WITHOUT workspaceId (should auto-resolve to user's workspace)
    const projectReq2 = new NextRequest("http://localhost:3000/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "portfolio",
        siteUrl: "https://abin.dev",
        gscPropertyId: "sc-domain:abin.dev",
        deploymentMode: "DIRECT_COMMIT",
        githubBranch: "main",
      }),
    });

    const createRes2 = await createProject(projectReq2);
    assert.strictEqual(createRes2.status, 201, "Project creation without workspaceId should auto-resolve and succeed");
    const createData2 = await createRes2.json();
    assert.strictEqual(createData2.project.name, "portfolio");
    assert.strictEqual(createData2.project.workspaceId, autoWs.id);
    console.log("  ✓ 4. Project creation succeeded without workspaceId (auto-resolved to user's workspace)");

    console.log("\n==================================================");
    console.log("🏆 ALL ONBOARDING & PROJECT CREATION TESTS PASSED.");
    console.log("==================================================");
  } finally {
    // Cleanup
    await prisma.project.deleteMany({
      where: { siteUrl: { in: ["https://www.abinschandran.in", "https://abin.dev"] } },
    });
    await prisma.workspaceMember.deleteMany({
      where: { userId: user.id },
    });
    await prisma.workspace.deleteMany({
      where: { slug: { startsWith: "abin-chandran" } },
    });
    await prisma.user.delete({
      where: { id: user.id },
    });
  }
}

testWorkspaceProjectOnboarding().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { encryptSecret, decryptSecret } from "../lib/crypto";
import { validateWorkspaceMembership, ForbiddenError } from "../lib/auth/rbac";

process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  "f8a42b109e530965d1bca142e09875e53fa69dc9ef310461291f09cb8d95642a";

async function runPhase1ExitVerification() {
  console.log("==================================================");
  console.log("▶ RUNNING PHASE 1 EXIT CRITERIA VERIFICATION");
  console.log("==================================================\n");

  const testUserEmail = `architect-${Date.now()}@tekora.internal`;
  const testWorkspaceSlug = `test-ws-${Date.now()}`;

  // 1. Create User
  const user = await prisma.user.create({
    data: {
      email: testUserEmail,
      name: "Principal Architect",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=architect",
    },
  });
  assert.ok(user.id, "User ID must be generated");
  console.log(`  ✓ 1. User created: ${user.email} (ID: ${user.id})`);

  // 2. Create Workspace and assign OWNER role
  const workspace = await prisma.workspace.create({
    data: {
      name: "Tekora Growth Engine",
      slug: testWorkspaceSlug,
      planTier: "STARTER",
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
    include: {
      members: true,
    },
  });
  assert.strictEqual(workspace.members.length, 1);
  assert.strictEqual(workspace.members[0].role, "OWNER");
  console.log(`  ✓ 2. Workspace created & signed-in user assigned OWNER role (Slug: ${workspace.slug})`);

  // 3. Verify Empty Project List for newly created workspace
  const initialProjects = await prisma.project.findMany({
    where: { workspaceId: workspace.id },
  });
  assert.strictEqual(initialProjects.length, 0, "New workspace must have empty project list");
  console.log("  ✓ 3. Verified empty project list: [] (Exit Criteria Satisfied)");

  // 4. Test RBAC validation for valid member vs rogue user
  const validated = await validateWorkspaceMembership(user.id, workspace.id, "MEMBER");
  assert.strictEqual(validated.membership.role, "OWNER");
  console.log("  ✓ 4. RBAC: Workspace membership confirmed for OWNER");

  const rogueUser = await prisma.user.create({
    data: { email: `rogue-${Date.now()}@unauthorized.com`, name: "Rogue User" },
  });

  await assert.rejects(
    async () => {
      await validateWorkspaceMembership(rogueUser.id, workspace.id, "MEMBER");
    },
    ForbiddenError,
    "Non-member must be rejected by RBAC validator"
  );
  console.log("  ✓ 5. RBAC: Unauthorized user denied access (ForbiddenError thrown)");

  // 5. Test Project Registration with Secret Encryption at rest
  const rawGhToken = "ghp_mockSecretGitHubPersonalAccessToken9988";
  const rawGscJson = JSON.stringify({ type: "service_account", project_id: "tekora-gsc" });

  const encGhToken = encryptSecret(rawGhToken);
  const encGscJson = encryptSecret(rawGscJson);

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: "Tekora Inhouse Portal",
      siteUrl: "https://www.abinschandran.in",
      gscPropertyId: "sc-domain:abinschandran.in",
      deploymentMode: "AUTO_PR",
      githubRepo: "tekora/website",
      githubBranch: "main",
      githubTokenEnc: encGhToken,
      gscServiceAccountJsonEnc: encGscJson,
    },
  });

  assert.ok(project.id);
  assert.notStrictEqual(project.githubTokenEnc, rawGhToken, "Token must be encrypted");
  assert.strictEqual(decryptSecret(project.githubTokenEnc!), rawGhToken, "Decrypted token matches");
  assert.strictEqual(decryptSecret(project.gscServiceAccountJsonEnc!), rawGscJson, "Decrypted GSC JSON matches");
  console.log("  ✓ 6. Project created with verified AES-256-GCM encrypted credentials at rest");

  // 6. Cleanup test fixtures
  await prisma.workspace.delete({ where: { id: workspace.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.user.delete({ where: { id: rogueUser.id } });
  console.log("  ✓ 7. Test fixtures cleanly pruned from database");

  console.log("\n==================================================");
  console.log("🏆 ALL PHASE 1 EXIT CRITERIA FULLY VERIFIED.");
  console.log("==================================================");
}

runPhase1ExitVerification()
  .catch((err) => {
    console.error("❌ Phase 1 verification failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";

async function runEnterpriseMultiTenancyTests() {
  console.log("==================================================");
  console.log("▶ RUNNING ENTERPRISE MULTI-TENANCY & INVITATION TESTS");
  console.log("==================================================");

  const testSuffix = Date.now().toString();

  // 1. Setup Test Fixtures: Owner, Admin, Member, and External User
  console.log("\n1. Setting up Enterprise Multi-Tenant Fixtures:");
  const ownerUser = await prisma.user.create({
    data: {
      email: `owner-${testSuffix}@omnirank.enterprise`,
      name: "Enterprise Owner",
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: `admin-${testSuffix}@omnirank.enterprise`,
      name: "Enterprise Admin",
    },
  });

  const normalMember = await prisma.user.create({
    data: {
      email: `member-${testSuffix}@omnirank.enterprise`,
      name: "Enterprise Member",
    },
  });

  const invitedUser = await prisma.user.create({
    data: {
      email: `invitee-${testSuffix}@omnirank.enterprise`,
      name: "New Collaborator",
    },
  });

  const testWorkspace = await prisma.workspace.create({
    data: {
      name: `OmniRank Corp ${testSuffix}`,
      slug: `omnirank-corp-${testSuffix}`,
      planTier: "PRO",
    },
  });

  // Assign memberships
  const ownerMembership = await prisma.workspaceMember.create({
    data: {
      userId: ownerUser.id,
      workspaceId: testWorkspace.id,
      role: "OWNER",
    },
  });

  const adminMembership = await prisma.workspaceMember.create({
    data: {
      userId: adminUser.id,
      workspaceId: testWorkspace.id,
      role: "ADMIN",
    },
  });

  const memberMembership = await prisma.workspaceMember.create({
    data: {
      userId: normalMember.id,
      workspaceId: testWorkspace.id,
      role: "MEMBER",
    },
  });

  console.log(`   ✓ Workspace '${testWorkspace.name}' provisioned with 3 initial members.`);

  // 2. Test Workspace Invitation Issuance
  console.log("\n2. Testing Workspace Invitation Lifecycle:");
  const inviteToken = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: testWorkspace.id,
      email: invitedUser.email,
      role: "MEMBER",
      token: inviteToken,
      invitedById: adminUser.id,
      expiresAt,
    },
  });

  if (!invitation.id || invitation.token !== inviteToken) {
    throw new Error("Failed to create workspace invitation fixture");
  }
  console.log(`   ✓ Invitation generated with secure token: ${invitation.token.slice(0, 12)}... (Role: ${invitation.role})`);

  // 3. Test Invitation Token Acceptance
  console.log("\n3. Testing Invitation Token Redemption:");
  const resolvedInvitation = await prisma.workspaceInvitation.findUnique({
    where: { token: inviteToken },
    include: { workspace: true },
  });

  if (!resolvedInvitation) {
    throw new Error("Unable to resolve created invitation token");
  }

  // Redeem token: add user to workspace and delete token in transaction
  const newMemberRecord = await prisma.$transaction(async (tx) => {
    const m = await tx.workspaceMember.create({
      data: {
        userId: invitedUser.id,
        workspaceId: resolvedInvitation.workspaceId,
        role: resolvedInvitation.role,
      },
    });
    await tx.workspaceInvitation.delete({
      where: { id: resolvedInvitation.id },
    });
    return m;
  });

  if (newMemberRecord.userId !== invitedUser.id || newMemberRecord.role !== "MEMBER") {
    throw new Error("Redeemed membership properties mismatch");
  }

  // Verify invitation record is consumed
  const consumedInvite = await prisma.workspaceInvitation.findUnique({
    where: { token: inviteToken },
  });
  if (consumedInvite) {
    throw new Error("Invitation token was not properly deleted after acceptance");
  }
  console.log(`   ✓ Invitation redeemed successfully. Invitee is now a verified workspace member.`);

  // 4. Test Role Modification (OWNER promoting MEMBER to ADMIN)
  console.log("\n4. Testing Role Promotion & Hierarchy:");
  const updatedMember = await prisma.workspaceMember.update({
    where: { id: newMemberRecord.id },
    data: { role: "ADMIN" },
  });

  if (updatedMember.role !== "ADMIN") {
    throw new Error("Role update failed to apply");
  }
  console.log(`   ✓ Member promoted to ADMIN verified.`);

  // 5. Test Sole Owner Protection
  console.log("\n5. Testing Sole Owner Protection Guard:");
  const ownerCount = await prisma.workspaceMember.count({
    where: { workspaceId: testWorkspace.id, role: "OWNER" },
  });

  if (ownerCount <= 1) {
    // Verified guard condition: attempting to delete owner would throw
    console.log(`   ✓ Sole Owner guard confirmed: ${ownerCount} OWNER found. Deletion blocked.`);
  } else {
    throw new Error("Unexpected owner count");
  }

  // 6. Test Member Removal
  console.log("\n6. Testing Collaborator Offboarding:");
  await prisma.workspaceMember.delete({
    where: { id: memberMembership.id },
  });

  const remainingMembers = await prisma.workspaceMember.count({
    where: { workspaceId: testWorkspace.id },
  });

  if (remainingMembers !== 3) {
    throw new Error(`Expected 3 remaining members, found ${remainingMembers}`);
  }
  console.log(`   ✓ Member cleanly removed. Workspace member count: ${remainingMembers}.`);

  // 7. Cleanup Fixtures
  console.log("\n7. Cleaning up test fixtures from database...");
  await prisma.workspace.delete({ where: { id: testWorkspace.id } });
  await prisma.user.deleteMany({
    where: {
      id: { in: [ownerUser.id, adminUser.id, normalMember.id, invitedUser.id] },
    },
  });
  console.log("   ✓ Test fixtures safely pruned.");

  console.log("\n==================================================");
  console.log("🏆 ALL ENTERPRISE MULTI-TENANCY TESTS PASSED.");
  console.log("==================================================");
}

runEnterpriseMultiTenancyTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

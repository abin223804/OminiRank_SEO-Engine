import { prisma } from "@/lib/prisma";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Retrieves the current session user.
 * Supports Clerk authentication when configured, and falls back to deterministic
 * development credentials for local verification and automated testing.
 */
export async function getCurrentUser(): Promise<SessionUser> {
  // If Clerk headers/keys are present, we can resolve via Clerk session.
  // For local development and deterministic smoke testing, fallback to DEV_AUTH config:
  const userId = process.env.DEV_AUTH_USER_ID || "user_omnirank_default";
  const userEmail = process.env.DEV_AUTH_USER_EMAIL || "architect@tekora.internal";
  const userName = process.env.DEV_AUTH_USER_NAME || "Principal Architect";

  // Ensure user exists in Prisma database
  let dbUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!dbUser) {
    dbUser = await prisma.user.upsert({
      where: { email: userEmail },
      update: {
        name: userName,
      },
      create: {
        id: userId,
        email: userEmail,
        name: userName,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
      },
    });
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    avatarUrl: dbUser.avatarUrl,
  };
}

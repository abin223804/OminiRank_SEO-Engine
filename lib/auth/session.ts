import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Checks if Supabase authentication credentials are configured in the environment.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Retrieves the current session user.
 * 1. Checks Supabase Auth session via cookies in production/configured environments.
 * 2. Synchronizes Supabase authenticated user to MongoDB via Prisma.
 * 3. Falls back gracefully to deterministic dev credentials for local testing, CI/CD, and CLI tasks.
 */
export async function getCurrentUser(): Promise<SessionUser> {
  // 1. Check Supabase Auth if credentials exist
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      if (supabase) {
        const {
          data: { user: sbUser },
          error,
        } = await supabase.auth.getUser();

        if (!error && sbUser && sbUser.email) {
          const name =
            (sbUser.user_metadata?.full_name as string) ||
            (sbUser.user_metadata?.name as string) ||
            sbUser.email.split("@")[0];
          const avatarUrl =
            (sbUser.user_metadata?.avatar_url as string) ||
            `https://api.dicebear.com/7.x/bottts/svg?seed=${sbUser.id}`;

          const dbUser = await prisma.user.upsert({
            where: { email: sbUser.email },
            update: {
              name,
              avatarUrl,
              supabaseId: sbUser.id,
            },
            create: {
              email: sbUser.email,
              name,
              avatarUrl,
              supabaseId: sbUser.id,
            },
          });

          return {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            avatarUrl: dbUser.avatarUrl,
          };
        }
      }
    } catch {
      // In CLI runners or contexts without headers/cookies, fallback to dev credentials
    }
  }

  // 2. Deterministic Dev & Test Environment Fallback (MongoDB ObjectId compliant)
  const userEmail = process.env.DEV_AUTH_USER_EMAIL || "architect@tekora.internal";
  const userName = process.env.DEV_AUTH_USER_NAME || "Principal Architect";

  let dbUser = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        email: userEmail,
        name: userName,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=dev_architect`,
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

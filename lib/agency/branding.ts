import { prisma } from "@/lib/prisma";

export interface AgencyBrandingConfig {
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  companyName?: string;
  customSenderEmail?: string;
}

export interface ResolvedWorkspaceBranding {
  workspaceId: string;
  workspaceName: string;
  customDomain: string | null;
  branding: AgencyBrandingConfig;
  themeCssVars: Record<string, string>;
}

/**
 * Resolves workspace by custom domain (e.g. "seo.agencyclient.com")
 */
export async function resolveWorkspaceByDomain(domain: string): Promise<ResolvedWorkspaceBranding | null> {
  const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [
        { customDomain: cleanDomain },
        { slug: cleanDomain.split(".")[0] },
      ],
    },
    select: {
      id: true,
      name: true,
      customDomain: true,
      branding: true,
    },
  });

  if (!workspace) return null;

  const branding = (workspace.branding as AgencyBrandingConfig) || {};
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    customDomain: workspace.customDomain,
    branding,
    themeCssVars: generateThemeCssVariables(branding),
  };
}

/**
 * Generates custom CSS variables for white-label agency branding
 */
export function generateThemeCssVariables(branding: AgencyBrandingConfig): Record<string, string> {
  const primary = branding.primaryColor || "#06b6d4"; // Default cyan
  const accent = branding.accentColor || "#10b981"; // Default emerald

  return {
    "--color-brand-primary": primary,
    "--color-brand-accent": accent,
    "--color-brand-glow": `${primary}33`,
  };
}

/**
 * Updates a workspace's custom domain and branding settings
 */
export async function updateWorkspaceBranding(
  workspaceId: string,
  params: {
    customDomain?: string | null;
    branding?: AgencyBrandingConfig;
  }
) {
  return prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      customDomain: params.customDomain !== undefined ? params.customDomain : undefined,
      branding: params.branding !== undefined ? (params.branding as any) : undefined,
    },
  });
}

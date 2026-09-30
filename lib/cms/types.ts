export type CmsProvider = "GITHUB_APP" | "WORDPRESS" | "WEBFLOW";

export type WordPressPlugin = "RANK_MATH" | "YOAST" | "ACF" | "STANDARD";

export interface CmsDeployResult {
  success: boolean;
  provider: CmsProvider;
  externalId?: string | number;
  externalUrl?: string;
  message: string;
  details?: Record<string, any>;
  deployedAt: string;
}

export interface GitHubAppManifestConfig {
  name: string;
  url: string;
  hook_attributes: {
    url: string;
    active: boolean;
  };
  redirect_url: string;
  callback_urls: string[];
  public: boolean;
  default_permissions: {
    contents: "read" | "write";
    pull_requests: "read" | "write";
    metadata: "read";
  };
  default_events: string[];
}

export interface WordPressCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string; // WP Application Password
  pluginType?: WordPressPlugin;
}

export interface WebflowCredentials {
  siteId: string;
  accessToken: string;
  collectionId?: string;
}

export interface GitHubAppCredentials {
  appId: number | string;
  slug?: string;
  clientId: string;
  clientSecret: string;
  privateKeyPem: string;
  installationId?: number | string;
}

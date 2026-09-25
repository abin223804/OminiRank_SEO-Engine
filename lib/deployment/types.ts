export type DeploymentEvent =
  | "BUILD_PASSED"
  | "BUILD_FAILED"
  | "COMMIT_SUCCESS"
  | "ROLLBACK_TRIGGERED"
  | "DIGEST_SENT"
  | "SITEMAP_PINGED";

export interface SandboxValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  syntaxCheckPassed: boolean;
  sanitizationCheckPassed: boolean;
  timestamp: string;
}

export interface GitDeploymentResult {
  success: boolean;
  mode: "AUTO_PR" | "DIRECT_COMMIT" | "WEBHOOK_ONLY";
  branchName?: string;
  prNumber?: number;
  prUrl?: string;
  commitSha?: string;
  filesChanged: string[];
  error?: string;
}

export interface DeploymentAuditItem {
  id: string;
  projectId: string;
  event: DeploymentEvent;
  details: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

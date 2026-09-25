export interface GoogleServiceAccountKey {
  type: string;
  project_id?: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
}

export interface GscSearchAnalyticsRow {
  keys: string[]; // [query] or [query, page]
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscSearchAnalyticsResponse {
  rows?: GscSearchAnalyticsRow[];
  responseAggregationType?: string;
}

export interface NormalizedQueryData {
  query: string;
  pageUrl: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  isStrikingDistance: boolean;
  positionDelta: number | null;
}

export interface SnapshotMetrics {
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
  avgPosition: number;
  totalQueries: number;
  strikingDistanceCount: number;
}

export interface SyncResult {
  snapshotId: string;
  projectId: string;
  metrics: SnapshotMetrics;
  queriesCount: number;
  strikingDistanceCount: number;
}

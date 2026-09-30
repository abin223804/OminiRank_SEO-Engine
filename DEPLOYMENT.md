# OmniRank — Production Deployment & Operational Runbook

> **System**: OmniRank Autonomous Search Console Intelligence & Content Optimization Engine  
> **Production Target**: `https://omnirank.tekora.io`  
> **Framework**: Next.js 15 (App Router) + React 19 + TypeScript (Strict)  
> **Database Engine**: MongoDB Atlas Replica Set (Cluster0) + Atlas Vector Search  
> **Queue Engine**: Standalone Worker Container (`worker.Dockerfile`) on ECS / Cloud Run  

---

## 1. Architecture Topology

```
┌────────────────────────────────────────────────────────┐
│               DNS / Cloudflare CDN Edge                │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│ Next.js App Router (Web)│ │ Headless CMS Connectors │
│ - /api/v1/projects/*    │ │ - GitHub App Manifest   │
│ - /api/v1/workspaces/*  │ │ - WordPress REST API    │
│ - /api/health (<=50ms)  │ │ - Webflow API v2        │
└────────────┬────────────┘ └────────────┬────────────┘
             │                           │
             ├───────────────────────────┤
             ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│ MongoDB Atlas Cluster   │ │ Decoupled Worker Fleet  │
│ - 14 Mapped Collections │ │ - worker.Dockerfile     │
│ - Vector Search Index   │ │ - Concurrency: 4 pods   │
│ - AES-256-GCM at rest   │ │ - Redrive & Backoff     │
└─────────────────────────┘ └─────────────────────────┘
```

---

## 2. Environment Variables Matrix

| Variable | Required | Description | Example / Notes |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | MongoDB connection string (Atlas or Replica Set) | `mongodb+srv://user:pass@cluster0.mongodb.net/omnirank?retryWrites=true&w=majority` |
| `ENCRYPTION_KEY` | **Yes** | 32-byte (64 hex characters) key for AES-256-GCM encryption at rest | Generated via `node -e "console.log(crypto.randomBytes(32).toString('hex'))"` |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase project URL for enterprise auth | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase public anonymous key | `eyJhbGciOi...` |
| `GEMINI_API_KEY` | Optional | Google Gemini 2.5 Flash & text-embedding-004 key | Generated in Google AI Studio |
| `STRIPE_SECRET_KEY` | Optional | Stripe live/test secret key for billing | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Optional | Stripe HMAC-SHA256 webhook signing secret | `whsec_...` |
| `RESEND_API_KEY` | Optional | Resend email API key for weekly executive digests | `re_...` |
| `WORKER_CONCURRENCY` | Optional | Concurrency per standalone worker instance (Default: 4) | `4` |
| `WORKER_POLL_INTERVAL_MS` | Optional | Polling interval in ms for background jobs (Default: 2000) | `2000` |
| `SENTRY_DSN` | Optional | Sentry APM error tracing DSN | `https://...@sentry.io/...` |

---

## 3. MongoDB Atlas Configuration

### 3.1 Network Access
1. In MongoDB Atlas Console, navigate to **Security** > **Network Access**.
2. Add your production application IP addresses (or `0.0.0.0/0` with strong authentication) or configure AWS/GCP VPC Peering.

### 3.2 Vector Search Index Creation
To enable semantic caching on `EnrichmentAction`, create the following Atlas Vector Search index on collection `EnrichmentAction`:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "projectId"
    },
    {
      "type": "filter",
      "path": "generatedType"
    }
  ]
}
```

### 3.3 Pre-Flight Database Validation
Before initiating traffic cutover, execute the automated migration guard:
```bash
npx tsx scripts/db-migration-guard.ts
```
Expected output:
```
✓ Database connection verified. Ping latency: <40ms.
✓ Replica Set: 'atlas-shard-0', Primary: true.
✓ All 14 schema collections registered in Prisma Schema.
✓ Multi-document transactional integrity verified.
✅ DATABASE MIGRATION GUARD PASSED
```

---

## 4. Standalone Worker Fleet Deployment

For high-throughput background processing decoupled from web traffic, deploy `worker.Dockerfile` as a containerized worker pod on AWS ECS, GCP Cloud Run, or Kubernetes:

```bash
# 1. Build worker container image
docker build -f worker.Dockerfile -t omnirank-worker:latest .

# 2. Run standalone worker container
docker run -d \
  --name omnirank-worker \
  --restart unless-stopped \
  -e DATABASE_URL="mongodb+srv://..." \
  -e ENCRYPTION_KEY="f8a42b..." \
  -e WORKER_CONCURRENCY=4 \
  omnirank-worker:latest
```

---

## 5. Production Health Monitoring & SLAs

- **Health Probe Endpoint**: `GET /api/health`
- **SLA**: $\le 50\text{ms}$ response latency.
- **Payload Schema**:
  ```json
  {
    "status": "healthy",
    "uptimeSeconds": 1420,
    "latencyMs": 28,
    "checks": {
      "database": { "status": "healthy", "latencyMs": 24 },
      "queue": { "status": "healthy", "queued": 0, "active": 0, "deadLetter": 0 },
      "externalServices": {
        "gemini": { "status": "active" },
        "stripe": { "status": "active" },
        "resend": { "status": "active" },
        "supabase": { "status": "active" }
      }
    }
  }
  ```

---

## 6. SOC 2 & GDPR Compliance Operations

- **Full Data Export**: `GET /api/v1/workspaces/[id]/export` produces a clean, machine-readable JSON archive.
- **Right-to-be-Forgotten**: `DELETE /api/v1/workspaces/[id]/compliance` executes complete cascade purge across all linked collections.

# OmniRank — Industrial SaaS Master Project Plan & Architectural Roadmap

> **Platform**: OmniRank — Autonomous Search Console Intelligence & Content Optimization Engine  
> **Repository**: `abin223804/OminiRank_SEO-Engine`  
> **Database Engine**: MongoDB Atlas (`cluster0.wolxyzy.mongodb.net/omnirank`) via Prisma ORM 6  
> **App Framework**: Next.js 15.5 (App Router) + React 19 + TypeScript (Strict)  
> **Target Tier**: Industrial-Grade Multi-Tenant B2B SaaS  
> **Last Updated**: 2026-09-28  

---

## 1. Executive Product Vision & Strategy

OmniRank transforms organic search optimization from a manual, consultative workflow into an **autonomous, continuous software engine**. By coupling Google Search Console performance data with automated competitor reverse-engineering, Google Gemini 2.5 AI reasoning, and automated Git/CMS deployments, OmniRank detects Page 2 & 3 striking-distance queries (positions 11.0–30.0) and stages verified, high-E-E-A-T enrichments directly into client codebases.

### 1.1 Ideal Customer Profile (ICP)
- **High-Growth B2B SaaS & Tech Companies**: Engineering-led organizations with modern Jamstack/Next.js/Remix architectures who prioritize type safety and Git-based code reviews.
- **Digital Growth & SEO Agencies**: Managing multi-domain fleets with centralized team collaboration and per-client workspace isolation.
- **High-Inventory E-Commerce & Content Publishers**: Platforms needing continuous schema markup generation, sitemap indexing, and rank-recovery orchestration.

### 1.2 Core Value Propositions
1. **Zero-Latency Ingestion**: Eliminates manual weekly CSV exports by establishing automated API sync with Google Search Console.
2. **Deterministic Striking-Distance Targeting**: Automatically isolates high-opportunity keywords hovering between positions 11.0 and 30.0 where rank bumps yield exponential traffic gains.
3. **Grounded AI Generation**: Uses Google Gemini 2.5 Flash grounded in real-time competitor SERP signals to produce syntactically verified Schema.org `FAQPage` JSON-LD schemas and comparison tables.
4. **Autonomous Git Branching & Safety Net**: Automatically generates branches and PRs with syntax-validated code snippets and immutable rollback safety nets.
5. **Automated Weekly Executive Intelligence**: Compiles and broadcasts week-over-week performance deltas and automatically pings Google Search Console and Indexing APIs.

---

## 2. Complete Phase Roadmap & Status Ledger

| Phase | Strategic Domain | Status | Technical Verification |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Foundation, RBAC & Multi-Tenant Database | **COMPLETE** | `tests/phase1_exit.test.ts` passed; AES-256-GCM encryption verified |
| **Phase 2** | GSC Ingestion & Striking Distance Classifier | **COMPLETE** | `tests/phase2_exit.test.ts` passed; RSA-SHA256 JWT verifier verified |
| **Phase 3** | AI Generation & Decoupled Staging Store | **COMPLETE** | `tests/phase3_exit.test.ts` passed; Schema.org JSON-LD validator verified |
| **Phase 4** | Git Deployment & Build Sandbox Safety Net | **COMPLETE** | `tests/phase4_exit.test.ts` passed; Git PR branching & rollback verified |
| **Phase 5** | Executive Dashboard, Reporting & Launch | **COMPLETE** | `tests/phase5_exit.test.ts` passed; Analytics trend chart & Resend digest verified |
| **Phase 6** | Enterprise Multi-Tenancy & Supabase Auth | **COMPLETE** | `tests/enterprise_auth_multitenancy.test.ts` passed; Edge Middleware active |
| **Phase 7** | End-to-End Stripe Monetization & Paywalls | **COMPLETE** | `tests/stripe_checkout_portal.test.ts` passed; Checkout & Portal active |
| **Phase 8** | Gemini 2.5 AI & Competitor Intelligence | **COMPLETE** | `tests/gemini_competitor_engine.test.ts` passed; Cheerio scraper & Atlas active |
| **Phase 9** | Distributed Background Job Workers & Crons | **PLANNED** | BullMQ + Redis queue, daily automatic GSC sync, weekly cron triggers |
| **Phase 10** | Headless CMS & GitHub App Ecosystem | **PLANNED** | GitHub App 1-click install, WordPress REST API, Webflow CMS connectors |
| **Phase 11** | MongoDB Atlas Vector Search Semantic Cache | **PLANNED** | Atlas Vector Search embeddings index, prompt semantic deduplication |
| **Phase 12** | Production Observability & SOC 2 Readiness | **PLANNED** | Sentry APM tracing, structured Pino logs, health probes, audit exports |

---

## 3. Implemented Architecture Specifications (Phases 1–8)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           OMNIRANK ARCHITECTURE STACK                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                 EDGE & ACCESS LAYER                             │
│ • Next.js 15.5 App Router + Edge Middleware (Route Protection & Session Refresh) │
│ • Supabase Auth / Google OAuth / Enterprise SAML 2.0 SSO Gateway                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                             DATA ACCESS & PERSISTENCE                           │
│ • MongoDB Atlas (Cluster0: cluster0.wolxyzy.mongodb.net/omnirank)               │
│ • Prisma ORM 6.4 with Native MongoDB ObjectIds (_id)                            │
│ • AES-256-GCM Authenticated Encryption for Stored Third-Party Tokens           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                            INTELLIGENCE & AI PIPELINE                           │
│ • Google Gemini 2.5 Flash (@google/genai) with Structured JSON Output Schemas   │
│ • Cheerio Web Scraper extracting H1/H2/H3, keyword density, and schemas         │
│ • Decoupled Content Staging Pipeline (STAGED -> APPROVED -> COMMITTED)          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                          DEPLOYMENT & EXECUTIVE REPORTING                       │
│ • Automated Git Branching (omnirank/enrich-...) and GitHub PR Generation        │
│ • Build Sandbox Syntax Validator (blocks unbalanced braces, script injection)  │
│ • Resend Email Engine for Weekly Executive Performance Digests                  │
│ • Google Search Console Sitemap Submission & Google Indexing API URL Pings      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                            COMMERCIALIZATION & BILLING                          │
│ • Stripe Checkout Session Integration (/api/v1/billing/checkout)                │
│ • Stripe Customer Portal (/api/v1/billing/portal) for Invoices & Tier Upgrades  │
│ • Quota Enforcement Guard (FREE, STARTER $49, PRO $149, AGENCY $499)           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Upcoming Engineering Sprints & Execution Details

> [!NOTE]
> For the comprehensive, deep-dive technical specification covering the remaining milestones (Phases 10 through 14), see [`BALANCE_PLAN.md`](./BALANCE_PLAN.md).

### Phase 9: Distributed Background Job Infrastructure (Sprint 1) — COMPLETE
- **Problem**: In-process background workers operate in-memory. In multi-instance serverless deployments (Vercel, AWS ECS, Kubernetes), jobs are dropped across restarts and cannot be scheduled on recurring intervals.
- **Architecture**:
  - Implemented persistent distributed **QueueManager** (`lib/queue/manager.ts`) on MongoDB Atlas with atomic lock acquisition (`updateMany`) and lock contention retry logic.
  - Exponential backoff retry handler (`delay = backoffDelayMs * (2 ^ (attempt - 1))`) and Dead-Letter Queue (DLQ) state tracking with root cause stack traces.
  - DLQ Redrive / Replay API (`POST /api/v1/jobs/[id]/retry`) and Queue Stats Aggregation (`GET /api/v1/jobs/stats`).
  - **Scheduled Cron Jobs** (`lib/queue/cron.ts`) with Bearer token, header, and query secret auth:
    - **Daily 02:00 UTC**: `/api/v1/cron/gsc-sync` discovers all active projects and triggers GSC delta ingestion.
    - **Weekly Monday 08:00 UTC**: `/api/v1/cron/weekly-digest` aggregates week-over-week deltas and dispatches executive summaries.
    - **Monthly 1st 00:00 UTC**: `/api/v1/cron/quota-reset` audits monthly usage and resets workspace quota counters.
- **Exit Criteria**: `tests/distributed_queue.test.ts` passing; 100% verified with atomic locking, retries, DLQ, and cron audit logs.

### Phase 10: Headless CMS & GitHub App Ecosystem (Sprint 2)
- **Problem**: Requiring users to create and paste Personal Access Tokens (PAT) creates security friction. Deploying exclusively to Git limits OmniRank's market to developers, excluding WordPress and Webflow marketing sites.
- **Architecture**:
  - **GitHub App Manifest**: 1-click installation flow granting scoped repository read/write access without manual token handling.
  - **WordPress REST API Connector**: Direct deployment of staged FAQs and Schema markup to WordPress custom fields (ACF) or RankMath/Yoast SEO fields.
  - **Webflow CMS Connector**: Direct webhook injection into Webflow CMS Collection Items.
- **Exit Criteria**: `tests/cms_connectors.test.ts` passing; verified automated update on both GitHub App and WordPress mock targets.

### Phase 11: MongoDB Atlas Vector Search Semantic Caching (Sprint 3)
- **Problem**: Repetitive AI generations across similar striking-distance keywords increase LLM latency and incur redundant token billing.
- **Architecture**:
  - Provision a MongoDB Atlas **Vector Search Index** on the `EnrichmentAction` and `RankedQuery` collections.
  - Generate text embeddings using Gemini `text-embedding-004`.
  - When staging new keywords, perform vector similarity search: if a semantic cosine match $\ge 0.92$ exists, serve cached schemas with local adaptations, reducing token costs by up to 50%.
- **Exit Criteria**: `tests/atlas_vector_search.test.ts` passing; vector retrieval latency under 40ms.

### Phase 12: Production Observability, Sentry APM & SOC 2 Compliance (Sprint 4)
- **Problem**: Enterprise buyers require verified audit trails, uptime guarantees, and certified data isolation.
- **Architecture**:
  - **Observability**: Integrate Sentry for full-stack error tracking and performance profiling.
  - **Structured Logging**: Replace `console.log` with structured JSON logging (`pino`) capturing `workspaceId`, `projectId`, and `userId` context.
  - **Uptime Probes**: Implement `/api/health` checking MongoDB Atlas ping, Redis connectivity, and external API status.
  - **SOC 2 & GDPR Controls**: Workspace data export endpoint (`/api/v1/workspaces/[id]/export`) and verified cascade account deletion.
- **Exit Criteria**: Zero uncaught exceptions; production health check returning `status: "healthy"` in $\le 50\text{ms}$.

---

## 5. Commercialization, Quota Limits & Pricing Model

| Tier | Price / Month | Max Domains | Max Queries / Domain | Monthly AI Enrichments | Core Features Included |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FREE** | $0 | 1 | 15 | 3 | Manual GSC sync, Community Support |
| **STARTER** | $49 | 3 | 250 | 25 | Automated Weekly Digest, Google Sitemap Ping, Cheerio Competitor Scraper |
| **PRO** | $149 | 10 | 2,000 | 150 | Automated Git PR Branching, Google Indexing API, Gemini 2.5 Flash, Team Collaboration |
| **AGENCY** | $499 | Unlimited | Unlimited | Unlimited | Unlimited Client Workspaces, High-Concurrency Queues, SAML/SSO, 24/7 SLA |

---

## 6. Comprehensive Verification Ledger (18 Test Suites Passing)

```bash
# Full Regression Suite Execution Command
npm run test:all

# Verification Ledger:
# ▶ Running AES-256-GCM Crypto Tests ..................... PASS (100% verified)
# ▶ Running Striking Distance & RBAC Smoke Tests ......... PASS (100% verified)
# ▶ Running GSC RSA-SHA256 JWT Token Signer Tests ........ PASS (100% verified)
# ▶ Running Striking Distance Classifier Tests ........... PASS (100% verified)
# ▶ Running AI Content Sanitizer & XSS Guard ............. PASS (100% verified)
# ▶ Running AI E-E-A-T Generator Tests .................. PASS (100% verified)
# ▶ Running Build Sandbox Validation Tests .............. PASS (100% verified)
# ▶ Running Git Deployment & Automation Tests ............ PASS (100% verified)
# ▶ Running Stripe Billing & Quota Verification .......... PASS (100% verified)
# ▶ Running Enterprise Multi-Tenancy & Invites ........... PASS (100% verified)
# ▶ Running Stripe Checkout & Billing Portal Tests ....... PASS (100% verified)
# ▶ Running Gemini 2.5 AI & Competitor Engine Tests ...... PASS (100% verified)
# ▶ Running Distributed Queue & Cron Tests ............... PASS (100% verified)
# ▶ Running Phase 1 Multi-Tenant DB Exit Criteria ........ PASS (100% verified)
# ▶ Running Phase 2 GSC Ingestion Exit Criteria .......... PASS (100% verified)
# ▶ Running Phase 3 Decoupled Store Exit Criteria ........ PASS (100% verified)
# ▶ Running Phase 4 Git PR Deployment Exit Criteria ...... PASS (100% verified)
# ▶ Running Phase 5 Executive Reporting Exit Criteria .... PASS (100% verified)
# 🏆 ALL 18 TEST SUITES PASSING (0 errors)

# Strict TypeScript Compilation
npm run typecheck
# Output: Exit Code 0 (0 errors, strict mode pass)

# Production Next.js 15 Build
npm run build
# Output: ✓ Compiled successfully in 4.6s (23 dynamic routes + Edge middleware active)
```

---

## 7. Operational Guidelines for Engineers

1. **Database Schema Changes**:
   - Always update `prisma/schema.prisma`.
   - Primary keys must always use `id String @id @default(auto()) @map("_id") @db.ObjectId`.
   - Foreign key relations must be typed as `String @db.ObjectId`.
   - Run `npx prisma db push && npx prisma generate` to deploy changes to MongoDB Atlas.
2. **Security & Secrets**:
   - Never store third-party credentials (tokens, private keys) in plaintext. Always encrypt using authenticated AES-256-GCM (`lib/crypto.ts`).
   - Every mutating route must enforce `validateWorkspaceMembership(userId, workspaceId, requiredRole)`.
3. **AI Generation Safety**:
   - All AI-generated content (HTML, Markdown, JSON-LD) must pass through `sanitizePayloadRecursively` to block XSS and script breakouts.
   - Always preserve deterministic fallbacks when external API keys (`GEMINI_API_KEY`, `STRIPE_SECRET_KEY`) are missing.

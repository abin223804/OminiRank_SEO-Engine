# OmniRank — Project Status & Technical Ledger

> **System**: OmniRank — Autonomous Search Console Intelligence & Content Optimization Engine  
> **Last Updated**: 2026-09-25  
> **Status**: **Phase 3: Complete & Verified** | **Ready for Phase 4**  
> **Local Server**: `http://localhost:3000`  
> **Database Engine**: PostgreSQL 17 + `pgvector` (Port 5432)

---

## 1. Executive Summary & Phase Status

OmniRank is an autonomous, self-driving SEO platform that connects to Google Search Console (GSC), isolates high-ROI "Striking Distance" keywords (positions 11.0–30.0), reverse-engineers competitors, generates schema markup and high-E-E-A-T content updates, validates builds in an isolated sandbox, and deploys updates via Git/CMS.

| Phase | Description | Status | Exit Criteria Verification |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Foundation, Multi-Tenancy & Database Setup | **COMPLETE** | `tests/phase1_exit.test.ts` passed; `npx prisma migrate dev` clean; Next.js 15 build pass |
| **Phase 2** | GSC Ingestion & Striking Distance Classifier | **COMPLETE** | `tests/phase2_exit.test.ts` passed; RSA-SHA256 JWT verifier clean; Delta tracking active |
| **Phase 3** | AI Generation & Decoupled Data Store | **COMPLETE** | `tests/phase3_exit.test.ts` passed; Schema.org FAQPage verified; XSS sanitization pass |
| **Phase 4** | Git Deployment & Build Sandbox Safety Net | **PENDING** | Next up (Octokit branch/PR automation, `npm run build` rollback guard, Stripe billing) |
| **Phase 5** | Executive Dashboard, Reporting & Launch | **PENDING** | ECharts/Recharts, Resend email digest, sitemap ping, production deploy |

---

## 2. Implemented Architecture (Phase 1)

### 2.1 Technology Stack
- **Frontend & App Framework**: Next.js 15.5 (App Router) + React 19 + TypeScript (`strict: true`).
- **Styling**: Tailwind CSS (cyber-dark theme with custom cyan, emerald, violet, and obsidian tokens) + Radix UI primitives + Lucide Icons.
- **ORM & Database**: Prisma ORM 6.4 + PostgreSQL 17 + `pgvector` extension enabled.
- **Security & Cryptography**: Native Node.js `crypto` with authenticated AES-256-GCM encryption for stored API tokens.
- **Input & Route Validation**: Zod schema parsing across all incoming payloads.

### 2.2 Database Models Implemented (`prisma/schema.prisma`)
1. `User`: Single source of truth for authenticated user profiles.
2. `Workspace`: Multi-tenant organization boundaries with `PlanTier` (`FREE`, `STARTER`, `PRO`, `AGENCY`).
3. `WorkspaceMember`: RBAC junction (`OWNER`, `ADMIN`, `MEMBER`).
4. `Project`: Tracked domains, GSC property bindings, `DeploymentMode` (`AUTO_PR`, `DIRECT_COMMIT`, `WEBHOOK_ONLY`), and encrypted credential storage (`githubTokenEnc`, `gscServiceAccountJsonEnc`).
5. `SearchSnapshot`: Time-series Search Console crawl records (impressions, clicks, CTR, position).
6. `RankedQuery`: Individual search queries with `isStrikingDistance` boolean flag and position deltas.
7. `Competitor`: Discovered SERP competitor domains, scraped headings, and extracted topics.
8. `EnrichmentAction`: Staged E-E-A-T assets (FAQs, comparison matrices, code snippets, metadata).
9. `DeploymentAudit`: Immutable deployment event log (`BUILD_PASSED`, `BUILD_FAILED`, `COMMIT_SUCCESS`, `ROLLBACK_TRIGGERED`).

---

## 3. Verified Security & RBAC Guardrails

- **Zero Plaintext Secrets**: `githubTokenEnc` and `gscServiceAccountJsonEnc` are encrypted with 32-byte AES-256-GCM with 96-bit IVs and 128-bit authentication tags before touching the database.
- **Tamper Resistance**: Unit tested in `tests/crypto.test.ts`. Any alteration to the ciphertext or auth tag throws an immediate authentication failure.
- **Tenant Isolation**: Every mutating API route (`/api/v1/workspaces`, `/api/v1/projects`) validates the caller's membership and minimum role level (`validateWorkspaceMembership`). Non-members receive a `403 ForbiddenError`.
- **Safe Output Sanitization**: Secret hashes are explicitly omitted from JSON API serialization.

---

## 4. Test & Verification Log

```bash
# 1. AES-256-GCM Crypto Tests
npm run test:crypto
# Output:
# ▶ Running AES-256-GCM Crypto Tests...
#   ✓ Happy path: Round-trip encryption and decryption matches verbatim
#   ✓ Tamper detection: Modified ciphertext throws authentication failure
#   ✓ Format validation: Malformed string is rejected
# ✅ All AES-256-GCM tests passed successfully.

# 2. Striking Distance & RBAC Smoke Tests
npm run test:smoke
# Output:
# 1. Testing AES-256-GCM Encryption At Rest:
#    ✓ AES-256-GCM round-trip encryption verified.
#    ✓ Tamper protection (Auth Tag validation) verified.
# 2. Testing Striking Distance Classification Boundary Logic (Pos 11.0–30.0):
#    ✓ Boundary 10.0 (Page 1) → false
#    ✓ Boundary 10.1 (Striking Distance start) → true
#    ✓ Boundary 30.0 (Striking Distance end) → true
#    ✓ Boundary 30.1 (Page 4) → false
#    ✓ Impression threshold filtering verified.
# 3. Testing RBAC Role Hierarchy Levels:
#    ✓ Workspace RBAC hierarchy (OWNER > ADMIN > MEMBER) verified.
# ✅ ALL PHASE 1 SMOKE TESTS PASSED CLEANLY.

# 3. Phase 1 Exit Criteria Verification
npm run test:phase1
# Output:
#   ✓ 1. User created
#   ✓ 2. Workspace created & signed-in user assigned OWNER role
#   ✓ 3. Verified empty project list: [] (Exit Criteria Satisfied)
#   ✓ 4. RBAC: Workspace membership confirmed for OWNER
#   ✓ 5. RBAC: Unauthorized user denied access (ForbiddenError thrown)
#   ✓ 6. Project created with verified AES-256-GCM encrypted credentials at rest
#   ✓ 7. Test fixtures cleanly pruned from database
# 🏆 ALL PHASE 1 EXIT CRITERIA FULLY VERIFIED.

# 4. TypeScript Typecheck
npm run typecheck
# Output: Exit Code 0 (Strict mode, 0 errors)

# 5. Production Next.js Build
npm run build
# Output: ✓ Compiled successfully in 3.1s (10 static & dynamic routes generated)

# 6. Full Suite Test Verification
npm run test:all
# Output:
#   ✓ AES-256-GCM Crypto Tests passed
#   ✓ Smoke & Boundary Tests passed
#   ✓ GSC RSA-SHA256 JWT assertion generation & verification passed
#   ✓ Striking Distance boundary, threshold & delta calculations passed
#   ✓ AI Content Sanitizer & XSS Guard passed (strict allowlist, script breakout protection)
#   ✓ AI E-E-A-T Generator passed (FAQPage JSON-LD, comparison matrix, meta tags)
#   ✓ Phase 1 multi-tenant DB exit criteria passed
#   ✓ Phase 2 end-to-end GSC ingestion & consecutive delta exit criteria passed
#   ✓ Phase 3 decoupled data store & enrichment action lifecycle exit criteria passed
# 🏆 ALL 9 TEST SUITES PASSING (0 errors)
```

---

## 5. Live Environment Details

- **Application Dev Server**: Next.js 15.5 on `http://localhost:3000`.
- **Database Service**: PostgreSQL 17 running on port 5432 with `pgvector`.
- **Database URL**: `postgresql://abinschandran@localhost:5432/omnirank?schema=public`
- **Initial Migration**: `prisma/migrations/20260915124736_init/migration.sql`

---

## 6. Next Step: Phase 4 Scope (Git Deployment & Build Sandbox Safety Net)

When instructed to proceed to Phase 4:
1. Implement Octokit GitHub automation (`lib/deployment/git.ts`) to programmatically branch, commit staged E-E-A-T assets, and open pull requests.
2. Build an isolated build sandbox (`lib/deployment/sandbox.ts`) that executes dry-run validation (`npm run build`, `npm run typecheck`) and triggers automated rollbacks if errors occur.
3. Integrate Stripe billing webhook (`app/api/v1/billing/webhook/route.ts`) enforcing workspace tier usage caps (`FREE`, `STARTER`, `PRO`, `AGENCY`).
4. Record immutable audit trails in the `DeploymentAudit` table for every pull request, commit, and build event.

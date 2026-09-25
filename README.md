# OmniRank — Autonomous Search Console Intelligence & Content Optimization Engine

> **OmniRank** is an autonomous, self-driving SEO platform that connects to Google Search Console (GSC), isolates high-ROI "Striking Distance" keywords (positions 11.0–30.0), reverse-engineers competitors, generates schema markup and high-E-E-A-T content updates, validates builds in an isolated sandbox, and deploys updates via Git/CMS.

---

## Architecture Overview

```
Google Search Console API ──> Striking Distance Classifier (Pos 11.0 - 30.0)
                                      │
                                      ▼
                      Dual-Engine AI Generator (Gemini / Claude)
                                      │
                                      ▼
                         Strict HTML/XSS Sanitizer Guard
                                      │
                                      ▼
                        Decoupled Data Store (PostgreSQL)
                                      │
                                      ▼
                      Autonomous Git Branch / PR Deployment
```

---

## Features

- **Multi-Tenant Foundation & RBAC**: Organization isolation, workspace membership, and tiered roles (`OWNER`, `ADMIN`, `MEMBER`).
- **Cryptographic Security at Rest**: AES-256-GCM encryption with 96-bit IVs and 128-bit authentication tags for external tokens and service account keys.
- **Search Console Ingestion Pipeline**: Native RSA-SHA256 OAuth2 Service Account assertion signer (`lib/gsc/jwt.ts`) and resilient background queue worker (`lib/gsc/queue.ts`).
- **Striking Distance Classifier**: Isolates search queries in positions 11.0 to 30.0 with significant impressions, tracking week-over-week rank deltas.
- **High-E-E-A-T AI Generator**: Produces Schema.org `FAQPage` JSON-LD schemas, technical comparison matrices, code snippets, and high-CTR meta tags.
- **Strict Content Sanitizer**: Whitelist-based HTML sanitization with closing-script breakout protection to eliminate XSS vectors.
- **Cyber-Dark Command Shell**: Next.js 15 App Router dashboard with live search radar metrics, opportunity filters, and staged action management.

---

## Tech Stack

- **Framework**: [Next.js 15.5](https://nextjs.org/) (App Router) + [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Database & ORM**: [PostgreSQL 17](https://www.postgresql.org/) + `pgvector` + [Prisma ORM 6.4](https://www.prisma.io/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Cyber-Dark theme) + [Radix UI](https://www.radix-ui.com/) + [Lucide Icons](https://lucide.dev/)
- **Security & Sanitization**: Native Node.js `crypto` + [`sanitize-html`](https://github.com/apostrophecms/sanitize-html)
- **Validation**: [Zod](https://zod.dev/)

---

## Quickstart

### 1. Prerequisites
- Node.js 20+ / 22+
- PostgreSQL 17 with `pgvector` extension

### 2. Environment Setup
```bash
cp .env.example .env
# Configure DATABASE_URL and generate 32-byte ENCRYPTION_KEY
```

### 3. Database Migration
```bash
npm install
npx prisma migrate dev
```

### 4. Running the Development Server
```bash
npm run dev
# Open http://localhost:3000
```

---

## Test Verification Suites

Run all automated test suites covering crypto, RBAC, GSC JWT signing, striking-distance boundaries, content sanitization, and database integration:

```bash
# Run all 9 test suites
npm run test:all

# Individual test runners:
npm run test:crypto      # AES-256-GCM authenticated encryption & tamper protection
npm run test:smoke       # Striking-distance boundary & RBAC hierarchy
npm run test:gsc         # RSA-SHA256 Service Account JWT assertion generator
npm run test:classifier  # Boundary logic & rank delta computation
npm run test:sanitizer   # HTML sanitization & XSS guardrails
npm run test:ai          # E-E-A-T FAQ, comparison matrix & metadata generator
npm run test:phase1      # Multi-tenant DB isolation exit criteria
npm run test:phase2      # GSC ingestion & consecutive delta exit criteria
npm run test:phase3      # Decoupled store & AI staging exit criteria
```

---

## License

Private — Tekora Inhouse Systems.

# OmniRank Standalone Background Queue Worker Container
# Multi-stage production container decoupled from web traffic

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

# Stage 1: Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# Stage 2: Prisma Client generation & build runner
FROM base AS runner
ENV NODE_ENV=production
ENV WORKER_CONCURRENCY=4
ENV WORKER_POLL_INTERVAL_MS=2000

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client for alpine linux
RUN npx prisma generate

# Run standalone queue daemon
CMD ["npx", "tsx", "lib/queue/worker-runner.ts"]

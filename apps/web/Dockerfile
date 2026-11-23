# ==========================================
# CivicTrack Web (Next.js) Production Dockerfile
# ==========================================

# 1. Build stage
FROM node:24-alpine AS builder
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy monorepo configuration
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY packages/config ./packages/config
COPY apps/web ./apps/web

# Install dependencies
RUN npm ci --include=dev

# Build shared contracts, then Next.js web application
RUN npm run build --workspace=@civictrack/contracts
RUN npm run build --workspace=@civictrack/web

# 2. Production runtime stage
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Install wget for healthcheck
RUN apk add --no-cache wget

# Create non-root application user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy monorepo structure and compiled assets
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/packages/contracts ./packages/contracts
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["npm", "run", "start", "--workspace=@civictrack/web"]

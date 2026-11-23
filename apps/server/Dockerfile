# ==========================================
# CivicTrack Server Production Dockerfile
# ==========================================

# 1. Build stage
FROM node:24-alpine AS builder
WORKDIR /app

# Copy root monorepo config
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY packages/config ./packages/config
COPY apps/server ./apps/server

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Compile TypeScript packages
RUN npm run build --workspace=@civictrack/contracts
RUN npm run build --workspace=@civictrack/server

# Prune devDependencies to keep image lean
RUN npm prune --omit=dev

# 2. Production runtime stage
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install wget for container health checks
RUN apk add --no-cache wget

# Create non-privileged service user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 civictrack

# Copy monorepo runtime assets
COPY --from=builder --chown=civictrack:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=civictrack:nodejs /app/package.json ./package.json
COPY --from=builder --chown=civictrack:nodejs /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=builder --chown=civictrack:nodejs /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder --chown=civictrack:nodejs /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder --chown=civictrack:nodejs /app/apps/server/dist ./apps/server/dist

USER civictrack

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "apps/server/dist/server.js"]

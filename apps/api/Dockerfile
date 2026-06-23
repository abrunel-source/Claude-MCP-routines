# ============================================================================
# Cadence API — GCP Cloud Run artifact (12-factor, stateless, env-configured).
# Builds and runs identically to the Vercel deployment path.
# ============================================================================
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# --- Dependencies ---------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY libs/shared-types/package.json libs/shared-types/package.json
COPY libs/core/package.json libs/core/package.json
COPY libs/adapters/package.json libs/adapters/package.json
RUN pnpm install --frozen-lockfile=false

# --- Build ----------------------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm prisma generate --schema prisma/schema.prisma
RUN pnpm nx run api:build

# --- Runtime --------------------------------------------------------------
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist/apps/api ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "main.js"]

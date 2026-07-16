# Responder service image. Build context is the REPO ROOT (pnpm workspace):
#   docker build -f apps/responder/Dockerfile .
FROM node:22-slim

# git: the agent's investigation tools and the PR service shell out to it.
# python3/make/g++: fallback toolchain for better-sqlite3 if no prebuilt binary.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@11

WORKDIR /app

# Manifests first so dependency layers cache across source-only changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/responder/package.json apps/responder/
RUN pnpm install --frozen-lockfile --filter @sre/shared --filter responder

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/responder apps/responder
RUN pnpm --filter @sre/shared build && pnpm --filter responder build

WORKDIR /app/apps/responder
EXPOSE 3001
CMD ["sh", "scripts/render-start.sh"]

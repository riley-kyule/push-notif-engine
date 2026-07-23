# Build from the repository root:
# docker build -f infrastructure/deployment/Dockerfile -t exotic-push-engine:<commit> .
FROM node:22-bookworm-slim AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY services/api/package.json services/api/package.json
COPY services/worker/package.json services/worker/package.json
RUN npm ci

COPY . .
RUN npm run build --workspace @epe/api \
 && npm run build --workspace @epe/worker \
 && npm run build --workspace @epe/dashboard \
 && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo

# pg_dump is required by full-system backups. ca-certificates is required for
# push providers, OAuth, CRM callbacks, and S3-compatible storage.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates postgresql-client \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /repo/package.json /repo/package-lock.json ./
COPY --from=build --chown=node:node /repo/node_modules node_modules
COPY --from=build --chown=node:node /repo/apps/dashboard/package.json apps/dashboard/package.json
COPY --from=build --chown=node:node /repo/apps/dashboard/.next apps/dashboard/.next
COPY --from=build --chown=node:node /repo/apps/dashboard/public apps/dashboard/public
COPY --from=build --chown=node:node /repo/apps/dashboard/next.config.mjs apps/dashboard/next.config.mjs
COPY --from=build --chown=node:node /repo/services/api/package.json services/api/package.json
COPY --from=build --chown=node:node /repo/services/api/dist services/api/dist
COPY --from=build --chown=node:node /repo/services/api/scripts services/api/scripts
COPY --from=build --chown=node:node /repo/services/worker/package.json services/worker/package.json
COPY --from=build --chown=node:node /repo/services/worker/dist services/worker/dist
COPY --from=build --chown=node:node /repo/infrastructure/database/migrations infrastructure/database/migrations

USER node
CMD ["node", "services/api/dist/main.js"]

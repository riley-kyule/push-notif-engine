# Build context must be the monorepo root: docker build -f services/worker/Dockerfile .
# Production worker image. Build context must remain the repository root.
FROM node:22-slim AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY services/worker/package.json services/worker/package.json

RUN npm ci

COPY tsconfig.base.json ./
COPY services/worker services/worker

RUN npm run build --workspace=@epe/worker

FROM node:22-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY services/worker/package.json services/worker/package.json

RUN npm ci --omit=dev --workspace=@epe/worker

COPY --from=build --chown=node:node /repo/services/worker/dist services/worker/dist

WORKDIR /repo/services/worker
USER node
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD ["node", "dist/src/healthcheck.js"]
CMD ["node", "dist/src/main.js"]

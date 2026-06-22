# Build context must be the monorepo root: docker build -f services/worker/Dockerfile .
# Optional artifact for running the worker in a container (e.g. for local dev or a
# non-cPanel environment). The documented production path remains cPanel VPS + PM2.
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

COPY --from=build /repo/services/worker/dist services/worker/dist

WORKDIR /repo/services/worker
CMD ["node", "dist/src/main.js"]

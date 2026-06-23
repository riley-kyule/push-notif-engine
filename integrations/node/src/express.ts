import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildManifest, buildServiceWorkerScript, type NodePushStarterConfig } from "./index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// The vendored EPE SDK (same file the WordPress plugin bundles). Express serves it
// as a static file via `express.static(sdkAssetsDir)` — see mountEpePush below.
export const sdkAssetsDir = path.join(currentDir, "..", "assets");

// Minimal duck-typed shapes so this has no hard dependency on @types/express —
// any Express (or Express-compatible) req/res satisfies these.
interface MinimalResponse {
  type(contentType: string): unknown;
  send(body: string): unknown;
}

export function pushServiceWorkerHandler(config: NodePushStarterConfig) {
  const script = buildServiceWorkerScript(config);
  return (_req: unknown, res: MinimalResponse): void => {
    res.type("application/javascript");
    res.send(script);
  };
}

export function manifestHandler(config: NodePushStarterConfig) {
  const manifest = buildManifest(config);
  return (_req: unknown, res: MinimalResponse): void => {
    res.type("application/manifest+json");
    res.send(manifest);
  };
}

// Minimal shape of an Express app/router — avoids a hard @types/express dependency
// while still type-checking the calls this function actually makes.
interface MinimalExpressApp {
  get(routePath: string, handler: (req: unknown, res: MinimalResponse) => void): unknown;
  use(routePath: string, handler: unknown): unknown;
}

// One-liner install for an Express app: app.use(mountEpePush(app, config)).
// Registers GET /push-sw.js and /manifest.json (generated from config, no static
// files to manage) and serves the vendored SDK at /assets/epe-sdk.js. Caller still
// needs to add buildBootstrapSnippet(config)'s output to their page template.
export function mountEpePush(app: MinimalExpressApp, config: NodePushStarterConfig, expressStatic: (dir: string) => unknown): void {
  app.get(config.serviceWorkerUrl ?? "/push-sw.js", pushServiceWorkerHandler(config));
  app.get(config.manifestUrl ?? "/manifest.json", manifestHandler(config));
  app.use("/assets", expressStatic(sdkAssetsDir));
}

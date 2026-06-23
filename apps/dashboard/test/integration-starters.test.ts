import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd(), "../..");

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("node integration starter exposes bootstrap and manifest helpers", () => {
  const source = readFile("integrations/node/src/index.ts");
  const packageJson = readFile("integrations/node/package.json");
  assert.match(source, /buildBootstrapSnippet/);
  assert.match(source, /buildManifest/);
  assert.match(source, /buildServiceWorkerScript/);
  assert.match(packageJson, /@epe\/node-starter/);
});

test("node integration starter ships an install-and-go Express mount plus the vendored SDK", () => {
  const expressIntegration = readFile("integrations/node/src/express.ts");
  const packageJson = readFile("integrations/node/package.json");
  const sdk = readFile("integrations/node/assets/epe-sdk.js");

  assert.match(expressIntegration, /mountEpePush/);
  assert.match(expressIntegration, /pushServiceWorkerHandler/);
  assert.match(expressIntegration, /manifestHandler/);
  assert.match(expressIntegration, /sdkAssetsDir/);
  assert.match(packageJson, /"\.\/express": "\.\/src\/express\.ts"/);
  assert.ok(sdk.length > 1000, "expected the vendored SDK to be a real, non-trivial file");
});

test("laravel integration starter exposes a service provider and blade bootstrap", () => {
  const provider = readFile("integrations/laravel/src/EpePushServiceProvider.php");
  const blade = readFile("integrations/laravel/resources/views/bootstrap.blade.php");
  const config = readFile("integrations/laravel/config/epe-push.php");
  const composer = readFile("integrations/laravel/composer.json");

  assert.match(provider, /mergeConfigFrom/);
  assert.match(provider, /loadViewsFrom/);
  assert.match(blade, /ExoticPushEngineConfig/);
  assert.match(blade, /epe-sdk\.js/);
  assert.match(config, /EPE_API_URL/);
  assert.match(config, /EPE_SITE_KEY/);
  assert.match(composer, /epe\/laravel-starter/);
});

test("laravel integration starter auto-registers routes instead of requiring published files", () => {
  const provider = readFile("integrations/laravel/src/EpePushServiceProvider.php");
  const epePush = readFile("integrations/laravel/src/EpePush.php");
  const sdk = readFile("integrations/laravel/resources/vendor-assets/epe-sdk.js");

  assert.match(provider, /registerRoutes/);
  assert.match(provider, /Route::get/);
  assert.match(provider, /epe-sdk\.js/);
  assert.match(epePush, /manifestJson/);
  assert.match(epePush, /serviceWorkerScript/);
  assert.ok(sdk.length > 1000, "expected the vendored SDK to be a real, non-trivial file");
});

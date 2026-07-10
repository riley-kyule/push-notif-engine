import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const pluginRoot = path.resolve(process.cwd(), "..", "..", "integrations", "wordpress", "epe-push");

test("wordpress plugin scaffold exposes expected endpoints and settings", () => {
  const pluginFile = readFileSync(path.join(pluginRoot, "epe-push.php"), "utf8");
  const readmeFile = readFileSync(path.join(pluginRoot, "README.md"), "utf8");

  assert.match(pluginFile, /push-sw\.js/);
  assert.match(pluginFile, /manifest\.json/);
  assert.match(pluginFile, /wp_enqueue_scripts/);
  assert.match(pluginFile, /wp_head/);
  assert.match(pluginFile, /rel="manifest"/);
  assert.match(pluginFile, /add_options_page/);
  assert.match(pluginFile, /epe_subscribe_button/);
  assert.match(readmeFile, /CSP guidance/);
  assert.match(readmeFile, /browser push only/i);
  assert.match(readmeFile, /\[epe_subscribe_button\]/);
});

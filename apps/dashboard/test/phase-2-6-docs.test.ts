import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const docsRoot = path.resolve(process.cwd(), "..", "..", "docs");

test("phase 2.6 platform guides exist", () => {
  const magento = readFileSync(path.join(docsRoot, "phase-2-6-magento.md"), "utf8");
  const nodejs = readFileSync(path.join(docsRoot, "phase-2-6-nodejs.md"), "utf8");
  const laravel = readFileSync(path.join(docsRoot, "phase-2-6-laravel.md"), "utf8");

  assert.match(magento, /Magento 2 Integration Guide/);
  assert.match(magento, /Service Worker/);
  assert.match(nodejs, /Node\.js Integration Guide/);
  assert.match(nodejs, /API Registration/);
  assert.match(laravel, /Laravel Integration Guide/);
  assert.match(laravel, /Blade Snippet/);
});

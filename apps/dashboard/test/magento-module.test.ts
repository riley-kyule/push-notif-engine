import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const moduleRoot = path.resolve(process.cwd(), "..", "..", "integrations", "magento", "Exotic", "PushEngine");

test("magento module scaffold exposes expected storefront config and admin settings", () => {
  const registration = readFileSync(path.join(moduleRoot, "registration.php"), "utf8");
  const moduleXml = readFileSync(path.join(moduleRoot, "etc", "module.xml"), "utf8");
  const systemXml = readFileSync(path.join(moduleRoot, "etc", "adminhtml", "system.xml"), "utf8");
  const template = readFileSync(path.join(moduleRoot, "view", "frontend", "templates", "config.phtml"), "utf8");
  const readme = readFileSync(path.join(moduleRoot, "../../README.md"), "utf8");

  assert.match(registration, /Exotic_PushEngine/);
  assert.match(moduleXml, /Exotic_PushEngine/);
  assert.match(systemXml, /EPE Push Engine/);
  assert.match(systemXml, /api_url/);
  assert.match(template, /window\.ExoticPushEngineConfig/);
  assert.match(template, /push-sw\.js/);
  assert.match(readme, /Magento integration scaffold/);
});

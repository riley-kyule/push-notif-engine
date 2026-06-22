import assert from "node:assert/strict";
import test from "node:test";

import BackupConfigPage from "../app/platform/backup-config/page";

test("backup config page exists", () => {
  assert.equal(typeof BackupConfigPage, "function");
});

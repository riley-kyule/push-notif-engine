#!/usr/bin/env node
// Idempotent migration runner. Tracks applied migrations in a `schema_migrations`
// table so re-running this script (e.g. on every deploy) only applies new files.
//
// Usage: node scripts/migrate.mjs (reads services/api/.env automatically)
//     or: DATABASE_URL=postgresql://... node scripts/migrate.mjs

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../../infrastructure/database/migrations");

// PM2 parses services/api/.env itself (see ecosystem.config.js) and injects it
// into the app's environment, but running this script directly in a shell --
// which is the normal way to run migrations during a deploy -- has no .env
// loaded at all. Mirror that same parsing here so `npm run migrate` works
// standalone instead of silently requiring DATABASE_URL to already be exported.
function loadEnvFile() {
  const envPath = path.resolve(__dirname, "../.env");
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] === undefined) {
      process.env[key] = trimmed.slice(eq + 1).trim();
    }
  }
}

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  loadEnvFile();
  const pool = new Pool({ connectionString: readRequiredEnv("DATABASE_URL") });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: appliedRows } = await pool.query("SELECT filename FROM schema_migrations");
    const applied = new Set(appliedRows.map((row) => row.filename));

    const files = readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`Applying ${file}...`);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        appliedCount += 1;
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    }

    if (appliedCount === 0) {
      console.log("No pending migrations — database is up to date.");
    } else {
      console.log(`Applied ${appliedCount} migration(s).`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

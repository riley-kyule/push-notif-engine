import crypto from "node:crypto";
import pg from "pg";

const prefix = "epe:vapid:v1:";
const databaseUrl = process.env.DATABASE_URL;
const rawKey = process.env.VAPID_KEY_ENCRYPTION_KEY;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!rawKey) throw new Error("VAPID_KEY_ENCRYPTION_KEY is required");
const key = Buffer.from(rawKey, "base64");
if (key.length !== 32) throw new Error("VAPID_KEY_ENCRYPTION_KEY must decode to exactly 32 bytes");

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${prefix}${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query(
    `SELECT id, vapid_private_key FROM sites
     WHERE vapid_private_key IS NOT NULL AND vapid_private_key NOT LIKE 'epe:vapid:v1:%'
     FOR UPDATE`,
  );
  for (const row of rows) {
    await client.query("UPDATE sites SET vapid_private_key = $2, updated_at = NOW() WHERE id = $1", [row.id, encrypt(row.vapid_private_key)]);
  }
  await client.query("COMMIT");
  console.log(`Encrypted ${rows.length} VAPID private key(s). No key material was printed.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

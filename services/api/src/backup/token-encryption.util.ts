import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.BACKUP_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("Missing required environment variable: BACKUP_TOKEN_ENCRYPTION_KEY");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("BACKUP_TOKEN_ENCRYPTION_KEY must base64-decode to exactly 32 bytes (e.g. openssl rand -base64 32)");
  }

  return key;
}

// OAuth refresh tokens are long-lived credentials to a customer's cloud storage
// account — encrypted at rest (AES-256-GCM) rather than stored as plaintext, unlike
// some other secrets in this codebase (e.g. VAPID keys) where the blast radius of
// exposure is much smaller.
export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted token payload");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

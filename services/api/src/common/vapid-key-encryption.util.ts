import crypto from "node:crypto";

const PREFIX = "epe:vapid:v1:";

function encryptionKey(): Buffer {
  const value = process.env.VAPID_KEY_ENCRYPTION_KEY;
  if (!value) throw new Error("Missing required environment variable: VAPID_KEY_ENCRYPTION_KEY");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("VAPID_KEY_ENCRYPTION_KEY must base64-decode to exactly 32 bytes");
  return key;
}

export function encryptVapidPrivateKey(value: string): string {
  if (value.startsWith(PREFIX)) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptVapidPrivateKey(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const parts = value.slice(PREFIX.length).split(".");
  if (parts.length !== 3) throw new Error("Malformed encrypted VAPID private key");
  const [iv, tag, ciphertext] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv!, "base64url"));
  decipher.setAuthTag(Buffer.from(tag!, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext!, "base64url")), decipher.final()]).toString("utf8");
}

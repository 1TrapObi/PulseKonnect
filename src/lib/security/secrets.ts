import "server-only";

import crypto from "crypto";

type EncryptedPayload = {
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  data: string;
};

function getKey() {
  const raw = String(process.env.PK_ENCRYPTION_KEY ?? "");
  if (!raw || raw.trim().length < 32) {
    throw new Error("Missing or invalid PK_ENCRYPTION_KEY (must be 32+ chars)");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptString(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: enc.toString("base64"),
  };

  return JSON.stringify(payload);
}

export function decryptString(ciphertext: string): string {
  const key = getKey();

  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(String(ciphertext)) as EncryptedPayload;
  } catch {
    throw new Error("Invalid encrypted payload");
  }

  if (!payload || payload.alg !== "aes-256-gcm") {
    throw new Error("Unsupported encryption payload");
  }

  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const data = Buffer.from(payload.data, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

export function encryptJson(value: unknown): string {
  return encryptString(JSON.stringify(value ?? null));
}

export function decryptJson<T = any>(ciphertext: string): T {
  const raw = decryptString(ciphertext);
  return JSON.parse(raw) as T;
}

export function maskSecretLast4(secret: string): string {
  const s = String(secret ?? "");
  const last4 = s.slice(-4);
  if (!last4) return "••••";
  return `••••••${last4}`;
}

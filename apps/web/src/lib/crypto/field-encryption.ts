import crypto from "node:crypto";
import type { DealPartyPiiVault, EncryptedAtom } from "@/lib/types/pii-vault";

export const KMS_ENV_LABEL = "env:FIELD_ENCRYPTION_KEY:v1";

export type { EncryptedAtom };

function keyBytes(): Buffer {
  const b64 = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (!b64) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY is not set (required to encrypt or decrypt sensitive party fields).",
    );
  }
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).");
  }
  return buf;
}

export function encryptUtf8(plaintext: string): EncryptedAtom {
  const key = keyBytes();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: "AES-256-GCM",
    ivB64: iv.toString("base64"),
    ctB64: ct.toString("base64"),
    tagB64: tag.toString("base64"),
  };
}

export function decryptUtf8(blob: EncryptedAtom): string {
  const key = keyBytes();
  const iv = Buffer.from(blob.ivB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(Buffer.from(blob.tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(blob.ctB64, "base64")), decipher.final()]).toString(
    "utf8",
  );
}

/** Merge encrypted atoms into the JSON vault stored on `DealParty.encryptedPii`. */
export function buildPiiVault(patch: Partial<DealPartyPiiVault["fields"]>): DealPartyPiiVault {
  return {
    v: 1,
    kmsKeyId: KMS_ENV_LABEL,
    fields: { ...patch },
  };
}

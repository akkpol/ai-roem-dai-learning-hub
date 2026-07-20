import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

export type AuthEmailIntent = {
  template: "verify_email" | "reset_password" | "deletion_confirmation";
  email: string;
  token: string;
  url: string;
};

export function encryptAuthEmailIntent(
  intent: AuthEmailIntent,
  key: Buffer,
): string {
  if (key.length !== 32) throw new Error("authentication email key is invalid");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(intent), "utf8"),
    cipher.final(),
  ]);
  return ["v1", iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

export function decryptAuthEmailIntent(
  payload: string,
  key: Buffer,
): AuthEmailIntent {
  try {
    const [version, encodedIv, encodedTag, encodedCiphertext] = payload.split(".");
    if (
      version !== "v1" ||
      !encodedIv ||
      !encodedTag ||
      !encodedCiphertext ||
      key.length !== 32
    ) {
      throw new Error("invalid");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(encodedIv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as AuthEmailIntent;
  } catch {
    throw new Error("authentication email payload is invalid");
  }
}

export function hashAuthEmailRecipient(email: string, key: Buffer): string {
  return createHmac("sha256", key)
    .update(email.trim().toLowerCase())
    .digest("hex");
}

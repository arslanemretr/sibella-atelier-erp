import crypto from "node:crypto";

export const HASH_PREFIX = "pbkdf2$sha256";
const HASH_ITERATIONS = 210000;
const HASH_KEY_LENGTH = 32;

export function isPasswordHash(value) {
  return typeof value === "string" && value.startsWith(`${HASH_PREFIX}$`);
}

export function hashPassword(password) {
  const normalizedPassword = String(password || "");
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.pbkdf2Sync(normalizedPassword, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, "sha256").toString("hex");
  return `${HASH_PREFIX}$${HASH_ITERATIONS}$${salt}$${derivedKey}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }

  if (!isPasswordHash(storedHash)) {
    return String(password || "") === String(storedHash || "");
  }

  const [, , iterationsRaw, salt, expectedHash] = String(storedHash).split("$");
  const iterations = Number(iterationsRaw || HASH_ITERATIONS);
  const derivedKey = crypto.pbkdf2Sync(String(password || ""), salt, iterations, HASH_KEY_LENGTH, "sha256").toString("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(derivedKey, "hex"), Buffer.from(expectedHash, "hex"));
  } catch {
    return false;
  }
}

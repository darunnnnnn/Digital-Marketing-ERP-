// Password hashing with Node's built-in scrypt — no dependency to keep patched.
// Stored as "scrypt$<salt>$<hash>", both base64url.

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  pw: string,
  salt: Buffer,
  len: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;

  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64url"), expected.length);
  // Constant-time, so response timing doesn't leak how much of a guess was right.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

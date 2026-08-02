import "server-only";
import {
  randomBytes,
  scrypt as scryptCallback,
  type ScryptOptions,
  timingSafeEqual,
} from "node:crypto";

// Hand-rolled rather than promisify() so the options argument keeps its type.
function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derived) =>
      error ? reject(error) : resolve(derived),
    );
  });
}

/**
 * Password hashing with scrypt from node's stdlib — no dependency, and the
 * cost parameters travel inside the hash string so they can be raised later
 * without invalidating existing hashes.
 *
 * Format: scrypt:N:r:p:<salt-hex>:<hash-hex>
 *
 * Colons, not the conventional `$`, because Next.js expands `$VAR` when it
 * loads `.env` files — a `$`-delimited hash silently becomes garbage in local
 * development and the password then never matches.
 */

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
  });
  return `scrypt:${N}:${R}:${P}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.trim().split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");

  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      // Node's default maxmem is sized for N=16384; keep headroom if N is raised.
      maxmem: 256 * Number(n) * Number(r) * 2,
    });
  } catch {
    return false;
  }

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

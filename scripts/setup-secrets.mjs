#!/usr/bin/env node
/**
 * Prints the two secrets the app needs, ready to paste into `.env.local` or
 * Vercel's environment settings.
 *
 *   npm run secrets -- "your shared password"
 *
 * The password itself is never stored anywhere — only its scrypt hash.
 */
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run secrets -- "your shared password"');
  process.exit(1);
}

if (password.length < 8) {
  console.error("Pick a password of at least 8 characters.");
  process.exit(1);
}

const N = 16384;
const R = 8;
const P = 1;

const salt = randomBytes(16);
const derived = await scrypt(password.normalize("NFKC"), salt, 32, { N, r: R, p: P });
// Colon-delimited: Next expands `$VAR` when reading .env files, which would
// quietly corrupt a `$`-delimited hash. Keep in sync with lib/auth/password.ts.
const hash = `scrypt:${N}:${R}:${P}:${salt.toString("hex")}:${derived.toString("hex")}`;

console.log(`
Add these to .env.local (and to your Vercel project's environment variables):

EDIT_PASSWORD_HASH="${hash}"
SESSION_SECRET="${randomBytes(32).toString("base64url")}"
`);

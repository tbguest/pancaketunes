import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Sessions are a signed, HTTP-only cookie — no server-side store, which keeps
 * the app stateless and free to run on Vercel's serverless tier.
 *
 * Cookie value: base64url(payload) + "." + base64url(hmac-sha256(payload))
 */

const COOKIE_NAME = "pt_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — this is a family jam, not a bank.

type SessionPayload = { exp: number };

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters. Run: npm run secret",
    );
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function encode(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body), "utf8");
  const actual = Buffer.from(signature, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, encode({ exp: Date.now() + MAX_AGE_SECONDS * 1000 }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** True when the caller holds a valid, unexpired session cookie. */
export async function isSignedIn(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return Boolean(token && decode(token));
}

export class UnauthorizedError extends Error {
  constructor() {
    super("You need to sign in to make changes.");
    this.name = "UnauthorizedError";
  }
}

/**
 * Gate for every write path. Server Actions are public HTTP endpoints, so this
 * must be called inside the action itself — a UI check is not a check.
 */
export async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new UnauthorizedError();
}

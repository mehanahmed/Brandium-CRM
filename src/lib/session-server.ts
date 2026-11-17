import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/** Server-side login session, kept in a signed httpOnly cookie the browser cannot read or edit. */
export type ServerSession = { id: string; role: string; admin: boolean; exp: number };

const SESSION_COOKIE = "brandium_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// shortcut: without SESSION_SECRET the key is random per server start, so a restart signs
// everyone out; set SESSION_SECRET in .env to keep sessions across restarts.
// shortcut: role and status are fixed until the cookie expires (7 days); move sessions to a
// MySQL table if a banned user must lose access at once.
const secretCache = globalThis as typeof globalThis & { __brandiumSessionSecret?: string };
const secret = () =>
  process.env["SESSION_SECRET"] ||
  (secretCache.__brandiumSessionSecret ??= randomBytes(32).toString("hex"));

const sign = (payload: string) =>
  createHmac("sha256", secret()).update(payload).digest("base64url");

const isHttps = (req: Request) =>
  req.headers.get("x-forwarded-proto") === "https" || req.url.startsWith("https:");

function cookieHeader(req: Request, value: string, maxAge: number) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    isHttps(req) ? "; Secure" : ""
  }`;
}

export function setSessionCookie(
  req: Request,
  res: NextResponse,
  user: { id: string; role: string; admin: boolean },
) {
  const session: ServerSession = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  res.headers.append(
    "Set-Cookie",
    cookieHeader(req, `${payload}.${sign(payload)}`, MAX_AGE_SECONDS),
  );
}

export function clearSessionCookie(req: Request, res: NextResponse) {
  res.headers.append("Set-Cookie", cookieHeader(req, "", 0));
}

export function readSession(req: Request): ServerSession | null {
  const raw = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(
    req.headers.get("cookie") || "",
  )?.[1];
  const [payload, signature] = (raw || "").split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as ServerSession;
    return session.id && session.exp > Date.now() / 1000 ? session : null;
  } catch {
    return null;
  }
}

export const unauthorized = () =>
  NextResponse.json(
    { success: false, error: "Not signed in.", response: "Not signed in." },
    { status: 401 },
  );

export const forbidden = () =>
  NextResponse.json(
    { success: false, error: "Admin access required.", response: "Admin access required." },
    { status: 403 },
  );

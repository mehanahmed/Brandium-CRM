import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSingleMySQLConnection } from "@/lib/mysql-server";
import { ensureMySQLTablesExist } from "@/lib/auth.functions";
import { loadAppSettings } from "@/lib/app-settings-server";
import { DEFAULT_MAINTENANCE_MESSAGE } from "@/lib/app-settings";
import {
  clearRawCookie,
  clearSessionCookie,
  readSession,
  RETURN_COOKIE,
  setSessionCookie,
  unauthorized,
} from "@/lib/session-server";

/** Who the server says is signed in; the browser's stored copy is checked against this. */
export async function GET(req: Request) {
  const session = readSession(req);
  if (!session) return unauthorized();
  return NextResponse.json({ success: true, user: session });
}

/** Sign out. */
export async function DELETE(req: Request) {
  const res = NextResponse.json({ success: true });
  clearSessionCookie(req, res);
  // Logging out while using "View as" must also drop the saved admin session
  clearRawCookie(req, res, RETURN_COOKIE);
  return res;
}

// One message for "no such user" and "wrong password", so the form cannot be used to find
// out which emails have accounts.
const INVALID_LOGIN = "Invalid email or password.";

// An unknown email still pays for one bcrypt compare, so the answer time does not reveal it
const DUMMY_HASH = bcrypt.hashSync("brandium-no-such-user", 10);

// Failed attempts per email + IP. On globalThis so `next dev` reloads share it.
// shortcut: per process only; move to MySQL or Redis when running more than one server.
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
type Failures = Map<string, { count: number; resetAt: number }>;
const failureStore = globalThis as typeof globalThis & { __brandiumLoginFailures?: Failures };
const failures: Failures = (failureStore.__brandiumLoginFailures ??= new Map());

const attemptKey = (req: Request, email: string) =>
  `${email}|${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`;

function isLockedOut(key: string, now: number) {
  const entry = failures.get(key);
  if (entry && entry.resetAt <= now) failures.delete(key);
  return Boolean(entry && entry.resetAt > now && entry.count >= MAX_FAILURES);
}

function recordFailure(key: string, now: number) {
  if (failures.size > 10_000) {
    for (const [k, v] of failures) if (v.resetAt <= now) failures.delete(k);
  }
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= now)
    failures.set(key, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
  else entry.count += 1;
}

export async function POST(req: Request) {
  let conn: Awaited<ReturnType<typeof createSingleMySQLConnection>> | undefined;
  try {
    const { email: rawEmail, password: rawPassword } = await req.json();
    const email = String(rawEmail || "")
      .toLowerCase()
      .trim();
    const password = String(rawPassword || "");

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Please enter both email and password." },
        { status: 400 },
      );
    }

    const key = attemptKey(req, email);
    const now = Date.now();
    if (isLockedOut(key, now)) {
      return NextResponse.json(
        { success: false, error: "Too many failed attempts. Please try again in 15 minutes." },
        { status: 429 },
      );
    }

    conn = await createSingleMySQLConnection();
    await ensureMySQLTablesExist(conn);

    const [rows] = await conn.query(
      "SELECT id, name, email, password_hash, role, status, avatar_url, is_deleted FROM users WHERE LOWER(email) = ? AND is_deleted = 0 LIMIT 1",
      [email],
    );

    const userList = rows as Array<{
      id: string;
      name: string;
      email: string;
      password_hash: string;
      role: string;
      status: string;
      avatar_url: string | null;
      is_deleted: number;
    }>;

    const user = userList?.[0];

    // Async compare: compareSync blocked every other request for ~80 ms per attempt
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
    } catch {
      isMatch = false;
    }

    if (!user || !isMatch) {
      recordFailure(key, now);
      return NextResponse.json({ success: false, error: INVALID_LOGIN }, { status: 401 });
    }
    failures.delete(key);

    // Checked after the password, so only the account owner learns it is suspended
    if (user.status && user.status !== "Active") {
      return NextResponse.json(
        {
          success: false,
          isSuspended: true,
          error: "This user account is inactive or disabled. Contact administrator.",
        },
        { status: 403 },
      );
    }

    const userRoleRaw = String(user.role || "AGENT").trim();
    let permissions: string[] = [];
    try {
      const [permRows] = await conn.query(
        `SELECT DISTINCT p.id
         FROM permissions p
         INNER JOIN role_permissions rp ON rp.permission_id = p.id
         INNER JOIN roles r ON rp.role_id = r.id
         WHERE UPPER(TRIM(r.name)) = UPPER(TRIM(?)) OR UPPER(TRIM(r.id)) = UPPER(TRIM(?));`,
        [userRoleRaw, userRoleRaw],
      );
      if (Array.isArray(permRows)) {
        permissions = (permRows as Array<{ id: string }>).map((p) => String(p.id));
      }
    } catch (permErr) {
      console.warn("Could not fetch user permissions on login:", permErr);
    }

    const roleStr = userRoleRaw.toLowerCase();
    const isAdminUser = roleStr === "admin" || permissions.includes("perm-admin-roles");

    // Maintenance mode (Admin → Settings): only admins may sign in
    if (!isAdminUser) {
      const settings = await loadAppSettings(true);
      if (settings.maintenance_mode) {
        return NextResponse.json(
          {
            success: false,
            maintenance: true,
            error: settings.maintenance_message || DEFAULT_MAINTENANCE_MESSAGE,
          },
          { status: 503 },
        );
      }
    }

    const res = NextResponse.json({
      success: true,
      user: {
        id: String(user.id),
        name: String(user.name),
        email: String(user.email),
        role: roleStr,
        roleName: userRoleRaw,
        permissions,
        avatar_url: user.avatar_url,
      },
    });
    // Same admin rule as `isAdmin` in src/lib/auth.tsx
    setSessionCookie(req, res, {
      id: String(user.id),
      role: roleStr,
      admin: isAdminUser,
    });
    return res;
  } catch (err) {
    // Database details stay in the server log
    console.error("Login failed:", err);
    return NextResponse.json(
      { success: false, error: "Sign-in is unavailable right now. Please try again." },
      { status: 500 },
    );
  } finally {
    await conn?.end().catch(() => {});
  }
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSingleMySQLConnection } from "@/lib/mysql-server";
import { ensureMySQLTablesExist } from "@/lib/auth.functions";
import {
  clearSessionCookie,
  readSession,
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
  return res;
}

// One message for "no such user" and "wrong password", so the form cannot be used to find
// out which emails have accounts.
const INVALID_LOGIN = "Invalid email or password.";

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

    if (!userList || userList.length === 0 || !userList[0]) {
      return NextResponse.json({ success: false, error: INVALID_LOGIN }, { status: 401 });
    }

    const user = userList[0];

    let isMatch = false;
    if (user.password_hash) {
      try {
        isMatch = bcrypt.compareSync(password, user.password_hash);
      } catch {
        isMatch = false;
      }
    }

    if (!isMatch) {
      return NextResponse.json({ success: false, error: INVALID_LOGIN }, { status: 401 });
    }

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
      admin: roleStr === "admin" || permissions.includes("perm-admin-roles"),
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

import { NextResponse } from "next/server";
import { createSingleMySQLConnection } from "@/lib/mysql-server";
import {
  clearRawCookie,
  forbidden,
  readCookie,
  readSession,
  RETURN_COOKIE,
  setRawCookie,
  setSessionCookie,
  unauthorized,
  verifySessionValue,
} from "@/lib/session-server";
import { loadViewUser } from "@/lib/view-as-server";

const SESSION_COOKIE = "brandium_session";

/**
 * Admin "view as" a non-admin user: the session switches to that user, and the admin's own
 * signed session is kept in an httpOnly cookie so DELETE can hand it back.
 */
export async function POST(req: Request) {
  const session = readSession(req);
  if (!session) return unauthorized();
  if (!session.admin) return forbidden();
  if (session.viewAsBy) {
    return NextResponse.json(
      { success: false, error: "Return to admin before viewing as another user." },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => null)) as { userId?: unknown } | null;
  const userId = String(body?.userId || "");
  if (!userId || userId === session.id) {
    return NextResponse.json({ success: false, error: "Choose another user." }, { status: 400 });
  }

  const conn = await createSingleMySQLConnection();
  try {
    const target = await loadViewUser(conn, userId);
    if (!target) {
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }
    if (!target.active) {
      return NextResponse.json(
        { success: false, error: "This user is inactive." },
        { status: 403 },
      );
    }
    if (target.isAdmin) {
      return NextResponse.json(
        { success: false, error: "You can only view as non-admin users." },
        { status: 403 },
      );
    }

    const res = NextResponse.json({
      success: true,
      user: {
        id: target.id,
        name: target.name,
        email: target.email,
        role: target.role,
        roleName: target.roleName,
        permissions: target.permissions,
        avatar_url: target.avatar_url,
      },
    });
    // Keep the admin's current signed session so DELETE can restore it
    const adminCookie = readCookie(req, SESSION_COOKIE);
    if (!adminCookie) return unauthorized();
    setRawCookie(req, res, RETURN_COOKIE, adminCookie);
    setSessionCookie(req, res, {
      id: target.id,
      role: target.role,
      admin: false,
      viewAsBy: session.id,
    });
    return res;
  } catch (err) {
    console.error("View as failed:", err);
    return NextResponse.json(
      { success: false, error: "Could not switch user right now." },
      { status: 500 },
    );
  } finally {
    await conn.end().catch(() => {});
  }
}

/** Ends "view as" and restores the admin's own session. */
export async function DELETE(req: Request) {
  const session = readSession(req);
  if (!session?.viewAsBy) {
    return NextResponse.json({ success: false, error: "Not viewing as anyone." }, { status: 400 });
  }

  const adminCookie = readCookie(req, RETURN_COOKIE);
  const adminSession = verifySessionValue(adminCookie);
  if (
    !adminCookie ||
    !adminSession ||
    !adminSession.admin ||
    adminSession.id !== session.viewAsBy
  ) {
    const res = NextResponse.json(
      { success: false, error: "Admin session expired. Please sign in again." },
      { status: 403 },
    );
    clearRawCookie(req, res, RETURN_COOKIE);
    return res;
  }

  const conn = await createSingleMySQLConnection();
  try {
    const admin = await loadViewUser(conn, adminSession.id);
    if (!admin || !admin.isAdmin) {
      const res = NextResponse.json(
        { success: false, error: "Admin session expired. Please sign in again." },
        { status: 403 },
      );
      clearRawCookie(req, res, RETURN_COOKIE);
      return res;
    }

    const res = NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        roleName: admin.roleName,
        permissions: admin.permissions,
        avatar_url: admin.avatar_url,
      },
    });
    setRawCookie(req, res, SESSION_COOKIE, adminCookie);
    clearRawCookie(req, res, RETURN_COOKIE);
    return res;
  } catch (err) {
    console.error("Return to admin failed:", err);
    return NextResponse.json(
      { success: false, error: "Could not return to admin right now." },
      { status: 500 },
    );
  } finally {
    await conn.end().catch(() => {});
  }
}

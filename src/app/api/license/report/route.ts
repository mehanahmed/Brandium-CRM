import { NextResponse } from "next/server";
import { ALLOWED_HOSTS, verifyReport } from "@/lib/license";
import { lockForUnlicensedCopy } from "@/lib/app-settings-server";

/**
 * A copy of this app running on another domain calls this (signed) from its middleware.
 * The real site then switches maintenance mode on: non-admins are blocked until an admin
 * turns it off in Admin → Settings.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    host?: unknown;
    ts?: unknown;
    sig?: unknown;
  } | null;
  const host = typeof body?.host === "string" ? body.host.trim().toLowerCase().slice(0, 253) : "";
  const ts = typeof body?.ts === "number" ? body.ts : 0;
  const sig = typeof body?.sig === "string" ? body.sig : "";

  if (!host || ALLOWED_HOSTS.has(host) || !(await verifyReport(host, ts, sig))) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  try {
    await lockForUnlicensedCopy(host);
  } catch (err) {
    console.error("License lock failed:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

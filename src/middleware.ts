import { NextResponse, type NextRequest } from "next/server";
import { getLicenseStatus, requestHost } from "@/lib/license-service";

// License gate (7s model): without a key signed for this domain every page goes to /license and
// every API call gets 403. Changes need owner review (.github/CODEOWNERS).
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/license" || pathname === "/api/license") return NextResponse.next();
  if (getLicenseStatus(requestHost(req.headers)).valid) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: "Brandium CRM is not activated for this domain." },
      { status: 403 },
    );
  }
  // Built from the visitor's host: behind a proxy req.url holds the internal 127.0.0.1:3000
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  return NextResponse.redirect(`${proto.split(",")[0]}://${host.split(",")[0]}/license`);
}

export const config = {
  runtime: "nodejs",
  // Pages and APIs; Next's own files and static assets (anything with a dot) are skipped
  matcher: ["/((?!_next/|.*\\..*).*)"],
};

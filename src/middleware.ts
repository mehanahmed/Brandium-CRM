import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { ALLOWED_HOSTS, LICENSE_REPORT_URL, hostOf, signReport } from "@/lib/license";

// Domain lock: this app only answers on Brandium's own domain (plus local development).
// A copy running anywhere else reports itself to the real site, which then locks itself
// (maintenance mode) until an admin unlocks it. Changes need owner review (.github/CODEOWNERS).

let lastReportAt = 0;
const REPORT_EVERY_MS = 5 * 60_000; // one report per instance every 5 minutes, not per request

async function reportCopy(host: string) {
  try {
    const ts = Date.now();
    await fetch(LICENSE_REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, ts, sig: await signReport(host, ts) }),
      cache: "no-store",
    });
  } catch {
    // The real site is unreachable from here; the copy is still refused below
  }
}

export function middleware(req: NextRequest, event: NextFetchEvent) {
  const host = hostOf(req.headers.get("x-forwarded-host") || req.headers.get("host"));
  if (ALLOWED_HOSTS.has(host)) return NextResponse.next();

  if (Date.now() - lastReportAt > REPORT_EVERY_MS) {
    lastReportAt = Date.now();
    event.waitUntil(reportCopy(host));
  }
  return new NextResponse("This application is not licensed for this domain.", {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export const config = { matcher: "/:path*" };

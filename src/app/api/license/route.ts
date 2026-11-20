import { NextResponse } from "next/server";
import { activateLicense, getLicenseStatus, requestHost } from "@/lib/license-service";

const info = (host: string) => {
  const status = getLicenseStatus(host);
  return {
    host,
    activated: status.valid,
    dev: status.signature === "dev",
    client: status.payload?.client ?? null,
    expiresAt: status.payload?.exp ? new Date(status.payload.exp * 1000).toISOString() : null,
    error: status.valid ? null : (status.error ?? null),
  };
};

/** Public: the activation page shows whether this domain is activated. */
export function GET(req: Request) {
  return NextResponse.json(info(requestHost(req.headers)), {
    headers: { "Cache-Control": "no-store" },
  });
}

/** Public: only a key signed for this exact domain is accepted, so a stranger cannot do harm. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { key?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key.slice(0, 4000) : "";
  const host = requestHost(req.headers);
  if (!key.trim()) {
    return NextResponse.json({ success: false, error: "Enter the license key." }, { status: 400 });
  }
  try {
    const res = activateLicense(key, host);
    if (!res.valid) return NextResponse.json({ success: false, error: res.error }, { status: 400 });
  } catch (err) {
    console.error("License activation failed:", err);
    return NextResponse.json(
      { success: false, error: "Could not save the license key." },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true, ...info(host) });
}

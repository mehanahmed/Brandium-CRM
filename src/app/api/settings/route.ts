import { NextResponse } from "next/server";
import { z } from "zod";
import { forbidden, readSession, unauthorized } from "@/lib/session-server";
import { getRolePermissions } from "@/lib/data-scope-server";
import { loadAppSettings, saveAppSettings } from "@/lib/app-settings-server";

// Only our own uploaded JPG/PNG files (the PDF renderer draws only these two), or null = default
const letterhead = z
  .string()
  .trim()
  .regex(/^\/uploads\/[\w.-]+\.(jpe?g|png)$/i, "Upload a JPG or PNG image.")
  .nullable();

const updateSchema = z.object({
  invoice_bg_url: letterhead,
  maintenance_mode: z.boolean(),
  maintenance_message: z.string().trim().max(1000),
});

/** Public: the letterhead and maintenance state hold nothing secret. */
export async function GET() {
  try {
    return NextResponse.json(
      { success: true, data: await loadAppSettings() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("App settings load failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load settings." },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const session = readSession(req);
  if (!session) return unauthorized();
  const allowed =
    session.admin || (await getRolePermissions(session.role)).has("perm-admin-settings");
  if (!allowed) return forbidden();

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || "Invalid settings." },
      { status: 400 },
    );
  }
  try {
    await saveAppSettings(parsed.data, session.id);
    return NextResponse.json({ success: true, data: await loadAppSettings(true) });
  } catch (err) {
    console.error("App settings save failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to save settings." },
      { status: 500 },
    );
  }
}

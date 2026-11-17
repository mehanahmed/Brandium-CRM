import { NextResponse } from "next/server";
import { z } from "zod";
import { loadSmsSettings, saveSmsSettings, toPublicSettings } from "@/lib/sms-gateway-server";
import { forbidden, readSession, unauthorized } from "@/lib/session-server";

const updateSchema = z.object({
  api_url: z.string().trim().url().max(500),
  balance_url: z.string().trim().url().max(500),
  api_key: z.string().trim().max(255).optional(),
  sender_id: z.string().trim().min(1, "Sender ID is required").max(50),
  label: z.enum(["transactional", "promotional"]),
  is_enabled: z.boolean(),
  updated_by: z.string().max(36).nullable().optional(),
});

export async function GET(req: Request) {
  if (!readSession(req)) return unauthorized();
  try {
    return NextResponse.json({ success: true, data: toPublicSettings(await loadSmsSettings()) });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to load SMS gateway settings." },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const session = readSession(req);
  if (!session) return unauthorized();
  if (!session.admin) return forbidden();

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || "Invalid settings." },
      { status: 400 },
    );
  }
  try {
    const { updated_by: _ignored, ...input } = parsed.data;
    await saveSmsSettings(input, session.id);
    return NextResponse.json({ success: true, data: toPublicSettings(await loadSmsSettings()) });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to save SMS gateway settings." },
      { status: 500 },
    );
  }
}

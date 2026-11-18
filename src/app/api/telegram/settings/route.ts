import { NextResponse } from "next/server";
import { z } from "zod";
import { forbidden, readSession, unauthorized } from "@/lib/session-server";
import { canManageTelegram } from "@/lib/telegram-access";
import {
  loadTelegramSettings,
  parseChatIds,
  recentPaymentNotices,
  saveTelegramSettings,
  toPublicTelegramSettings,
} from "@/lib/telegram-server";

const updateSchema = z.object({
  // Telegram bot tokens look like 123456789:AA... ; blank keeps the saved token
  bot_token: z
    .string()
    .trim()
    .regex(/^(\d{5,15}:[A-Za-z0-9_-]{20,80})?$/, "That does not look like a bot token.")
    .optional(),
  chat_ids: z.string().max(2000),
  app_url: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v),
      "App URL must start with http(s)://",
    ),
  is_enabled: z.boolean(),
  notify_payment_add: z.boolean(),
  notify_payment_adjust: z.boolean(),
});

async function payload() {
  const [settings, notices] = await Promise.all([loadTelegramSettings(), recentPaymentNotices()]);
  return { success: true, data: toPublicTelegramSettings(settings), notices };
}

export async function GET(req: Request) {
  const session = readSession(req);
  if (!session) return unauthorized();
  if (!(await canManageTelegram(session))) return forbidden();
  try {
    return NextResponse.json(await payload());
  } catch (err) {
    console.error("Telegram settings load failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load Telegram settings." },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const session = readSession(req);
  if (!session) return unauthorized();
  if (!(await canManageTelegram(session))) return forbidden();

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || "Invalid settings." },
      { status: 400 },
    );
  }
  const chatIds = parseChatIds(parsed.data.chat_ids);
  if (parsed.data.chat_ids.trim() && chatIds.length === 0) {
    return NextResponse.json(
      { success: false, error: "No valid chat ID. Use numbers like -1001234567890 or @channel." },
      { status: 400 },
    );
  }
  try {
    await saveTelegramSettings(
      { ...parsed.data, bot_token: parsed.data.bot_token || undefined, chat_ids: chatIds },
      session.id,
    );
    return NextResponse.json(await payload());
  } catch (err) {
    console.error("Telegram settings save failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to save Telegram settings." },
      { status: 500 },
    );
  }
}

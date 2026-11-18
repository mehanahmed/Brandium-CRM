import { NextResponse } from "next/server";
import { forbidden, readSession, unauthorized } from "@/lib/session-server";
import { canManageTelegram } from "@/lib/telegram-access";
import { sendTelegramMessage } from "@/lib/telegram-server";

/** Sends a fixed test message to every saved chat. */
export async function POST(req: Request) {
  const session = readSession(req);
  if (!session) return unauthorized();
  if (!(await canManageTelegram(session))) return forbidden();
  try {
    const result = await sendTelegramMessage(
      "✅ <b>Brandium CRM</b>\nTelegram notifications are connected. Payment updates will arrive here.",
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("Telegram test failed:", err);
    return NextResponse.json({ success: false, response: "Could not send the test message." });
  }
}

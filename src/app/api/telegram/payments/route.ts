import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession, unauthorized } from "@/lib/session-server";
import { notifyOrderPayments } from "@/lib/telegram-server";

const bodySchema = z.object({
  orderId: z.string().trim().min(1).max(36),
  paymentIds: z.array(z.string().trim().min(1).max(64)).min(1).max(20),
});

/**
 * Called after an order save with the ids of payments that were just added. Any signed-in
 * user may call it: the message text comes from the saved order, and each payment is sent once.
 */
export async function POST(req: Request) {
  if (!readSession(req)) return unauthorized();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }
  try {
    await notifyOrderPayments(parsed.data.orderId, parsed.data.paymentIds);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Telegram payment notice failed:", err);
    return NextResponse.json({ success: false, error: "Notification failed." }, { status: 500 });
  }
}

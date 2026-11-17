import { NextResponse } from "next/server";
import { z } from "zod";
import { logSmsAttempts, normalizeBdPhone, sendViaGateway } from "@/lib/sms-gateway-server";
import { getRolePermissions } from "@/lib/data-scope-server";
import { readSession, unauthorized } from "@/lib/session-server";

const sendSchema = z.object({
  phones: z.array(z.string().trim().min(1)).min(1).max(500),
  message: z.string().trim().min(1, "Message is required").max(1600),
  recipient_name: z.string().trim().max(255).nullish(),
  prospect_id: z.string().max(36).nullish(),
  mode: z.enum(["Single", "Bulk"]).default("Single"),
  sent_by: z.string().max(36).nullish(),
});

export async function POST(req: Request) {
  const session = readSession(req);
  if (!session) return unauthorized();
  // Each message costs money: only roles with "Send SMS" may use the gateway
  if (!session.admin && !(await getRolePermissions(session.role)).has("perm-sms-send")) {
    return NextResponse.json(
      { success: false, response: "Your role is not allowed to send SMS." },
      { status: 403 },
    );
  }

  const parsed = sendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, response: parsed.error.issues[0]?.message || "Invalid request." },
      { status: 400 },
    );
  }

  const { message, ...meta } = parsed.data;
  const phones = parsed.data.phones.map(normalizeBdPhone);
  const invalidIndex = phones.findIndex((p) => p === null);
  if (invalidIndex !== -1) {
    return NextResponse.json(
      {
        success: false,
        response: `Invalid Bangladeshi mobile number: ${parsed.data.phones[invalidIndex]}`,
      },
      { status: 400 },
    );
  }

  const validPhones = phones as string[];
  const result = await sendViaGateway(validPhones, message);
  try {
    // The sender is whoever is signed in, not whatever the browser claims
    await logSmsAttempts(validPhones, message, result, { ...meta, sent_by: session.id });
  } catch (err) {
    console.warn("SMS log write failed:", err);
  }
  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}

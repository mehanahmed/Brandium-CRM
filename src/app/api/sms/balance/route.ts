import { NextResponse } from "next/server";
import { fetchGatewayBalance } from "@/lib/sms-gateway-server";
import { readSession, unauthorized } from "@/lib/session-server";

export async function GET(req: Request) {
  if (!readSession(req)) return unauthorized();
  const result = await fetchGatewayBalance();
  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}

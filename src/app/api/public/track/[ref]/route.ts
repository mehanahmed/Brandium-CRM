import { NextResponse } from "next/server";
import { getMySQLPool } from "@/lib/mysql-server";
import { ORDER_SELECT_SQL } from "@/lib/orders";

/** Columns the public invoice needs. Staff ids, production briefs and internal flags are never selected onward. */
const PUBLIC_COLUMNS = [
  "id",
  "order_number",
  "job_id",
  "company_name",
  "client_name",
  "phone",
  "address",
  "status",
  "items_json",
  "discount_amount",
  "shipping_charge",
  "total_amount",
  "paid_amount",
  "payments_json",
  "status_history",
  "notes",
  "terms",
  "order_date",
  "delivery_date",
  "created_at",
  "updated_at",
] as const;

function parseJsonArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

/**
 * Status notes stay on the public timeline, minus the staff member's name
 * (`Order moved to "X" and assigned to Name.`) and internal hold/cancel reasons (`Reason: ...`).
 */
function publicNote(value: unknown): string | null {
  if (!value) return null;
  const text = String(value)
    .replace(/\s*\band assigned to [^.\n]*\.?/i, ".")
    .replace(/^\s*assigned to [^.\n]*\.?/i, "")
    .replace(/\s*\bReason:[\s\S]*$/i, "")
    .replace(/\.\.+$/, ".")
    .trim();
  return text || null;
}

/** Staff names, internal reasons and payment notes never leave this route. */
function toPublicRow(row: Record<string, unknown>): Record<string, unknown> {
  const publicRow: Record<string, unknown> = {};
  for (const column of PUBLIC_COLUMNS) publicRow[column] = row[column] ?? null;
  publicRow["status_history"] = JSON.stringify(
    parseJsonArray(row["status_history"]).map((entry) => ({
      id: entry["id"],
      status: entry["status"],
      timestamp: entry["timestamp"],
      changedByUserName: "",
      notes: publicNote(entry["notes"]),
    })),
  );
  // Listed fields only: a payment's notes (transaction refs, staff remarks) are not public
  publicRow["payments_json"] = JSON.stringify(
    parseJsonArray(row["payments_json"]).map((payment) => ({
      id: payment["id"],
      amount: payment["amount"],
      date: payment["date"],
      createdAt: payment["createdAt"],
      paymentMethod: payment["paymentMethod"],
      status: payment["status"],
    })),
  );
  return publicRow;
}

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  if (!ref || ref.length > 64) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    const pool = await getMySQLPool();
    const [rows] = await pool.query(
      `${ORDER_SELECT_SQL} WHERE (o.order_number = ? OR o.id = ?) AND COALESCE(o.is_deleted, 0) = 0 LIMIT 1;`,
      [ref, ref],
    );
    const row = (rows as Record<string, unknown>[])[0];
    if (!row) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(toPublicRow(row), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Public track lookup failed:", err);
    return NextResponse.json({ error: "Could not load this order" }, { status: 500 });
  }
}

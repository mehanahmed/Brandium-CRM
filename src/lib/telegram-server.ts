// Server only: Telegram bot settings and payment notifications (Motion Box style).
import { getMySQLPool } from "@/lib/mysql-server";
import { ensureBootstrapped } from "@/lib/crm.functions";

export type TelegramSettings = {
  bot_token: string;
  chat_ids: string[];
  app_url: string;
  is_enabled: boolean;
  notify_payment_add: boolean;
  notify_payment_adjust: boolean;
  updated_at: string | null;
};

export type TelegramPublicSettings = Omit<TelegramSettings, "bot_token"> & {
  has_bot_token: boolean;
  bot_token_masked: string;
};

export type TelegramSettingsUpdate = Omit<TelegramSettings, "bot_token" | "updated_at"> & {
  bot_token?: string | undefined;
};

export type TelegramResult = { success: boolean; response: string };

export type PaymentNotice = {
  payment_id: string;
  order_id: string;
  order_number: string | null;
  kind: "add" | "adjust";
  amount: number;
  status: string;
  response: string | null;
  created_at: string;
};

type Row = Record<string, unknown>;

async function query(
  sql: string,
  params: unknown[] = [],
): Promise<Row[] & { affectedRows?: number }> {
  await ensureBootstrapped();
  const pool = await getMySQLPool();
  const [rows] = await pool.query(sql, params);
  return rows as Row[] & { affectedRows?: number };
}

/** One chat id per line or comma; Telegram ids are numbers (groups start with -100) or @channel. */
export function parseChatIds(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((id) => id.trim())
        .filter((id) => /^(-?\d{3,20}|@[A-Za-z0-9_]{5,32})$/.test(id)),
    ),
  ];
}

export async function loadTelegramSettings(): Promise<TelegramSettings> {
  const [r = {}] = await query("SELECT * FROM `telegram_settings` WHERE `id` = 'default' LIMIT 1");
  return {
    bot_token: String(r["bot_token"] || ""),
    chat_ids: parseChatIds(String(r["chat_ids"] || "")),
    app_url: String(r["app_url"] || ""),
    is_enabled: Number(r["is_enabled"] ?? 0) === 1,
    notify_payment_add: Number(r["notify_payment_add"] ?? 1) === 1,
    notify_payment_adjust: Number(r["notify_payment_adjust"] ?? 1) === 1,
    updated_at: r["updated_at"] ? String(r["updated_at"]) : null,
  };
}

export function toPublicTelegramSettings(s: TelegramSettings): TelegramPublicSettings {
  const { bot_token, ...rest } = s;
  return {
    ...rest,
    has_bot_token: Boolean(bot_token),
    bot_token_masked: bot_token ? `${"•".repeat(8)}${bot_token.slice(-4)}` : "",
  };
}

export async function saveTelegramSettings(input: TelegramSettingsUpdate, userId: string) {
  const sets = [
    "`chat_ids` = ?",
    "`app_url` = ?",
    "`is_enabled` = ?",
    "`notify_payment_add` = ?",
    "`notify_payment_adjust` = ?",
    "`updated_by` = ?",
  ];
  const params: unknown[] = [
    input.chat_ids.join("\n"),
    input.app_url.replace(/\/+$/, ""),
    input.is_enabled ? 1 : 0,
    input.notify_payment_add ? 1 : 0,
    input.notify_payment_adjust ? 1 : 0,
    userId,
  ];
  // Blank token keeps the saved one
  if (input.bot_token) {
    sets.push("`bot_token` = ?");
    params.push(input.bot_token);
  }
  await query(
    `UPDATE \`telegram_settings\` SET ${sets.join(", ")} WHERE \`id\` = 'default'`,
    params,
  );
}

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const money = (n: number) =>
  `BDT ${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Telegram refuses buttons that point to localhost or a non-https address. */
const isPublicUrl = (url: string) =>
  /^https:\/\//i.test(url) && !/^https:\/\/(localhost|127\.|\[::1\])/i.test(url);

type InlineButton = { text: string; url: string };

/** Sends to every saved chat id; success only when all of them accepted it. */
export async function sendTelegramMessage(
  text: string,
  buttons: InlineButton[] = [],
  settings?: TelegramSettings,
): Promise<TelegramResult> {
  const s = settings ?? (await loadTelegramSettings());
  if (!s.bot_token) return { success: false, response: "No bot token saved." };
  if (s.chat_ids.length === 0) return { success: false, response: "No chat ID saved." };

  // TELEGRAM_API_PROXY: optional base URL when api.telegram.org is blocked on the server's network
  const base = (process.env["TELEGRAM_API_PROXY"] || "https://api.telegram.org").replace(
    /\/+$/,
    "",
  );
  const links = buttons.filter((b) => isPublicUrl(b.url));
  const errors: string[] = [];

  for (const chatId of s.chat_ids) {
    try {
      const res = await fetch(`${base}/bot${s.bot_token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          ...(links.length ? { reply_markup: { inline_keyboard: [links] } } : {}),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
      if (!json.ok) errors.push(`${chatId}: ${json.description || `HTTP ${res.status}`}`);
    } catch (err) {
      // Never echo the request URL: it carries the bot token
      errors.push(`${chatId}: ${err instanceof Error ? err.name : "request failed"}`);
    }
  }

  return errors.length
    ? { success: false, response: errors.join("; ") }
    : { success: true, response: `Sent to ${s.chat_ids.length} chat(s).` };
}

function parsePayments(raw: unknown): Row[] {
  try {
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? (parsed as Row[]) : [];
  } catch {
    return [];
  }
}

/**
 * Sends one Telegram message per new payment of an order. The text is built here from the
 * saved order, so the browser only says which payment ids are new. A payment is an
 * adjustment when the order already had an earlier payment (same rule as Motion Box).
 */
export async function notifyOrderPayments(orderId: string, paymentIds: string[]) {
  const s = await loadTelegramSettings();
  if (!s.is_enabled || !s.bot_token || s.chat_ids.length === 0) return;

  const [order] = await query(
    `SELECT id, order_number, company_name, client_name, total_amount, shipping_charge, payments_json
     FROM orders WHERE id = ? LIMIT 1`,
    [orderId],
  );
  if (!order) return;

  const payments = parsePayments(order["payments_json"]);
  const total = Number(order["total_amount"] || 0) + Number(order["shipping_charge"] || 0);
  const paid = payments.reduce((sum, p) => sum + (Number(p["amount"]) || 0), 0);
  const orderNumber = String(order["order_number"] || order["id"]);
  const company = order["company_name"] || order["client_name"] || "—";

  for (const id of new Set(paymentIds)) {
    const index = payments.findIndex((p) => String(p["id"]) === id);
    const payment = payments[index];
    if (!payment) continue;
    const kind = index > 0 ? "adjust" : "add";
    if (kind === "add" ? !s.notify_payment_add : !s.notify_payment_adjust) continue;
    const amount = Number(payment["amount"]) || 0;

    // Claim the payment first: the primary key makes a second call for the same payment a no-op
    const claim = await query(
      "INSERT IGNORE INTO `telegram_payment_notices` (`payment_id`, `order_id`, `order_number`, `kind`, `amount`, `status`) VALUES (?, ?, ?, ?, ?, 'sending')",
      [id, orderId, orderNumber, kind, amount],
    );
    if (!claim.affectedRows) continue;

    const text = [
      kind === "add"
        ? "💰 <b>New Advance Payment Received!</b>"
        : "🔁 <b>Adjustment Payment Received!</b>",
      "",
      `<b>Order:</b> <code>${escapeHtml(orderNumber)}</code>`,
      `<b>Company:</b> ${escapeHtml(company)}`,
      `<b>Amount:</b> ${money(amount)}`,
      `<b>Method:</b> ${escapeHtml(payment["paymentMethod"] || "Unknown")}`,
      `<b>Reference:</b> ${escapeHtml(payment["notes"] || "N/A")}`,
      `<b>Recorded By:</b> ${escapeHtml(payment["recordedByUserName"] || "Unknown")}`,
      "",
      `<b>Total Paid:</b> ${money(paid)} of ${money(total)}`,
      `<b>Amount Due:</b> ${money(Math.max(0, total - paid))}`,
    ].join("\n");

    const result = await sendTelegramMessage(
      text,
      s.app_url
        ? [
            { text: "📄 View Order", url: `${s.app_url}/track/${encodeURIComponent(orderNumber)}` },
            { text: "📋 All Orders", url: `${s.app_url}/orders` },
          ]
        : [],
      s,
    );
    await query(
      "UPDATE `telegram_payment_notices` SET `status` = ?, `response` = ? WHERE `payment_id` = ?",
      [result.success ? "sent" : "failed", result.response.slice(0, 2000), id],
    );
  }
}

export async function recentPaymentNotices(limit = 20): Promise<PaymentNotice[]> {
  const rows = await query(
    "SELECT * FROM `telegram_payment_notices` ORDER BY `created_at` DESC LIMIT ?",
    [limit],
  );
  return rows.map((r) => ({
    payment_id: String(r["payment_id"]),
    order_id: String(r["order_id"]),
    order_number: r["order_number"] ? String(r["order_number"]) : null,
    kind: r["kind"] === "adjust" ? "adjust" : "add",
    amount: Number(r["amount"] || 0),
    status: String(r["status"]),
    response: r["response"] ? String(r["response"]) : null,
    created_at: String(r["created_at"]),
  }));
}

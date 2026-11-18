import { queryOptions } from "@tanstack/react-query";
import { runMySQLQuery } from "@/lib/mysql-api";
import { generateUUID, getMySQLTimestamp } from "@/lib/mysql-client";
import { resolveOrderStatus } from "@/lib/orders";
import { parseNotesToItems } from "@/lib/stages";

export type EntityType =
  | "prospect"
  | "opportunity"
  | "followup"
  | "meeting"
  | "sms"
  | "invoice"
  | "payment"
  | "user"
  | "stage"
  | "order"
  | "quotation"
  | "expense";

export type ActivityLog = {
  id: string;
  user_id: string | null;
  user_name: string;
  action: string;
  entity_type: EntityType | string;
  entity_id: string | null;
  metadata_json: Record<string, unknown>;
  /** Actor photo (`profiles.avatar_url`, else `users.avatar_url`), looked up by `user_id`. */
  user_avatar?: string | null | undefined;
  created_at: string;
};

export type LogActivityInput = {
  action: string;
  entity_type: EntityType | string;
  entity_id?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export async function logActivity(
  input: LogActivityInput,
  user?: { id?: string; email?: string } | null,
): Promise<ActivityLog> {
  const logId = generateUUID();
  const now = getMySQLTimestamp();

  const newLog: ActivityLog = {
    id: logId,
    user_id: user?.id || null,
    user_name: user?.email || "Agent",
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id || null,
    metadata_json: input.metadata || {},
    created_at: now,
  };

  try {
    await runMySQLQuery(
      `INSERT INTO \`activities\` (\`id\`, \`actor_id\`, \`prospect_id\`, \`activity_type\`, \`message\`, \`created_at\`)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [
        logId,
        user?.id || null,
        input.entity_type === "prospect" ? input.entity_id : null,
        input.entity_type,
        input.action,
        now,
      ],
    );
  } catch (err) {
    console.warn("logActivity MySQL error:", err);
  }

  return newLog;
}

export type ActivityLogFilters = {
  search?: string | undefined;
  entity_type?: string | "all" | undefined;
  user_id?: string | "all" | undefined;
  /** `yyyy-MM-dd`, inclusive; compared with each event's own date. */
  from?: string | undefined;
  to?: string | undefined;
  /** Throw when any source query fails, instead of returning the rows that did load. */
  strict?: boolean | undefined;
};

// shortcut: each source reads at most this many rows in the range; add paging if a range ever exceeds it
const SOURCE_LIMIT = 500;

const actorName = (alias: string) =>
  `COALESCE(${alias}_prof.full_name, ${alias}_u.name, ${alias}_u.email, 'System')`;
const actorJoin = (alias: string, column: string) =>
  `LEFT JOIN \`users\` ${alias}_u ON ${alias}_u.id = ${column}
   LEFT JOIN \`profiles\` ${alias}_prof ON ${alias}_prof.id = ${column}`;

/** `AND DATE(column) BETWEEN ? AND ?` plus its params, or nothing when no range is set. */
const rangeSql = (column: string, filters: ActivityLogFilters) => {
  const parts: string[] = [];
  const params: string[] = [];
  if (filters.from) {
    parts.push(`DATE(${column}) >= ?`);
    params.push(filters.from);
  }
  if (filters.to) {
    parts.push(`DATE(${column}) <= ?`);
    params.push(filters.to);
  }
  return { sql: parts.length ? ` AND ${parts.join(" AND ")}` : "", params };
};

/** JSON timestamps (ISO, UTC) → local `yyyy-MM-dd HH:mm:ss`, same form as MySQL DATETIME columns. */
const toLocalTimestamp = (value: unknown) => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "" : getMySQLTimestamp(date);
};

const inRange = (timestamp: string, filters: ActivityLogFilters) => {
  const day = timestamp.slice(0, 10);
  return (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to);
};

const parseJsonArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** `follow_up_created`, `follow_up_updated`, `follow-up` … all count as the Follow-up category. */
const normalizeEntityType = (value: string) =>
  /^follow[-_\s]?ups?(_|$)/i.test(value) ? "followup" : value || "general";

const query = async (failures: string[], label: string, sql: string, params: unknown[]) => {
  const res = await runMySQLQuery<Record<string, unknown>[]>(sql, params);
  if (!res.success) {
    console.warn(`fetchActivityLogs ${label} query error:`, res.error);
    failures.push(label);
    return [];
  }
  return Array.isArray(res.data) ? res.data : [];
};

const prospectMeta = (r: Record<string, unknown>) => ({
  prospect_name: r["prospect_name"] || undefined,
  business_name: r["business_name"] || undefined,
  phone: r["phone"] || undefined,
});

export async function fetchActivityLogs(filters: ActivityLogFilters = {}): Promise<ActivityLog[]> {
  const allLogs: ActivityLog[] = [];
  const failures: string[] = [];
  const add = (log: ActivityLog) => {
    if (log.created_at && inRange(log.created_at, filters)) allLogs.push(log);
  };

  // 1. General events (`activities`)
  {
    const range = rangeSql("a.created_at", filters);
    const rows = await query(
      failures,
      "activities",
      `SELECT a.id, a.actor_id AS user_id, ${actorName("act")} AS user_name,
              COALESCE(a.message, a.activity_type) AS action, a.activity_type,
              a.prospect_id AS entity_id, p.contact_name AS prospect_name, p.business_name, p.phone,
              a.created_at
       FROM \`activities\` a
       ${actorJoin("act", "a.actor_id")}
       LEFT JOIN \`prospects\` p ON a.prospect_id = p.id
       WHERE 1 = 1${range.sql}
       ORDER BY a.created_at DESC LIMIT ${SOURCE_LIMIT};`,
      range.params,
    );
    for (const r of rows) {
      add({
        id: String(r["id"]),
        user_id: (r["user_id"] as string) || null,
        user_name: String(r["user_name"]),
        action: String(r["action"] || "Activity Logged"),
        entity_type: normalizeEntityType(String(r["activity_type"] || "")),
        entity_id: (r["entity_id"] as string) || null,
        metadata_json: {
          ...prospectMeta(r),
          activity_type: r["activity_type"] || undefined,
          source_table: "activities",
        },
        created_at: String(r["created_at"] || ""),
      });
    }
  }

  // 2. Prospect stage changes (`prospect_stage_history.note` holds a JSON note array)
  {
    const range = rangeSql("sh.changed_at", filters);
    const rows = await query(
      failures,
      "stage history",
      `SELECT sh.id, sh.changed_by AS user_id, ${actorName("sh")} AS user_name,
              COALESCE(s_to.name, sh.to_stage_id) AS to_stage_name,
              COALESCE(s_from.name, sh.from_stage_id) AS from_stage_name,
              sh.note, sh.prospect_id AS entity_id,
              p.contact_name AS prospect_name, p.business_name, p.phone, sh.changed_at
       FROM \`prospect_stage_history\` sh
       ${actorJoin("sh", "sh.changed_by")}
       LEFT JOIN \`stages\` s_from ON (sh.from_stage_id = s_from.id OR sh.from_stage_id = REPLACE(s_from.id, '-', '_') OR sh.from_stage_id = s_from.name)
       LEFT JOIN \`stages\` s_to ON (sh.to_stage_id = s_to.id OR sh.to_stage_id = REPLACE(s_to.id, '-', '_') OR sh.to_stage_id = s_to.name)
       LEFT JOIN \`prospects\` p ON sh.prospect_id = p.id
       WHERE 1 = 1${range.sql}
       ORDER BY sh.changed_at DESC LIMIT ${SOURCE_LIMIT};`,
      range.params,
    );
    for (const r of rows) {
      const toStage = String(r["to_stage_name"] || "Stage");
      const fromStage = r["from_stage_name"] ? String(r["from_stage_name"]) : null;
      const notes = parseNotesToItems((r["note"] as string) || null).map((n) => n.text);
      const latestNote = notes.at(-1);
      add({
        id: `sh_${r["id"]}`,
        user_id: (r["user_id"] as string) || null,
        user_name: String(r["user_name"]),
        action:
          (fromStage && fromStage !== toStage
            ? `Stage changed: ${fromStage} → ${toStage}`
            : `Stage: ${toStage}`) + (latestNote ? ` — ${latestNote}` : ""),
        entity_type: "stage",
        entity_id: (r["entity_id"] as string) || null,
        metadata_json: {
          ...prospectMeta(r),
          from_stage: fromStage || undefined,
          to_stage: toStage,
          notes: notes.length ? notes : undefined,
          source_table: "prospect_stage_history",
        },
        created_at: String(r["changed_at"] || ""),
      });
    }
  }

  // 3. Meetings
  {
    const range = rangeSql("m.created_at", filters);
    const rows = await query(
      failures,
      "meetings",
      `SELECT m.id, COALESCE(m.created_by, m.assigned_user_id) AS user_id, ${actorName("mt")} AS user_name,
              m.title, m.status AS meeting_status, m.meeting_type, m.meeting_date, m.meeting_time,
              m.location, m.notes, m.prospect_id AS entity_id,
              p.contact_name AS prospect_name, p.business_name, p.phone, m.created_at
       FROM \`meetings\` m
       ${actorJoin("mt", "COALESCE(m.created_by, m.assigned_user_id)")}
       LEFT JOIN \`prospects\` p ON m.prospect_id = p.id
       WHERE 1 = 1${range.sql}
       ORDER BY m.created_at DESC LIMIT ${SOURCE_LIMIT};`,
      range.params,
    );
    for (const r of rows) {
      add({
        id: `mt_${r["id"]}`,
        user_id: (r["user_id"] as string) || null,
        user_name: String(r["user_name"]),
        action: `Meeting ${r["meeting_status"] || "scheduled"}: ${r["title"] || "Client Meeting"} on ${r["meeting_date"] || "TBD"}`,
        entity_type: "meeting",
        entity_id: (r["entity_id"] as string) || null,
        metadata_json: {
          ...prospectMeta(r),
          meeting_type: r["meeting_type"] || undefined,
          meeting_date: r["meeting_date"] || undefined,
          meeting_time: r["meeting_time"] || undefined,
          location: r["location"] || undefined,
          notes: r["notes"] || undefined,
          source_table: "meetings",
        },
        created_at: String(r["created_at"] || ""),
      });
    }
  }

  // 4. Orders: every status change and every payment, from the order's own JSON columns.
  // No date filter in SQL: an old order can get a new payment or status today.
  {
    const rows = await query(
      failures,
      "orders",
      `SELECT o.id, o.order_number, o.job_id, o.company_name, o.client_name, o.phone,
              o.prospect_id, o.crm_user_id, ${actorName("ord")} AS crm_user_name,
              o.status_history, o.payments_json, o.created_at
       FROM \`orders\` o
       ${actorJoin("ord", "o.crm_user_id")}
       WHERE (o.is_deleted = 0 OR o.is_deleted IS NULL)
       ORDER BY o.updated_at DESC LIMIT ${SOURCE_LIMIT};`,
      [],
    );
    for (const r of rows) {
      const code = String(r["order_number"] || r["job_id"] || r["id"]);
      const company = String(r["company_name"] || r["client_name"] || "client");
      const meta = {
        prospect_name: r["client_name"] || undefined,
        business_name: r["company_name"] || undefined,
        phone: r["phone"] || undefined,
        order: code,
      };
      const history = parseJsonArray(r["status_history"]);
      if (history.length === 0) {
        add({
          id: `ord_${r["id"]}`,
          user_id: (r["crm_user_id"] as string) || null,
          user_name: String(r["crm_user_name"]),
          action: `Order ${code} created for ${company}`,
          entity_type: "order",
          entity_id: (r["prospect_id"] as string) || null,
          metadata_json: { ...meta, source_table: "orders" },
          created_at: String(r["created_at"] || ""),
        });
      }
      history.forEach((h, index) => {
        const status = resolveOrderStatus(String(h["status"] || "")).name;
        const note = h["notes"] ? String(h["notes"]) : "";
        add({
          id: `ordst_${r["id"]}_${String(h["id"] || index)}`,
          user_id:
            (h["changedByUserId"] as string) ||
            (index === 0 ? (r["crm_user_id"] as string) : null) ||
            null,
          user_name: String(
            h["changedByUserName"] || (index === 0 ? r["crm_user_name"] : "") || "System",
          ),
          action:
            (index === 0
              ? `Order ${code} created for ${company}`
              : `Order ${code} moved to ${status}`) +
            (note && note !== "Order created." ? ` — ${note}` : ""),
          entity_type: "order",
          entity_id: (r["prospect_id"] as string) || null,
          metadata_json: {
            ...meta,
            status,
            notes: note || undefined,
            source_table: "orders.status_history",
          },
          created_at: toLocalTimestamp(h["timestamp"]) || String(r["created_at"] || ""),
        });
      });
      parseJsonArray(r["payments_json"]).forEach((pay, index) => {
        add({
          id: `ordpay_${r["id"]}_${String(pay["id"] || index)}`,
          user_id: (pay["recordedByUserId"] as string) || null,
          user_name: String(pay["recordedByUserName"] || "System"),
          action: `Payment of ৳${Number(pay["amount"] || 0).toLocaleString("en-US")} via ${pay["paymentMethod"] || "unknown method"} on order ${code}`,
          entity_type: "payment",
          entity_id: (r["prospect_id"] as string) || null,
          metadata_json: {
            ...meta,
            amount: pay["amount"] ?? 0,
            payment_method: pay["paymentMethod"] || undefined,
            notes: pay["notes"] || undefined,
            status: pay["status"] || undefined,
            source_table: "orders.payments_json",
          },
          created_at: toLocalTimestamp(pay["date"] || pay["createdAt"]),
        });
      });
    }
  }

  // 5. Quotations
  {
    const range = rangeSql("q.created_at", filters);
    const rows = await query(
      failures,
      "quotations",
      `SELECT q.id, q.quotation_code, q.title, q.client_name, q.client_phone, q.status, q.budget,
              q.prospect_id, q.created_by AS user_id, ${actorName("qt")} AS user_name, q.created_at
       FROM \`quotations\` q
       ${actorJoin("qt", "q.created_by")}
       WHERE (q.is_active = 1 OR q.is_active IS NULL)${range.sql}
       ORDER BY q.created_at DESC LIMIT ${SOURCE_LIMIT};`,
      range.params,
    );
    for (const r of rows) {
      add({
        id: `qt_${r["id"]}`,
        user_id: (r["user_id"] as string) || null,
        user_name: String(r["user_name"]),
        action: `Quotation ${r["quotation_code"] || ""} created for ${r["title"] || r["client_name"] || "client"} (৳${Number(r["budget"] || 0).toLocaleString("en-US")})`,
        entity_type: "quotation",
        entity_id: (r["prospect_id"] as string) || null,
        metadata_json: {
          prospect_name: r["client_name"] || undefined,
          business_name: r["title"] || undefined,
          phone: r["client_phone"] || undefined,
          status: r["status"] || undefined,
          source_table: "quotations",
        },
        created_at: String(r["created_at"] || ""),
      });
    }
  }

  // 6. SMS (`sms_logs`, written by /api/sms/send)
  {
    const range = rangeSql("s.created_at", filters);
    const rows = await query(
      failures,
      "sms",
      `SELECT s.id, s.recipient_phone, s.recipient_name, s.prospect_id, s.message, s.status, s.mode,
              s.sent_by AS user_id, ${actorName("sms")} AS user_name, s.created_at
       FROM \`sms_logs\` s
       ${actorJoin("sms", "s.sent_by")}
       WHERE 1 = 1${range.sql}
       ORDER BY s.created_at DESC LIMIT ${SOURCE_LIMIT};`,
      range.params,
    );
    for (const r of rows) {
      add({
        id: `sms_${r["id"]}`,
        user_id: (r["user_id"] as string) || null,
        user_name: String(r["user_name"]),
        action: `SMS ${String(r["status"] || "sent").toLowerCase()} to ${r["recipient_name"] || r["recipient_phone"]}`,
        entity_type: "sms",
        entity_id: (r["prospect_id"] as string) || null,
        metadata_json: {
          prospect_name: r["recipient_name"] || undefined,
          phone: r["recipient_phone"] || undefined,
          message: r["message"] || undefined,
          mode: r["mode"] || undefined,
          source_table: "sms_logs",
        },
        created_at: String(r["created_at"] || ""),
      });
    }
  }

  // 7. Expenses
  {
    const range = rangeSql("e.created_at", filters);
    const rows = await query(
      failures,
      "expenses",
      `SELECT e.id, e.title, e.category, e.amount, e.payment_method, e.expense_date, e.vendor,
              e.recorded_by AS user_id, ${actorName("exp")} AS user_name, e.created_at
       FROM \`expenses\` e
       ${actorJoin("exp", "e.recorded_by")}
       WHERE 1 = 1${range.sql}
       ORDER BY e.created_at DESC LIMIT ${SOURCE_LIMIT};`,
      range.params,
    );
    for (const r of rows) {
      add({
        id: `exp_${r["id"]}`,
        user_id: (r["user_id"] as string) || null,
        user_name: String(r["user_name"]),
        action: `Expense recorded: ${r["title"] || r["category"] || "Expense"} ৳${Number(r["amount"] || 0).toLocaleString("en-US")}`,
        entity_type: "expense",
        entity_id: null,
        metadata_json: {
          category: r["category"] || undefined,
          amount: r["amount"] ?? 0,
          payment_method: r["payment_method"] || undefined,
          expense_date: r["expense_date"] || undefined,
          vendor: r["vendor"] || undefined,
          source_table: "expenses",
        },
        created_at: String(r["created_at"] || ""),
      });
    }
  }

  // 8. Legacy invoices and payments tables (pre-orders data)
  {
    const range = rangeSql("i.created_at", filters);
    const rows = await query(
      failures,
      "invoices",
      `SELECT i.id, i.created_by AS user_id, ${actorName("inv")} AS user_name, i.invoice_number,
              i.total_amount, i.status AS invoice_status, i.prospect_id AS entity_id,
              p.contact_name AS prospect_name, p.business_name, p.phone, i.created_at
       FROM \`invoices\` i
       ${actorJoin("inv", "i.created_by")}
       LEFT JOIN \`prospects\` p ON i.prospect_id = p.id
       WHERE 1 = 1${range.sql}
       ORDER BY i.created_at DESC LIMIT ${SOURCE_LIMIT};`,
      range.params,
    );
    for (const r of rows) {
      add({
        id: `inv_${r["id"]}`,
        user_id: (r["user_id"] as string) || null,
        user_name: String(r["user_name"]),
        action: `Invoice ${r["invoice_number"] || ""} (${r["invoice_status"] || "issued"}) for ৳${Number(r["total_amount"] || 0).toLocaleString("en-US")}`,
        entity_type: "invoice",
        entity_id: (r["entity_id"] as string) || null,
        metadata_json: { ...prospectMeta(r), source_table: "invoices" },
        created_at: String(r["created_at"] || ""),
      });
    }
  }
  {
    const range = rangeSql("py.created_at", filters);
    const rows = await query(
      failures,
      "payments",
      `SELECT py.id, py.recorded_by AS user_id, ${actorName("pay")} AS user_name, py.amount,
              py.payment_method, py.transaction_reference, py.notes,
              COALESCE(py.prospect_id, inv.prospect_id) AS entity_id,
              p.contact_name AS prospect_name, p.business_name, p.phone, py.created_at
       FROM \`payments\` py
       ${actorJoin("pay", "py.recorded_by")}
       LEFT JOIN \`invoices\` inv ON py.invoice_id = inv.id
       LEFT JOIN \`prospects\` p ON p.id = COALESCE(py.prospect_id, inv.prospect_id)
       WHERE 1 = 1${range.sql}
       ORDER BY py.created_at DESC LIMIT ${SOURCE_LIMIT};`,
      range.params,
    );
    for (const r of rows) {
      add({
        id: `pay_${r["id"]}`,
        user_id: (r["user_id"] as string) || null,
        user_name: String(r["user_name"]),
        action: `Payment of ৳${Number(r["amount"] || 0).toLocaleString("en-US")} via ${r["payment_method"] || "unknown method"}`,
        entity_type: "payment",
        entity_id: (r["entity_id"] as string) || null,
        metadata_json: {
          ...prospectMeta(r),
          amount: r["amount"] ?? 0,
          payment_method: r["payment_method"] || undefined,
          transaction_reference: r["transaction_reference"] || undefined,
          notes: r["notes"] || undefined,
          source_table: "payments",
        },
        created_at: String(r["created_at"] || ""),
      });
    }
  }

  if (filters.strict && failures.length > 0) {
    throw new Error(`Activity sources failed to load: ${failures.join(", ")}`);
  }

  await attachActorAvatars(allLogs);
  allLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return applyActivityFilters(allLogs, filters);
}

/**
 * Sets `user_avatar` on every log from its `user_id`. Order history and payment JSON may only
 * hold a name, so those are matched by name and also get the user id (for the agent filter).
 */
async function attachActorAvatars(logs: ActivityLog[]) {
  const rows = await query(
    [],
    "actor avatars",
    `SELECT u.id, u.name, prof.full_name, COALESCE(prof.avatar_url, u.avatar_url) AS avatar_url
     FROM \`users\` u
     LEFT JOIN \`profiles\` prof ON prof.id = u.id;`,
    [],
  );
  const byId = new Map<string, string | null>();
  const idByName = new Map<string, string>();
  for (const r of rows) {
    const id = String(r["id"]);
    byId.set(id, r["avatar_url"] ? String(r["avatar_url"]) : null);
    for (const name of [r["name"], r["full_name"]]) {
      if (name) idByName.set(String(name).trim().toLowerCase(), id);
    }
  }
  for (const log of logs) {
    const userId = log.user_id || idByName.get(log.user_name.trim().toLowerCase()) || null;
    log.user_id = userId;
    log.user_avatar = userId ? byId.get(userId) || null : null;
  }
}

function applyActivityFilters(list: ActivityLog[], filters: ActivityLogFilters): ActivityLog[] {
  let result = list;

  if (filters.entity_type && filters.entity_type !== "all") {
    const et = filters.entity_type.toLowerCase();
    result = result.filter((log) => {
      const currentEt = log.entity_type.toLowerCase();
      if (et === "invoice" && (currentEt === "invoice" || currentEt === "billing")) return true;
      return currentEt === et;
    });
  }

  if (filters.user_id && filters.user_id !== "all") {
    result = result.filter((log) => log.user_id === filters.user_id);
  }

  if (filters.search && filters.search.trim() !== "") {
    const q = filters.search.toLowerCase().trim();
    result = result.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.user_name.toLowerCase().includes(q) ||
        log.entity_type.toLowerCase().includes(q) ||
        JSON.stringify(log.metadata_json).toLowerCase().includes(q),
    );
  }

  return result;
}

export const activityLogsQueryOptions = (filters: ActivityLogFilters = {}) =>
  queryOptions({
    queryKey: ["activity-logs", filters],
    queryFn: () => fetchActivityLogs(filters),
  });

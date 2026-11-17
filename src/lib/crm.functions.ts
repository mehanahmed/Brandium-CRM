import { createServerFn } from "./server-fn";
import { getMySQLConfig } from "./mysql-client";
import { getMySQLPool } from "./mysql-server";
import { ensureMySQLTablesExist } from "./auth.functions";

async function ensureBootstrapped() {
  const pool = await getMySQLPool();
  const config = getMySQLConfig();
  const conn = await pool.getConnection();
  try {
    await ensureMySQLTablesExist(
      conn as unknown as import("mysql2/promise").Connection,
      config.database,
    );
  } finally {
    conn.release();
  }
}

// -----------------------------------------------------------------------------
// 1. OPPORTUNITIES
// -----------------------------------------------------------------------------

export type UniversalQueryResultRow = Record<string, string | number | boolean | null>;

export type UniversalQueryResponse = {
  success: boolean;
  data?: UniversalQueryResultRow[] | undefined;
  error?: string | undefined;
};

function inferColumnType(columnName: string): string {
  const col = columnName.toLowerCase();
  if (
    col.startsWith("is_") ||
    col.endsWith("_sent") ||
    col === "sms_sent" ||
    col === "is_deleted" ||
    col === "is_valid" ||
    col === "is_active"
  ) {
    return "TINYINT(1) NOT NULL DEFAULT 0";
  }
  if (
    col.endsWith("_id") ||
    col.endsWith("_to") ||
    col.endsWith("_by") ||
    col === "id" ||
    col === "prospect_id" ||
    col === "assigned_artist_id" ||
    col === "assigned_user_id" ||
    col === "assigned_agent_id"
  ) {
    return "VARCHAR(36) NULL";
  }
  if (
    col.endsWith("_at") ||
    col.endsWith("_date_time") ||
    col === "last_activity" ||
    col === "scheduled_at" ||
    col === "deleted_at" ||
    col === "payment_date"
  ) {
    return "DATETIME NULL";
  }
  if (
    col.endsWith("_date") ||
    col === "bill_date" ||
    col === "due_date" ||
    col === "deadline" ||
    col === "expected_close_date"
  ) {
    return "VARCHAR(20) NULL";
  }
  if (
    col.endsWith("_amount") ||
    col.endsWith("_value") ||
    col === "amount" ||
    col === "value" ||
    col === "budget" ||
    col === "total_amount" ||
    col === "paid_amount" ||
    col === "due_amount" ||
    col === "estimated_value"
  ) {
    return "DECIMAL(12, 2) NOT NULL DEFAULT 0.00";
  }
  if (
    col.endsWith("_score") ||
    col.endsWith("_count") ||
    col === "lead_score" ||
    col === "progress" ||
    col === "attempts"
  ) {
    return "INT NOT NULL DEFAULT 0";
  }
  if (
    col === "notes" ||
    col === "address" ||
    col === "tags" ||
    col === "description" ||
    col === "logo_url" ||
    col === "avatar_url" ||
    col.endsWith("_url")
  ) {
    return "TEXT NULL";
  }
  return "VARCHAR(255) NULL";
}

function extractTableNameFromSql(sql: string): string | null {
  const insertMatch = sql.match(/INSERT\s+INTO\s+[`'"]?([a-zA-Z0-9_]+)[`'"]?/i);
  if (insertMatch && insertMatch[1]) return insertMatch[1];

  const updateMatch = sql.match(/UPDATE\s+[`'"]?([a-zA-Z0-9_]+)[`'"]?/i);
  if (updateMatch && updateMatch[1]) return updateMatch[1];

  const fromMatch = sql.match(/FROM\s+[`'"]?([a-zA-Z0-9_]+)[`'"]?/i);
  if (fromMatch && fromMatch[1]) return fromMatch[1];

  return null;
}

/**
 * Resolves the real table/column for an "Unknown column" error. MySQL reports
 * alias-qualified names (e.g. `prj.assigned_artist_id`), so the alias is mapped
 * back to its table instead of creating a column literally named "prj.x".
 */
function resolveMissingColumnTarget(
  sql: string,
  reportedColumn: string,
): { table: string | null; column: string | null } {
  if (!reportedColumn) return { table: null, column: null };
  if (!reportedColumn.includes(".")) {
    return { table: extractTableNameFromSql(sql), column: reportedColumn };
  }

  const [alias, column] = reportedColumn.split(".", 2);
  if (!alias || !column || !/^[a-zA-Z0-9_]+$/.test(alias)) {
    return { table: null, column: null };
  }
  const aliasRe = new RegExp(
    `(?:FROM|JOIN)\\s+[\`'"]?([a-zA-Z0-9_]+)[\`'"]?\\s+(?:AS\\s+)?${alias}\\b`,
    "i",
  );
  const aliasMatch = sql.match(aliasRe);
  const table = aliasMatch?.[1] || extractTableNameFromSql(sql);
  return { table: table === alias || aliasMatch ? table : null, column };
}

export const executeMySQLQueryFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      sql: string;
      params?: (string | number | boolean | null)[];
      /** false = never ALTER TABLE on "Unknown column" (non-admin callers) */
      selfHeal?: boolean;
    }) => input,
  )
  .handler(async ({ data }): Promise<UniversalQueryResponse> => {
    try {
      await ensureBootstrapped();
      const pool = await getMySQLPool();
      let rows: unknown;

      try {
        const [result] = await pool.query(data.sql, data.params || []);
        rows = result;
      } catch (queryErr: unknown) {
        const errMsg = String((queryErr as { message?: string })?.message || queryErr);
        const colMatch = errMsg.match(/Unknown column '([^']+)'/i);
        const { table: targetTable, column: missingCol } = resolveMissingColumnTarget(
          data.sql,
          colMatch?.[1] || "",
        );

        if (data.selfHeal !== false && colMatch && missingCol && targetTable) {
          const colType = inferColumnType(missingCol);
          console.warn(
            `[Self-Healing Schema] Auto-migrating missing column ${targetTable}.${missingCol} as ${colType}`,
          );

          try {
            await pool.query(
              `ALTER TABLE \`${targetTable}\` ADD COLUMN \`${missingCol}\` ${colType}`,
            );
            const [retryResult] = await pool.query(data.sql, data.params || []);
            rows = retryResult;
          } catch (alterErr) {
            console.error(
              `[Self-Healing Schema] Auto-migration failed for ${targetTable}.${missingCol}:`,
              alterErr,
            );
            throw queryErr;
          }
        } else {
          throw queryErr;
        }
      }

      if (Array.isArray(rows)) {
        const plainRows: UniversalQueryResultRow[] = rows.map((r) => {
          const plain: UniversalQueryResultRow = {};
          if (r && typeof r === "object") {
            for (const key of Object.keys(r)) {
              const val = (r as Record<string, unknown>)[key];
              if (val === null || val === undefined) {
                plain[key] = null;
              } else if (val instanceof Date) {
                plain[key] = val.toISOString().slice(0, 19).replace("T", " ");
              } else if (
                typeof val === "number" ||
                typeof val === "boolean" ||
                typeof val === "string"
              ) {
                plain[key] = val;
              } else {
                plain[key] = String(val);
              }
            }
          }
          return plain;
        });
        return { success: true, data: plainRows };
      }

      const ok = (rows ?? {}) as { affectedRows?: number; insertId?: number };
      return {
        success: true,
        data: [
          {
            affectedRows: typeof ok.affectedRows === "number" ? ok.affectedRows : 0,
            insertId: typeof ok.insertId === "number" ? ok.insertId : 0,
          },
        ],
      };
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      console.error("executeMySQLQueryFn error:", errObj?.message);
      return { success: false, error: errObj?.message || "Database query failed" };
    }
  });

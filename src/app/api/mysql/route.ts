import { NextResponse } from "next/server";
import { executeMySQLQueryFn } from "@/lib/crm.functions";
import { forbidden, readSession, unauthorized } from "@/lib/session-server";
import { getUnscopedTables } from "@/lib/data-scope-server";
import { isAdminOnlySql, scopeSqlForUser, SqlScopeError } from "@/lib/sql-scope";
import { TRUSTED_SQL } from "@/lib/trusted-sql";

export async function POST(req: Request) {
  const session = readSession(req);
  if (!session) return unauthorized();

  try {
    const body = await req.json();
    const { sql } = body;
    const params = Array.isArray(body.params) ? body.params : [];

    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ success: false, error: "SQL string required" }, { status: 400 });
    }

    if (!session.admin && isAdminOnlySql(sql)) return forbidden();

    // Non-admins read their own rows, except in data areas their role sets to "All users' data"
    let runSql = sql;
    if (!session.admin && !TRUSTED_SQL.get(sql)?.(params)) {
      try {
        runSql = scopeSqlForUser(sql, session.id, await getUnscopedTables(session.role));
      } catch (err) {
        if (!(err instanceof SqlScopeError)) throw err;
        return NextResponse.json({ success: false, error: err.message }, { status: 403 });
      }
    }

    const result = (await executeMySQLQueryFn({
      data: { sql: runSql, params, selfHeal: session.admin },
    })) as { success?: boolean; data?: unknown; error?: string };

    // Password hashes never leave the server for non-admins (e.g. `SELECT * FROM users`).
    if (!session.admin && Array.isArray(result.data)) {
      for (const row of result.data as Record<string, unknown>[]) delete row["password_hash"];
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Internal database error" },
      { status: 500 },
    );
  }
}

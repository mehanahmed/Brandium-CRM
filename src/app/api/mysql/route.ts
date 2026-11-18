import { NextResponse } from "next/server";
import { executeMySQLQueryFn } from "@/lib/crm.functions";
import { forbidden, readSession, unauthorized } from "@/lib/session-server";
import { getRolePermissions, getUnscopedTables } from "@/lib/data-scope-server";
import { linkChecksFor, runLinkGuardedWrite } from "@/lib/link-guard-server";
import { isAdminOnlySql, scopeSqlForUser, SqlScopeError, writeTargetOf } from "@/lib/sql-scope";
import { TRUSTED_SQL } from "@/lib/trusted-sql";
import { broadcastChange, isWriteSql, tablesWrittenBy } from "@/lib/realtime-server";

// Shared setup tables everyone reads: only roles with the matching manage permission may write
const TABLE_WRITE_PERMISSIONS: Record<string, string> = {
  stages: "perm-stages-manage",
  services: "perm-services-manage",
};

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

    // Soft-deleting a user: an admin account cannot be deleted by an admin (the UI hides it too)
    const isUsersUpdate = /\bupdate\s+`?users`?(\s|$)/i.test(sql);
    if (isUsersUpdate && /\bis_deleted`?\s*=\s*1\b/i.test(sql)) {
      const targetId = String(params[params.length - 1] ?? "");
      const target = (await executeMySQLQueryFn({
        data: {
          sql: "SELECT role FROM `users` WHERE `id` = ? LIMIT 1;",
          params: [targetId],
          selfHeal: false,
        },
      })) as { data?: unknown };
      const row = Array.isArray(target.data)
        ? (target.data[0] as Record<string, unknown> | undefined)
        : undefined;
      if (row && String(row["role"] || "").toUpperCase() === "ADMIN") {
        return NextResponse.json(
          { success: false, error: "Admin accounts cannot be deleted." },
          { status: 403 },
        );
      }
    }

    // Non-admins read their own rows, except in data areas their role sets to "All users' data"
    let runSql = sql;
    const unscoped = session.admin ? new Set<string>() : await getUnscopedTables(session.role);
    if (!session.admin && !TRUSTED_SQL.get(sql)?.(params)) {
      try {
        runSql = scopeSqlForUser(sql, session.id, unscoped);
      } catch (err) {
        if (!(err instanceof SqlScopeError)) throw err;
        return NextResponse.json({ success: false, error: err.message }, { status: 403 });
      }
    }
    // Check again on the rewritten SQL: comments are gone by now (`INTO/**/OUTFILE`)
    if (!session.admin && isAdminOnlySql(runSql)) return forbidden();
    if (!session.admin) {
      const target = writeTargetOf(runSql);
      const needed = target ? TABLE_WRITE_PERMISSIONS[target] : undefined;
      if (needed && !(await getRolePermissions(session.role)).has(needed)) return forbidden();
    }

    // A non-admin write that touches link rows must not open someone else's lead, quotation
    // or project (see link-guard-server.ts)
    const linkChecks = session.admin ? [] : linkChecksFor(runSql, unscoped);
    let result: { success?: boolean | undefined; data?: unknown; error?: string | undefined };
    if (linkChecks.length > 0) {
      const guarded = await runLinkGuardedWrite(runSql, params, session.id, linkChecks);
      if (guarded.blocked) return forbidden();
      result = guarded.result;
    } else {
      result = (await executeMySQLQueryFn({
        data: { sql: runSql, params, selfHeal: session.admin },
      })) as { success?: boolean; data?: unknown; error?: string };
    }

    // Tell every open page that data changed (they refetch; see components/realtime-sync.tsx)
    if (result.success !== false && isWriteSql(runSql)) {
      broadcastChange(tablesWrittenBy(runSql));
    }

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

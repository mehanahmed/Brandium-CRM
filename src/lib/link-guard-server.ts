import type { PoolConnection } from "mysql2/promise";

import {
  ensureBootstrapped,
  toQueryResponse,
  type UniversalQueryResponse,
} from "@/lib/crm.functions";
import { getMySQLPool } from "@/lib/mysql-server";

/**
 * Link rows give a user read and write access to the parent record (see scopeRules in
 * sql-scope.ts): a meeting or follow-up assigned to you opens the lead, a quotation/project
 * assignee row opens the quotation/project. A non-admin write must not create new access that
 * way, e.g. `INSERT INTO meetings (prospect_id, assigned_user_id) VALUES ('<their lead>', '<me>')`.
 *
 * Such writes run in a transaction. Before and after the statement we count the parents the user
 * reaches only through a link (not as owner); if that number goes up, the write is rolled back.
 * Linking yourself again to a record you already reach, or linking someone else, is unchanged.
 */
interface LinkCheck {
  /** Scoped table this check protects; skipped when the role reads it in full. */
  parent: string;
  /** Write SQL that mentions one of these tables is checked. */
  links: RegExp;
  sql: string;
  params: (me: string) => string[];
}

const LINK_CHECKS: LinkCheck[] = [
  {
    parent: "prospects",
    links: /\b(meetings|prospect_stage_history)\b/i,
    sql: `SELECT COUNT(DISTINCT x.pid) AS n FROM (
        SELECT prospect_id AS pid FROM prospect_stage_history WHERE follow_up_assigned_to = ?
        UNION ALL
        SELECT prospect_id FROM meetings WHERE assigned_user_id = ? OR assigned_to = ?
      ) x
      JOIN prospects p ON p.id = x.pid
      WHERE NOT (p.assigned_to <=> ? OR p.assigned_artist_id <=> ? OR p.created_by <=> ?)`,
    params: (me) => [me, me, me, me, me, me],
  },
  {
    parent: "quotations",
    links: /\bquotation_assignees\b/i,
    sql: `SELECT COUNT(DISTINCT a.quotation_id) AS n
      FROM quotation_assignees a JOIN quotations q ON q.id = a.quotation_id
      WHERE a.user_id = ? AND NOT COALESCE(q.created_by <=> ? OR q.assigned_agent_id <=> ?
        OR q.assigned_artist_id <=> ? OR q.assigned_user_ids LIKE ?, FALSE)`,
    params: (me) => [me, me, me, me, `%"${me}"%`],
  },
  {
    parent: "projects",
    links: /\bproject_assignees\b/i,
    sql: `SELECT COUNT(DISTINCT a.project_id) AS n
      FROM project_assignees a JOIN projects pr ON pr.id = a.project_id
      WHERE a.user_id = ? AND NOT COALESCE(pr.created_by <=> ? OR pr.assigned_agent_id <=> ?
        OR pr.assigned_artist_id <=> ? OR pr.assigned_user_ids LIKE ?, FALSE)`,
    params: (me) => [me, me, me, me, `%"${me}"%`],
  },
];

const WRITE_WORD = /\b(insert|update|delete|replace)\b/i;

/** The checks a non-admin statement needs; empty when it cannot create a link. */
export function linkChecksFor(sql: string, unscopedTables: ReadonlySet<string>): LinkCheck[] {
  if (!WRITE_WORD.test(sql)) return [];
  return LINK_CHECKS.filter((c) => c.links.test(sql) && !unscopedTables.has(c.parent));
}

async function countLinked(conn: PoolConnection, checks: LinkCheck[], me: string) {
  const counts: number[] = [];
  for (const check of checks) {
    const [rows] = await conn.query(check.sql, check.params(me));
    counts.push(Number((rows as Array<{ n?: unknown }>)[0]?.n ?? 0));
  }
  return counts;
}

/** Runs the statement; `blocked` when it would give the user access to someone else's record. */
export async function runLinkGuardedWrite(
  sql: string,
  params: unknown[],
  userId: string,
  checks: LinkCheck[],
): Promise<{ blocked: boolean; result: UniversalQueryResponse }> {
  await ensureBootstrapped();
  const pool = await getMySQLPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const before = await countLinked(conn, checks, userId);
    const [rows] = await conn.query(sql, params);
    const after = await countLinked(conn, checks, userId);
    if (after.some((n, i) => n > (before[i] ?? 0))) {
      await conn.rollback();
      return { blocked: true, result: { success: false, error: "Not allowed." } };
    }
    await conn.commit();
    return { blocked: false, result: toQueryResponse(rows) };
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    const message = (err as { message?: string })?.message || "Database query failed";
    console.error("runLinkGuardedWrite error:", message);
    return { blocked: false, result: { success: false, error: message } };
  } finally {
    conn.release();
  }
}

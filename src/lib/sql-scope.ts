import { escape } from "mysql2";

/**
 * Row-level read scoping for non-admin `/api/mysql` calls.
 *
 * Every read of a company table (FROM / JOIN / comma join, at any depth, also inside a write)
 * is rewritten to a derived table holding only the caller's rows, e.g.
 * `FROM orders o` → `FROM (SELECT * FROM orders WHERE crm_user_id = 'me' OR ...) o`.
 * The rules mirror the filters the pages already applied in the browser, so pages keep working.
 * Write targets (UPDATE t / INSERT INTO t / DELETE FROM t) are left as they are.
 * Anything the parser does not understand is refused instead of run unscoped.
 */
export class SqlScopeError extends Error {}

const PROTECTED_TABLES =
  /\b(users|user_roles|roles|permissions|role_permissions|sms_gateway_settings|sessions|order_stage_positions)\b/i;
// Word boundary, not whitespace: `UPDATE`users`` and `UPDATE/**/users` are writes too
const WRITE_SQL = /\b(insert|update|delete|replace)\b/i;
const ADMIN_ONLY_SQL =
  /\b(alter|drop|truncate|rename|grant|revoke)\s|\bcreate\s+(table|database|index|user|view|trigger|procedure|function|event)\b|\binto\s+(out|dump)file\b|\bload_file\b|\bload\s+data\b|password_hash/i;

/**
 * True when a non-admin must not run this statement: schema changes, password hashes, and
 * writes that touch the user, role or SMS gateway tables.
 * shortcut: a text check on raw SQL is a seat belt, not a wall; replace the raw SQL endpoint
 * with per-action server handlers to enforce per-user access properly.
 */
export const isAdminOnlySql = (sql: string) =>
  ADMIN_ONLY_SQL.test(sql) || (WRITE_SQL.test(sql) && PROTECTED_TABLES.test(sql));

/** Never readable by non-admins (secrets and internal bookkeeping). */
const DENIED_TABLES = new Set([
  "sessions",
  "refresh_tokens",
  "sms_gateway_settings",
  "audit_events",
  "outbox_events",
]);

function scopeRules(userId: string): Record<string, string> {
  const me = escape(userId);
  const meInJson = escape(`%"${userId}"%`);
  const prospectRule = `assigned_to = ${me} OR assigned_artist_id = ${me} OR created_by = ${me}
    OR id IN (SELECT prospect_id FROM prospect_stage_history WHERE follow_up_assigned_to = ${me})
    OR id IN (SELECT prospect_id FROM meetings WHERE assigned_user_id = ${me} OR assigned_to = ${me})`;
  const myProspects = `SELECT id FROM prospects WHERE ${prospectRule}`;
  const myOrders = `SELECT id FROM orders WHERE crm_user_id = ${me} OR designer_id = ${me}`;
  const owned = (assignees: string, fk: string) =>
    `created_by = ${me} OR assigned_agent_id = ${me} OR assigned_artist_id = ${me}
    OR assigned_user_ids LIKE ${meInJson}
    OR id IN (SELECT ${fk} FROM ${assignees} WHERE user_id = ${me})`;

  return {
    prospects: prospectRule,
    prospect_stage_history: `prospect_id IN (${myProspects}) OR follow_up_assigned_to = ${me} OR changed_by = ${me}`,
    activities: `actor_id = ${me} OR prospect_id IN (${myProspects})`,
    meetings: `assigned_user_id = ${me} OR assigned_to = ${me} OR created_by = ${me}`,
    orders: `crm_user_id = ${me} OR designer_id = ${me}`,
    order_comments: `order_id IN (${myOrders})`,
    quotations: owned("quotation_assignees", "quotation_id"),
    quotation_assignees: `user_id = ${me} OR quotation_id IN (SELECT id FROM quotations WHERE created_by = ${me})`,
    projects: owned("project_assignees", "project_id"),
    project_assignees: `user_id = ${me} OR project_id IN (SELECT id FROM projects WHERE created_by = ${me})`,
    opportunities: `assigned_to = ${me} OR created_by = ${me}`,
    sales: `agent_id = ${me}`,
    invoices: `created_by = ${me} OR prospect_id IN (${myProspects})`,
    payments: `recorded_by = ${me} OR prospect_id IN (${myProspects})`,
    expenses: `recorded_by = ${me}`,
    sms_logs: `sent_by = ${me}`,
  };
}

type Token = { kind: "space" | "word" | "ident" | "string" | "punct"; text: string };

// Order matters: executable comments (refused), plain comments (dropped), strings, `idents`, words.
// Assumes the server default sql_mode (backslash escapes on, "..." is a string).
const LEXER =
  /(\s+)|(\/\*M?!)|(--(?=\s|$)[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\[\s\S]|''|[^\\'])*'|"(?:\\[\s\S]|""|[^\\"])*")|(`(?:``|[^`])*`)|([A-Za-z0-9_$@]+)|([\s\S])/gy;

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  LEXER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while (LEXER.lastIndex < sql.length && (m = LEXER.exec(sql))) {
    if (m[2]) throw new SqlScopeError("Executable comments are not allowed.");
    if (m[1] || m[3]) tokens.push({ kind: "space", text: " " });
    else if (m[4]) tokens.push({ kind: "string", text: m[4] });
    else if (m[5]) tokens.push({ kind: "ident", text: m[5] });
    else if (m[6]) tokens.push({ kind: "word", text: m[6] });
    else tokens.push({ kind: "punct", text: m[7] ?? "" });
  }
  return tokens;
}

const STATEMENTS = new Set(["select", "with", "insert", "update", "delete", "replace", "("]);
const MODIFIERS = new Set(["low_priority", "high_priority", "delayed", "ignore", "quick"]);
// Words that end a FROM list (so later commas are not table separators)
// prettier-ignore
const CLAUSE_WORDS = new Set([
  "where", "on", "using", "group", "order", "having", "limit", "union", "except", "intersect",
  "window", "set", "values", "value", "select", "into", "for", "lock", "procedure", "returning",
]);
// Words that can follow a table name but are not its alias
// prettier-ignore
const NOT_ALIAS = new Set([
  ...CLAUSE_WORDS,
  "join", "inner", "left", "right", "cross", "natural", "straight_join", "outer", "full",
  "use", "force", "ignore", "partition", "as",
]);

const word = (t?: Token) => (t && t.kind === "word" ? t.text.toLowerCase() : "");
const tableName = (t: Token) =>
  (t.kind === "ident" ? t.text.slice(1, -1).replace(/``/g, "`") : t.text).toLowerCase();

/** Returns the SQL to run for a non-admin user, or throws SqlScopeError. */
export function scopeSqlForUser(
  sql: string,
  userId: string,
  /** Tables this user's role may read in full ("All users' data" in Role Management). */
  unscopedTables: ReadonlySet<string> = new Set(),
): string {
  if (!userId) throw new SqlScopeError("Missing user.");
  const rules = scopeRules(userId);
  for (const table of unscopedTables) delete rules[table];
  const tokens = tokenize(sql);
  const sig = tokens.flatMap((t, i) => (t.kind === "space" ? [] : [i]));
  const at = (k: number) => (sig[k] === undefined ? undefined : tokens[sig[k]!]);

  const first = word(at(0)) || at(0)?.text || "";
  if (!STATEMENTS.has(first)) throw new SqlScopeError("Only SELECT, INSERT, UPDATE and DELETE.");

  // Per paren depth: FROM list open?, paren holds a query or table list?, paren sits where a table goes?
  const fromList = [false];
  const queryParen = [true];
  const tableParen = [false];
  let depth = 0;
  // Next significant token is a table reference; `target` = write target (checked, not rewritten)
  let expect: false | "read" | "target" = first === "update" ? "target" : false;
  let deleteTargetPending = first === "delete";

  for (let k = first === "update" ? 1 : 0; k < sig.length; k++) {
    const t = at(k)!;
    const w = word(t);

    if (expect) {
      if (MODIFIERS.has(w)) continue;
      const mode: "read" | "target" = expect;
      expect = false;
      if (t.text === "(") {
        const inner = word(at(k + 1));
        depth++;
        fromList[depth] = false;
        queryParen[depth] = true;
        tableParen[depth] = true;
        // `FROM (orders)` / `FROM (a JOIN b)` is a table list, not a subquery
        if (inner !== "select" && inner !== "with") expect = mode;
        continue;
      }
      if (t.kind !== "word" && t.kind !== "ident") throw new SqlScopeError("Unexpected table.");
      if (at(k + 1)?.text === ".")
        throw new SqlScopeError("Database-qualified names are not allowed.");
      const name = tableName(t);
      if (DENIED_TABLES.has(name)) throw new SqlScopeError(`Access to ${name} is not allowed.`);
      fromList[depth] = true;
      const rule = rules[name];
      if (!rule || mode === "target") continue;
      const next = at(k + 1);
      const hasAlias =
        next?.kind === "ident" || (next?.kind === "word" && !NOT_ALIAS.has(word(next)));
      const aliasAs = word(next) === "as";
      tokens[sig[k]!] = {
        kind: "punct",
        text: `(SELECT * FROM \`${name}\` WHERE (${rule}))${hasAlias || aliasAs ? "" : ` AS ${t.text}`}`,
      };
      continue;
    }

    if (t.text === "(") {
      const inner = word(at(k + 1)) || at(k + 1)?.text;
      depth++;
      fromList[depth] = false;
      queryParen[depth] = inner === "select" || inner === "with" || inner === "(";
      tableParen[depth] = false;
    } else if (t.text === ")") {
      if (depth === 0) throw new SqlScopeError("Unbalanced parentheses.");
      const wasTable = tableParen[depth];
      depth--;
      if (wasTable) fromList[depth] = true;
    } else if ((w === "from" || w.endsWith("join")) && queryParen[depth]) {
      expect = w === "from" && deleteTargetPending && depth === 0 ? "target" : "read";
      if (w === "from" && depth === 0) deleteTargetPending = false;
    } else if (w === "into" && depth === 0) {
      expect = "target";
    } else if (t.text === "," && fromList[depth]) {
      expect = "read";
    } else if (CLAUSE_WORDS.has(w)) {
      fromList[depth] = false;
    }
  }
  if (depth !== 0) throw new SqlScopeError("Unbalanced parentheses.");
  limitWriteToOwnRows(first, tokens, sig, rules);
  return tokens.map((t) => t.text).join("");
}

/**
 * A non-admin UPDATE / DELETE on a company table only touches the caller's own rows: the table's
 * read rule is added to the WHERE (`WHERE (rule) AND (original)`). Shapes that could reach other
 * rows another way are refused: multi-table UPDATE / DELETE, REPLACE, INSERT ... ON DUPLICATE KEY.
 * Tables set to "All users' data" have no rule here, so they stay writable in full.
 */
function limitWriteToOwnRows(
  first: string,
  tokens: Token[],
  sig: number[],
  rules: Record<string, string>,
) {
  if (first === "select" || first === "with" || first === "(") return;
  // Depth-0 significant tokens: [sig index, lower-case word, text]
  const top: Array<{ k: number; w: string; text: string }> = [];
  let depth = 0;
  for (let k = 0; k < sig.length; k++) {
    const t = tokens[sig[k]!]!;
    if (t.text === "(") depth++;
    else if (t.text === ")") depth--;
    else if (depth === 0) top.push({ k, w: word(t), text: t.text });
  }
  const tableAt = (i: number) => {
    const t = tokens[sig[top[i]!.k]!]!;
    return t.kind === "word" || t.kind === "ident" ? tableName(t) : "";
  };

  if (first === "insert" || first === "replace") {
    const into = top.findIndex((x) => x.w === "into");
    let i = into + 1;
    while (MODIFIERS.has(top[i]?.w ?? "")) i++;
    const name = into === -1 ? "" : tableAt(i);
    if (!rules[name]) return;
    if (first === "replace") throw new SqlScopeError(`REPLACE into ${name} is not allowed.`);
    if (top.some((x, j) => x.w === "duplicate" && top[j - 1]?.w === "on"))
      throw new SqlScopeError(`ON DUPLICATE KEY UPDATE on ${name} is not allowed.`);
    return;
  }

  // UPDATE [mods] t [alias] SET ... | DELETE [mods] FROM t [alias] WHERE ...
  let i = 1;
  while (MODIFIERS.has(top[i]?.w ?? "")) i++;
  if (first === "delete") {
    if (top[i]?.w !== "from") throw new SqlScopeError("Multi-table DELETE is not allowed.");
    i++;
  }
  const name = tableAt(i);
  const rule = rules[name];
  if (!rule) return;
  i++;
  // Optional alias, then the statement must go straight on (no JOIN, comma or USING)
  const nextWord = top[i]?.w ?? "";
  if (top[i] && nextWord !== "set" && nextWord !== "where" && top[i]!.text !== ";") {
    const isAlias = nextWord === "as" || !NOT_ALIAS.has(nextWord);
    if (nextWord === "as") i++;
    if (isAlias) i++;
  }
  const after = top[i];
  const allowedNext = first === "update" ? ["set"] : ["where", "order", "limit"];
  if (after && !allowedNext.includes(after.w) && after.text !== ";")
    throw new SqlScopeError(`Multi-table ${first.toUpperCase()} is not allowed.`);

  const where = top.find((x, j) => j >= i && x.w === "where");
  const tail = top.find((x, j) => j >= i && (x.w === "order" || x.w === "limit" || x.text === ";"));
  const own = `(${rule})`;
  if (where) {
    const t = tokens[sig[where.k]!]!;
    tokens[sig[where.k]!] = { ...t, text: `WHERE ${own} AND (` };
    if (tail) {
      const tt = tokens[sig[tail.k]!]!;
      tokens[sig[tail.k]!] = { ...tt, text: `) ${tt.text}` };
    } else tokens.push({ kind: "punct", text: ")" });
  } else if (tail) {
    const tt = tokens[sig[tail.k]!]!;
    tokens[sig[tail.k]!] = { ...tt, text: ` WHERE ${own} ${tt.text}` };
  } else tokens.push({ kind: "punct", text: ` WHERE ${own}` });
}

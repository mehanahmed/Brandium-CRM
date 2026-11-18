/**
 * Statements `/api/mysql` runs for non-admins WITHOUT row scoping (see `src/lib/sql-scope.ts`),
 * because they must see every row: next-number generators and the duplicate-phone check.
 * The server matches the exact text, so keep each statement a constant and never build it.
 */

export const PROSPECT_IDS_SQL = "SELECT `id` FROM `prospects` ORDER BY `created_at` DESC;";

// Runs unscoped, so it returns no contact details of leads the caller cannot see
export const PROSPECT_PHONE_MATCH_SQL = `
      SELECT
        p.id,
        COALESCE(st.name, p.stage_id, 'Prospect') AS stage_name,
        COALESCE(prof_agent.full_name, u_agent.name, 'Unassigned') AS assigned_agent_name,
        p.created_at
      FROM \`prospects\` p
      LEFT JOIN \`stages\` st ON (p.stage_id = st.id OR p.stage_id = REPLACE(st.id, '-', '_') OR p.stage_id = st.name)
      LEFT JOIN \`users\` u_agent ON p.assigned_to = u_agent.id
      LEFT JOIN \`profiles\` prof_agent ON p.assigned_to = prof_agent.id
      WHERE p.is_active = 1
        AND (
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(p.phone, ''), ' ', ''), '-', ''), '+', ''), '(', ''), ')', '') LIKE ?
          OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(p.alternative_phone, ''), ' ', ''), '-', ''), '+', ''), '(', ''), ')', '') LIKE ?
        )
        AND p.id != ?
      LIMIT 1;`;

export const ORDER_INSERT_SQL = `INSERT INTO orders (
          job_id, client_name, company_name, phone, address, service_name,
          items_json, discount_amount, shipping_charge, total_amount, paid_amount,
          due_amount, payments_json, is_starred, notes, order_date, delivery_date,
          id, order_number, status, crm_user_id, status_history, is_deleted
        ) SELECT
          COALESCE(?, (
            SELECT CAST(COALESCE(MAX(CAST(job_id AS UNSIGNED)), 1000) + 1 AS CHAR)
            FROM orders WHERE job_id REGEXP '^[0-9]+$'
          )),
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0;`;

export const QUOTATION_INSERT_SQL = `INSERT INTO quotations (
              id, quotation_code, title, prospect_id, client_name, client_phone, client_email, client_address,
              service_id, status, priority, budget, paid_amount, advance_payments, progress, order_date, deadline,
              notes, assigned_agent_id, assigned_artist_id, created_by, is_active, created_at
            ) SELECT ?, COALESCE(?, CONCAT('QT-', (
              SELECT COALESCE(MAX(CAST(SUBSTRING(quotation_code, 4) AS UNSIGNED)), 1000) + 1
              FROM quotations WHERE quotation_code REGEXP '^QT-[0-9]+$'
            ))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, COALESCE(?, NOW());`;

// The phone check only answers "does this phone exist": the pattern must be 6-9 digits.
const phonePattern = (p: unknown) => typeof p === "string" && /^%\d{6,9}%$/.test(p);

/** Trusted statement text → check on its params (true = run unscoped). */
export const TRUSTED_SQL = new Map<string, (params: unknown[]) => boolean>([
  [PROSPECT_IDS_SQL, (params) => params.length === 0],
  [PROSPECT_PHONE_MATCH_SQL, ([a, b]) => phonePattern(a) && a === b],
  [ORDER_INSERT_SQL, () => true],
  [QUOTATION_INSERT_SQL, () => true],
]);

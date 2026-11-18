// Self-check for the non-admin SQL scoping. Run: node --experimental-strip-types src/lib/sql-scope.check.ts
import assert from "node:assert/strict";

// Node needs the .ts extension, tsc refuses it in a static import
const scopeModule = "./sql-scope.ts";
const { isAdminOnlySql, scopeSqlForUser, SqlScopeError, writeTargetOf } = (await import(
  scopeModule
)) as typeof import("./sql-scope");

// Non-admins can never write to the user / role tables, however the SQL is spelled
for (const sql of [
  "UPDATE users SET role = 'ADMIN' WHERE id = 'me'",
  "UPDATE`users`SET role = 'ADMIN' WHERE id = 'me'",
  "UPDATE/**/users SET role = 'ADMIN' WHERE id = 'me'",
  "INSERT`role_permissions`VALUES ('role-global-agent', 'perm-admin-roles', NOW())",
  "REPLACE INTO roles (id, name) VALUES ('x', 'Admin')",
]) {
  assert.equal(isAdminOnlySql(sql), true, sql);
}
assert.equal(isAdminOnlySql("SELECT id, updated_at FROM users"), false);
// REPLACE() is a string function used by company-table reads (stage history joins users)
assert.equal(
  isAdminOnlySql(
    "SELECT COALESCE(REPLACE(s.id, '-', '_')) AS x FROM prospect_stage_history sh JOIN users u ON u.id = sh.changed_by",
  ),
  false,
);

const me = "u-1";
const scoped = (sql: string) => scopeSqlForUser(sql, me);
const refused = (sql: string) => assert.throws(() => scoped(sql), SqlScopeError, sql);
const wraps = (sql: string, table: string) =>
  assert.match(scoped(sql), new RegExp(`\\(SELECT \\* FROM \`${table}\` WHERE`), sql);

// Reads of company tables get the caller's row filter, wherever they appear
wraps("SELECT * FROM orders", "orders");
assert.match(scoped("SELECT * FROM orders WHERE id = ?"), /\) AS orders WHERE id = \?$/);
assert.match(scoped("SELECT o.id FROM `orders` o"), /\) o$/);
wraps("SELECT 1 FROM users u LEFT JOIN expenses e ON e.recorded_by = u.id", "expenses");
wraps("SELECT * FROM users u, prospects p", "prospects");
wraps("SELECT * FROM (orders)", "orders");
wraps("SELECT (SELECT SUM(amount) FROM payments) AS x", "payments");
wraps(
  "UPDATE prospects SET notes = (SELECT GROUP_CONCAT(notes) FROM orders) WHERE id = ?",
  "orders",
);
wraps("WITH x AS (SELECT * FROM quotations) SELECT * FROM x", "quotations");
assert.ok(scoped("SELECT * FROM orders").includes("'u-1'"));

// Write targets are not wrapped like reads; UPDATE / DELETE get the own-rows condition instead
assert.equal(
  scoped("UPDATE orders SET status = ? WHERE id = ?"),
  "UPDATE orders SET status = ? WHERE (crm_user_id = 'u-1' OR designer_id = 'u-1') AND ( id = ?)",
);
assert.equal(
  scoped("DELETE FROM orders WHERE id = ?"),
  "DELETE FROM orders WHERE (crm_user_id = 'u-1' OR designer_id = 'u-1') AND ( id = ?)",
);
assert.equal(scoped("INSERT INTO orders (id) VALUES (?)"), "INSERT INTO orders (id) VALUES (?)");
assert.equal(
  scoped("SELECT EXTRACT(YEAR FROM o.created_at) FROM stages o"),
  "SELECT EXTRACT(YEAR FROM o.created_at) FROM stages o",
);
assert.equal(scoped("SELECT 'FROM orders' AS s"), "SELECT 'FROM orders' AS s");

// Anything that could slip past the filter is refused
refused("SELECT * FROM sessions");
refused("SELECT * FROM brandium_crm.orders");
refused("SELECT * FROM `information_schema`.`tables`");
refused("SELECT /*!50000 * FROM orders */");
refused("SHOW TABLES");
refused("SET @x = 1");
refused("PREPARE s FROM 'SELECT * FROM orders'");
refused("SELECT * FROM orders WHERE (1");

// Audit bypasses (all passed before): file write, hidden comment, MySQL 8 TABLE statement
refused("SELECT * FROM stages INTO/**/OUTFILE 'C:/xampp/htdocs/x.php'");
refused("SELECT * FROM stages INTO DUMPFILE '/tmp/x'");
refused("SELECT * --\x01'\nFROM orders -- '");
refused("SELECT * FROM stages UNION TABLE orders");
// Password hashes cannot come back under another name: users is read through safe columns
const unionUsers = scoped("SELECT 1,2,3,4,5,6,7,8,9,10,11 UNION ALL SELECT * FROM users");
assert.match(
  unionUsers,
  /\(SELECT id, name, email, role, status, .* FROM `users` WHERE \(TRUE\)\)/,
);
assert.doesNotMatch(unionUsers, /password_hash|SELECT \* FROM `users`/);

// Setup tables: admin-only, or (stages/services) checked by permission in the route
assert.equal(isAdminOnlySql("DELETE FROM followup_stages"), true);
assert.equal(writeTargetOf("UPDATE LOW_PRIORITY `stages` SET name = 'x'"), "stages");
assert.equal(writeTargetOf("DELETE FROM services WHERE id = 1"), "services");
assert.equal(writeTargetOf("INSERT IGNORE INTO stages (id) VALUES (1)"), "stages");
assert.equal(writeTargetOf("SELECT * FROM stages"), null);
refused("UPDATE services s, stages t SET t.name = 'x'");
// Profiles: everyone reads all, but writes only their own row
assert.match(
  scoped("UPDATE profiles SET full_name = 'CEO' WHERE id = 'usr-admin-1'"),
  /WHERE \(id = 'u-1'\) AND \( id = 'usr-admin-1'\)/,
);
assert.equal(scoped("SELECT 1 -- FROM orders"), "SELECT 1  ");

// "All users' data" in Role Management: only the role's unscoped tables are read in full
const ordersArea = new Set(["orders", "order_comments", "projects", "project_assignees"]);
assert.equal(scopeSqlForUser("SELECT * FROM orders", me, ordersArea), "SELECT * FROM orders");
assert.match(
  scopeSqlForUser(
    "SELECT * FROM orders o JOIN expenses e ON e.recorded_by = o.crm_user_id",
    me,
    ordersArea,
  ),
  /^SELECT \* FROM orders o JOIN \(SELECT \* FROM `expenses` WHERE/,
);
assert.match(
  scopeSqlForUser("SELECT * FROM expenses", me, new Set()),
  /\(SELECT \* FROM `expenses` WHERE/,
);

// Non-admin UPDATE / DELETE only reach the caller's own rows
const ownOrders = "(crm_user_id = 'u-1' OR designer_id = 'u-1')";
assert.equal(scoped("DELETE FROM prospects").startsWith("DELETE FROM prospects WHERE ("), true);
assert.equal(
  scoped("UPDATE orders SET total_amount = 0"),
  `UPDATE orders SET total_amount = 0 WHERE ${ownOrders}`,
);
assert.equal(
  scoped("UPDATE `orders` SET notes = ? WHERE id = ? OR 1 = 1;"),
  `UPDATE \`orders\` SET notes = ? WHERE ${ownOrders} AND ( id = ? OR 1 = 1) ;`,
);
assert.equal(
  scoped("DELETE FROM expenses WHERE id = ? LIMIT 1"),
  "DELETE FROM expenses WHERE (recorded_by = 'u-1') AND ( id = ? ) LIMIT 1",
);
assert.match(scoped("UPDATE orders o SET o.notes = ? WHERE o.id = ?"), /^UPDATE orders o SET/);
refused("UPDATE orders o JOIN expenses e ON e.id = o.id SET o.notes = 'x'");
refused("UPDATE orders, expenses SET orders.notes = 'x'");
refused("DELETE orders FROM orders JOIN expenses ON 1 = 1");
refused("DELETE FROM orders USING orders JOIN expenses");
refused("REPLACE INTO orders (id) VALUES ('x')");
refused("INSERT INTO orders (id) VALUES ('x') ON DUPLICATE KEY UPDATE notes = 'x'");
// Plain inserts and writes to tables without a rule are unchanged
assert.equal(scoped("INSERT INTO orders (id) VALUES (?)"), "INSERT INTO orders (id) VALUES (?)");
assert.equal(
  scoped("UPDATE stages SET name = ? WHERE id = ?"),
  "UPDATE stages SET name = ? WHERE id = ?",
);
// "All users' data" for orders: writes there are no longer limited
assert.equal(
  scopeSqlForUser("UPDATE orders SET notes = ? WHERE id = ?", me, ordersArea),
  "UPDATE orders SET notes = ? WHERE id = ?",
);

console.log("sql-scope self-check passed");

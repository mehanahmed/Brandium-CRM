import { getMySQLPool } from "@/lib/mysql-server";
import { unscopedTablesFor } from "@/lib/data-scope";

type CacheEntry = { at: number; permissions: Set<string> };

const CACHE_MS = 30_000;

// On globalThis so `next dev` hot reloads share one cache (same reason as the MySQL pool).
const cache: Map<string, CacheEntry> = ((globalThis as Record<string, unknown>)[
  "__brandiumScopeCache"
] ??= new Map<string, CacheEntry>()) as Map<string, CacheEntry>;

/**
 * A role's current permission ids, read on the server (never trusted from the browser).
 * Cached 30s per role, so Role Management changes apply quickly without signing in again.
 * Any lookup error means no permissions (fail closed).
 */
export async function getRolePermissions(role: string): Promise<Set<string>> {
  const key = role.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.permissions;
  let permissions = new Set<string>();
  try {
    const pool = await getMySQLPool();
    const [rows] = await pool.query(
      `SELECT rp.permission_id FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       WHERE LOWER(r.name) = ?;`,
      [key],
    );
    permissions = new Set((rows as Array<{ permission_id: string }>).map((r) => r.permission_id));
  } catch (err) {
    console.warn("Role permission lookup failed; treating the role as having none:", err);
  }
  cache.set(key, { at: Date.now(), permissions });
  return permissions;
}

/** Tables a non-admin role may read and write in full ("All users' data" in Role Management). */
export async function getUnscopedTables(role: string): Promise<Set<string>> {
  return unscopedTablesFor([...(await getRolePermissions(role))]);
}

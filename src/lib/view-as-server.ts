import type { createSingleMySQLConnection } from "@/lib/mysql-server";

type Conn = Awaited<ReturnType<typeof createSingleMySQLConnection>>;

/** The user shape the browser stores after sign-in (same as `POST /api/auth/login`). */
export type ViewUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  permissions: string[];
  avatar_url: string | null;
  isAdmin: boolean;
  active: boolean;
};

/** Loads one live user with the role and permissions the login route would give them. */
export async function loadViewUser(conn: Conn, userId: string): Promise<ViewUser | null> {
  const [rows] = await conn.query(
    "SELECT id, name, email, role, status, avatar_url FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1",
    [userId],
  );
  const user = (rows as Array<Record<string, unknown>>)[0];
  if (!user) return null;

  const roleName = String(user["role"] || "AGENT").trim();
  const [permRows] = await conn.query(
    `SELECT DISTINCT p.id
     FROM permissions p
     INNER JOIN role_permissions rp ON rp.permission_id = p.id
     INNER JOIN roles r ON rp.role_id = r.id
     WHERE UPPER(TRIM(r.name)) = UPPER(TRIM(?)) OR UPPER(TRIM(r.id)) = UPPER(TRIM(?));`,
    [roleName, roleName],
  );
  const permissions = (permRows as Array<{ id: string }>).map((p) => String(p.id));
  const role = roleName.toLowerCase();

  return {
    id: String(user["id"]),
    name: String(user["name"] || ""),
    email: String(user["email"] || ""),
    role,
    roleName,
    permissions,
    avatar_url: user["avatar_url"] ? String(user["avatar_url"]) : null,
    // Same admin rule as the login route
    isAdmin: role === "admin" || permissions.includes("perm-admin-roles"),
    active: String(user["status"] || "Active") === "Active",
  };
}

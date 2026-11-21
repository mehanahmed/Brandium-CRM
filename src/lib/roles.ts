import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { runMySQLQuery, runMySQLWrite, runMySQLWriteOne } from "./mysql-api";
import { generateUUID } from "./mysql-client";

export type RolePermissionItem = {
  id: string;
  resource: string;
  action: string;
  description: string | null;
};

export type CrmRoleItem = {
  id: string;
  name: string;
  description: string | null;
  user_count: number;
  is_system: boolean;
  permission_ids: string[];
  permissions: RolePermissionItem[];
  created_at: string;
  updated_at: string;
};

export type SaveRolePayload = {
  id?: string | null;
  name: string;
  description?: string | null;
  permission_ids: string[];
};

export type AssignedRoleUser = {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  status: string;
};

export const DEFAULT_SYSTEM_PERMISSIONS: RolePermissionItem[] = [
  // Prospects
  {
    id: "perm-prospects-read",
    resource: "prospects",
    action: "read",
    description: "View prospects and lead records",
  },
  {
    id: "perm-prospects-write",
    resource: "prospects",
    action: "write",
    description: "Create and update prospects",
  },
  {
    id: "perm-prospects-delete",
    resource: "prospects",
    action: "delete",
    description: "Delete and manage prospects",
  },
  {
    id: "perm-prospects-export",
    resource: "prospects",
    action: "export",
    description: "Export prospects to CSV/Excel",
  },

  // Follow-ups
  {
    id: "perm-followups-manage",
    resource: "follow_ups",
    action: "manage",
    description: "Manage prospect follow-ups",
  },

  // Meetings
  {
    id: "perm-meetings-manage",
    resource: "meetings",
    action: "manage",
    description: "Schedule and manage client meetings",
  },

  // Quotations
  {
    id: "perm-quotations-read",
    resource: "quotations",
    action: "read",
    description: "View quotations and proposals",
  },
  {
    id: "perm-quotations-write",
    resource: "quotations",
    action: "write",
    description: "Create and edit quotations",
  },
  {
    id: "perm-quotations-delete",
    resource: "quotations",
    action: "delete",
    description: "Delete quotations",
  },

  // Orders
  { id: "perm-orders-read", resource: "orders", action: "read", description: "View client orders" },
  {
    id: "perm-orders-manage",
    resource: "orders",
    action: "manage",
    description: "Create and update client orders",
  },

  // Projects
  {
    id: "perm-projects-read",
    resource: "projects",
    action: "read",
    description: "View production projects",
  },
  {
    id: "perm-projects-manage",
    resource: "projects",
    action: "manage",
    description: "Create and manage projects",
  },

  // Sales & Billing
  {
    id: "perm-sales-view",
    resource: "sales",
    action: "read",
    description: "View won sales and achievements",
  },
  {
    id: "perm-billing-read",
    resource: "billing",
    action: "read",
    description: "Read billing and invoice records",
  },
  {
    id: "perm-billing-write",
    resource: "billing",
    action: "write",
    description: "Create and collect payments/invoices",
  },

  // Expenses
  {
    id: "perm-expenses-read",
    resource: "expenses",
    action: "read",
    description: "View operational expenses",
  },
  {
    id: "perm-expenses-manage",
    resource: "expenses",
    action: "manage",
    description: "Create and manage expenses",
  },

  // SMS & Communication
  { id: "perm-sms-send", resource: "sms", action: "send", description: "Send single and bulk SMS" },
  { id: "perm-sms-logs", resource: "sms", action: "read", description: "View SMS delivery logs" },

  // Analytics / Reports
  {
    id: "perm-reports-view",
    resource: "reports",
    action: "read",
    description: "View the Agent Activity log",
  },
  {
    id: "perm-agent-reports-view",
    resource: "agent_reports",
    action: "read",
    description: "View the Agent Reports leaderboard",
  },

  // Administration
  {
    id: "perm-admin-users",
    resource: "users",
    action: "admin",
    description: "Manage user accounts and credentials",
  },
  {
    id: "perm-admin-roles",
    resource: "roles",
    action: "admin",
    description: "Manage system roles and permissions",
  },
  {
    id: "perm-services-read",
    resource: "services",
    action: "read",
    description: "View agency services",
  },
  {
    id: "perm-services-manage",
    resource: "services",
    action: "manage",
    description: "Create and modify services",
  },
  {
    id: "perm-stages-manage",
    resource: "stages",
    action: "manage",
    description: "Configure pipeline stages",
  },
  {
    id: "perm-stage-history-view",
    resource: "stages",
    action: "read",
    description: "View stage transitions audit history",
  },
  {
    id: "perm-admin-sms-gateway",
    resource: "sms_gateway",
    action: "admin",
    description: "Configure SMS Gateway settings",
  },
  {
    id: "perm-admin-backup",
    resource: "backup",
    action: "admin",
    description: "Manage database backups and exports",
  },
];

export const permissionsQueryOptions = () =>
  queryOptions({
    queryKey: ["admin-permissions"],
    queryFn: async (): Promise<RolePermissionItem[]> => {
      const res = await runMySQLQuery<Record<string, unknown>[]>(
        "SELECT `id`, `resource`, `action`, `description` FROM `permissions` ORDER BY `resource` ASC, `action` ASC;",
      );
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        return res.data.map((r) => ({
          id: String(r["id"]),
          resource: String(r["resource"] || "general"),
          action: String(r["action"] || "view"),
          description: (r["description"] as string) || null,
        }));
      }
      return DEFAULT_SYSTEM_PERMISSIONS;
    },
    staleTime: 1000 * 60 * 5,
  });

export const rolesQueryOptions = () =>
  queryOptions({
    queryKey: ["admin-roles"],
    queryFn: async (): Promise<CrmRoleItem[]> => {
      // Query roles with real-time user count computed directly from the users table
      const res = await runMySQLQuery<Record<string, unknown>[]>(`
        SELECT r.id, r.name, r.description, r.is_system, r.created_at, r.updated_at,
          COUNT(DISTINCT CASE WHEN u.is_deleted = 0 THEN u.id END) AS user_count
        FROM roles r
        LEFT JOIN users u ON (UPPER(TRIM(u.role)) = UPPER(TRIM(r.name)) OR UPPER(TRIM(u.role)) = UPPER(TRIM(r.id)))
        GROUP BY r.id, r.name, r.description, r.is_system, r.created_at, r.updated_at
        ORDER BY r.is_system DESC, r.name ASC;
      `);

      if (!res.success || !Array.isArray(res.data)) {
        return [
          {
            id: "role-global-admin",
            name: "Admin",
            description: "Full administrative access to all CRM resources and settings.",
            is_system: true,
            permission_ids: DEFAULT_SYSTEM_PERMISSIONS.map((p) => p.id),
            permissions: DEFAULT_SYSTEM_PERMISSIONS,
            user_count: 2,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "role-global-agent",
            name: "Agent",
            description: "Standard CRM agent for leads, prospects, quotations and sales.",
            is_system: true,
            permission_ids: [
              "perm-prospects-read",
              "perm-prospects-write",
              "perm-followups-manage",
              "perm-meetings-manage",
              "perm-quotations-read",
              "perm-quotations-write",
              "perm-orders-read",
              "perm-sales-view",
            ],
            permissions: DEFAULT_SYSTEM_PERMISSIONS.filter((p) =>
              [
                "perm-prospects-read",
                "perm-prospects-write",
                "perm-followups-manage",
                "perm-meetings-manage",
                "perm-quotations-read",
                "perm-quotations-write",
                "perm-orders-read",
                "perm-sales-view",
              ].includes(p.id),
            ),
            user_count: 3,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "role-global-artist",
            name: "Artist",
            description: "Creative artist for graphic designs, video ads & media assets.",
            is_system: true,
            permission_ids: [
              "perm-projects-read",
              "perm-projects-manage",
              "perm-orders-read",
              "perm-prospects-read",
              "perm-services-read",
              "perm-sales-view",
            ],
            permissions: DEFAULT_SYSTEM_PERMISSIONS.filter((p) =>
              [
                "perm-projects-read",
                "perm-projects-manage",
                "perm-orders-read",
                "perm-prospects-read",
                "perm-services-read",
                "perm-sales-view",
              ].includes(p.id),
            ),
            user_count: 2,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      }

      const roleList: CrmRoleItem[] = [];
      for (const r of res.data) {
        const roleId = String(r["id"]);
        const permRes = await runMySQLQuery<Record<string, unknown>[]>(
          "SELECT p.id, p.resource, p.action, p.description FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = ? ORDER BY p.resource ASC, p.action ASC;",
          [roleId],
        );
        const perms: RolePermissionItem[] = Array.isArray(permRes.data)
          ? permRes.data.map((p) => ({
              id: String(p["id"]),
              resource: String(p["resource"] || "general"),
              action: String(p["action"] || "view"),
              description: (p["description"] as string) || null,
            }))
          : [];

        const isSys =
          Boolean(r["is_system"]) ||
          roleId.startsWith("role-global-") ||
          ["admin", "agent", "artist"].includes(String(r["name"] || "").toLowerCase());

        roleList.push({
          id: roleId,
          name: String(r["name"]),
          description: (r["description"] as string) || null,
          is_system: isSys,
          permission_ids: perms.map((p) => p.id),
          permissions: perms,
          user_count: Number(r["user_count"] || 0),
          created_at: String(r["created_at"] || new Date().toISOString()),
          updated_at: String(r["updated_at"] || new Date().toISOString()),
        });
      }

      return roleList;
    },
    staleTime: 1000 * 30,
  });

export async function fetchUsersForRole(
  roleName: string,
  roleId: string,
): Promise<AssignedRoleUser[]> {
  try {
    const res = await runMySQLQuery<Record<string, unknown>[]>(
      `SELECT id, name, email, avatar_url, status
       FROM \`users\`
       WHERE (UPPER(TRIM(role)) = UPPER(TRIM(?)) OR UPPER(TRIM(role)) = UPPER(TRIM(?)))
         AND is_deleted = 0
       ORDER BY name ASC;`,
      [roleName, roleId],
    );
    if (res.success && Array.isArray(res.data)) {
      return res.data.map((u) => ({
        id: String(u["id"]),
        name: String(u["name"] || "User"),
        email: String(u["email"] || ""),
        avatar_url: u["avatar_url"] ? String(u["avatar_url"]) : null,
        status: String(u["status"] || "Active"),
      }));
    }
  } catch (err) {
    console.error("fetchUsersForRole error:", err);
  }
  return [];
}

/** Permission id that lets a role work on one project stage. */
export const projectStagePermId = (stageId: string) => `perm-pstage-${stageId}`;

/**
 * Project stage permissions must exist in `permissions` (role lists join it) before a role can
 * keep them. `(resource, action)` is unique, so each stage gets its own action name.
 */
export async function ensureProjectStagePermissions(stages: { id: string; name: string }[]) {
  for (const stage of stages) {
    await runMySQLWrite(
      "INSERT IGNORE INTO `permissions` (`id`, `resource`, `action`, `description`) VALUES (?, 'project_stage', ?, ?);",
      [projectStagePermId(stage.id), stage.id, `Work on the ${stage.name} project stage`],
    );
  }
}

export function useSaveRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SaveRolePayload) => {
      const name = payload.name.trim();
      if (!name) {
        throw new Error("Role name is required.");
      }

      const roleId = payload.id || `role-${generateUUID()}`;
      const isUpdate = Boolean(payload.id);

      // Check for duplicate name
      const dupCheck = await runMySQLQuery<Record<string, unknown>[]>(
        "SELECT id FROM `roles` WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ? LIMIT 1;",
        [name, roleId],
      );
      if (dupCheck.success && Array.isArray(dupCheck.data) && dupCheck.data.length > 0) {
        throw new Error(`A role with the name "${name}" already exists.`);
      }

      if (isUpdate) {
        // If it's a system role, do not rename system roles
        const checkSys = await runMySQLQuery<Record<string, unknown>[]>(
          "SELECT is_system, name FROM `roles` WHERE id = ? LIMIT 1;",
          [roleId],
        );
        const current = checkSys.data?.[0];
        if (!checkSys.success || !current) throw new Error("Could not load the role. Try again.");
        const oldName = String(current["name"] || "");
        const isSysRole =
          Boolean(current["is_system"]) ||
          ["admin", "agent", "artist"].includes(oldName.toLowerCase());

        if (isSysRole) {
          // Keep system role name intact, update description only
          await runMySQLWrite("UPDATE `roles` SET `description` = ? WHERE `id` = ?;", [
            payload.description || null,
            roleId,
          ]);
        } else {
          await runMySQLWrite("UPDATE `roles` SET `name` = ?, `description` = ? WHERE `id` = ?;", [
            name,
            payload.description || null,
            roleId,
          ]);
          // Users hold the role by name (upper-case, see the user forms); a rename must carry
          // them along or they match no role and lose every permission.
          if (oldName.trim().toUpperCase() !== name.toUpperCase()) {
            await runMySQLWrite(
              "UPDATE `users` SET `role` = ? WHERE UPPER(TRIM(`role`)) = UPPER(TRIM(?));",
              [name.toUpperCase(), oldName],
            );
          }
        }
      } else {
        await runMySQLWrite(
          "INSERT INTO `roles` (`id`, `name`, `description`, `is_system`) VALUES (?, ?, ?, 0);",
          [roleId, name, payload.description || null],
        );
      }

      // Add the new set first, then drop the rest: a failure part-way leaves the old or a
      // larger set, never a role with half its permissions gone. Both throw on failure.
      const ids = [...new Set(payload.permission_ids)];
      if (ids.length > 0) {
        await runMySQLWrite(
          `INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`) VALUES ${ids
            .map(() => "(?, ?)")
            .join(", ")};`,
          ids.flatMap((id) => [roleId, id]),
        );
        await runMySQLWrite(
          `DELETE FROM \`role_permissions\` WHERE \`role_id\` = ? AND \`permission_id\` NOT IN (${ids
            .map(() => "?")
            .join(", ")});`,
          [roleId, ...ids],
        );
      } else {
        await runMySQLWrite("DELETE FROM `role_permissions` WHERE `role_id` = ?;", [roleId]);
      }

      return { success: true, id: roleId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-permissions"] });
      toast.success(
        variables.id
          ? `Role "${variables.name}" updated successfully!`
          : `Role "${variables.name}" created successfully!`,
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save role");
    },
  });
}

export function useDeleteRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (role: CrmRoleItem) => {
      if (
        role.is_system ||
        role.id.startsWith("role-global-") ||
        ["admin", "agent", "artist"].includes(role.name.toLowerCase())
      ) {
        throw new Error("System default roles cannot be deleted.");
      }

      // Safety check: ensure no active users have this role
      const usersAssigned = await fetchUsersForRole(role.name, role.id);
      if (usersAssigned.length > 0) {
        throw new Error(
          `Cannot delete role "${role.name}": ${usersAssigned.length} active user(s) currently assigned. Please reassign those users before deleting.`,
        );
      }

      // The users check above returns [] when its lookup fails, so the delete checks again itself
      await runMySQLWriteOne(
        `DELETE FROM \`roles\` WHERE \`id\` = ? AND \`is_system\` = 0 AND NOT EXISTS (
           SELECT 1 FROM \`users\` u WHERE u.is_deleted = 0
             AND (UPPER(TRIM(u.role)) = UPPER(TRIM(?)) OR UPPER(TRIM(u.role)) = UPPER(TRIM(?))));`,
        [role.id, role.name, role.id],
      ).catch(() => {
        throw new Error(`Role "${role.name}" was not deleted: users still have it, or it is gone.`);
      });
      await runMySQLWrite("DELETE FROM `role_permissions` WHERE `role_id` = ?;", [role.id]);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      toast.success("Role deleted successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete role");
    },
  });
}

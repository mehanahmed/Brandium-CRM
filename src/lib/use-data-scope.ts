"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";
import { scopeAllPermissionId, type DataScopeArea } from "@/lib/data-scope";
import { runMySQLQuery } from "@/lib/mysql-api";

/** The signed-in user's "All users' data" areas, read fresh from the role (not the login copy). */
const roleScopeQueryOptions = (role: string | null | undefined) =>
  queryOptions({
    queryKey: ["data-scope", role],
    queryFn: async (): Promise<string[]> => {
      const res = await runMySQLQuery<Record<string, unknown>[]>(
        `SELECT rp.permission_id FROM role_permissions rp
         JOIN roles r ON r.id = rp.role_id
         WHERE LOWER(r.name) = LOWER(?) AND rp.permission_id LIKE 'perm-scope-all-%';`,
        [role || ""],
      );
      return (res.data || []).map((r) => String(r["permission_id"]));
    },
    enabled: Boolean(role),
    staleTime: 30_000,
  });

/**
 * True when the current user sees every user's rows in `area`: admins always, others when their
 * role is set to "All users' data". Pass the result where pages used to pass `isAdmin`.
 */
export function useSeesAllData(area: DataScopeArea): boolean {
  const { role, isAdmin } = useAuth();
  const { data = [] } = useQuery({ ...roleScopeQueryOptions(role), enabled: !isAdmin && !!role });
  return isAdmin || data.includes(scopeAllPermissionId(area));
}

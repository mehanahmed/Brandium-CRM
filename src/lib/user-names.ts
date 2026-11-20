"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { crmUsersQueryOptions, type CrmUser } from "@/lib/admin-users";

export type NameOf = (userId?: string | null, savedName?: string | null) => string;

/**
 * Shows a user's CURRENT name from their id. Many records save the name as text at the time
 * (payment "Recorded By", status history, comments, lead notes), which goes stale when a user
 * is renamed. Falls back to the saved text for old entries without an id, or deleted users.
 * Pass `enabled = false` on public pages: reading the user list needs a signed-in session.
 */
export function useUserName(enabled = true): NameOf {
  const { data } = useQuery({ ...crmUsersQueryOptions(), enabled });
  const byId = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of (data as CrmUser[] | undefined) ?? []) if (u.name) map.set(u.id, u.name);
    return map;
  }, [data]);
  return useCallback(
    (userId, savedName) => (userId ? byId.get(userId) : undefined) || savedName || "",
    [byId],
  );
}

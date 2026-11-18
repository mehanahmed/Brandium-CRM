import type { ServerSession } from "@/lib/session-server";
import { getRolePermissions } from "@/lib/data-scope-server";

/** Who may see and change the Telegram settings: admins, or roles given the Notifications page. */
export async function canManageTelegram(session: ServerSession): Promise<boolean> {
  return session.admin || (await getRolePermissions(session.role)).has("perm-admin-notifications");
}

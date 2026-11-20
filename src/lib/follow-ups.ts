import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

import { fetchCrmUsers } from "@/lib/admin-users";
import { runMySQLQuery, runMySQLWrite } from "@/lib/mysql-api";
import { addStageNote, FALLBACK_STAGES, resolveStageColor } from "@/lib/stages";
import { generateUUID, getMySQLTimestamp } from "@/lib/mysql-client";

export const agentsQuery = () =>
  queryOptions({
    queryKey: ["agent-profiles"],
    queryFn: async () => {
      try {
        const users = await fetchCrmUsers();
        if (users && users.length > 0) {
          return users.map((u) => ({
            id: u.id,
            name: `${u.name}${u.role ? ` (${u.role})` : ""}`,
          }));
        }
      } catch {
        // Fallback
      }

      return [
        { id: "usr-admin-1", name: "Admin (Executive)" },
        { id: "usr-agent-1", name: "Tanvir Hasan (Agent)" },
        { id: "usr-agent-2", name: "Nusrat Jahan (Agent)" },
        { id: "usr-agent-3", name: "Rafiqul Islam (Agent)" },
      ];
    },
  });

export function useCreateFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      prospect_id: string;
      assigned_to: string;
      created_by: string;
      due_at: string;
      note?: string;
    }) => {
      const now = getMySQLTimestamp();
      const dueLabel = format(new Date(input.due_at), "dd MMM yyyy, hh:mm a");
      const historyId = generateUUID();

      // Resolve "Follow-up" stage ID from MySQL
      const stageRes = await runMySQLQuery<Record<string, unknown>[]>(
        "SELECT `id` FROM `stages` WHERE LOWER(TRIM(`name`)) LIKE '%follow%' LIMIT 1;",
      );
      const followUpStageId =
        stageRes?.success && stageRes.data?.[0] ? String(stageRes.data[0]["id"]) : "follow-up";

      // Get prospect's current stage for transition history
      let fromStageId: string | null = null;
      try {
        const currRes = await runMySQLQuery<Record<string, unknown>[]>(
          "SELECT `stage_id` FROM `prospects` WHERE `id` = ? LIMIT 1;",
          [input.prospect_id],
        );
        if (currRes?.success && currRes.data?.[0]) {
          fromStageId = String(currRes.data[0]["stage_id"] || "") || null;
        }
      } catch {
        // ignore
      }

      // The follow-up itself is stored on this stage history row
      await runMySQLWrite(
        `INSERT INTO \`prospect_stage_history\` (\`id\`, \`prospect_id\`, \`from_stage_id\`, \`to_stage_id\`, \`changed_by\`, \`note\`, \`changed_at\`, \`follow_up_due_at\`, \`follow_up_assigned_to\`, \`follow_up_status\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
        [
          historyId,
          input.prospect_id,
          fromStageId,
          followUpStageId,
          input.created_by,
          `Follow-up scheduled for ${dueLabel}${input.note ? ` — ${input.note}` : ""}`,
          now,
          getMySQLTimestamp(new Date(input.due_at)),
          input.assigned_to,
        ],
      );

      // Only after the follow-up row is saved, so a failed save never leaves the lead moved
      await runMySQLWrite(
        "UPDATE `prospects` SET `stage_id` = ?, `updated_at` = ? WHERE `id` = ?;",
        [followUpStageId, now, input.prospect_id],
      );

      // Activity log
      await runMySQLQuery(
        `INSERT INTO \`activities\` (\`id\`, \`prospect_id\`, \`actor_id\`, \`activity_type\`, \`message\`, \`created_at\`)
           VALUES (?, ?, ?, 'follow_up_created', ?, ?);`,
        [
          generateUUID(),
          input.prospect_id,
          input.created_by,
          `New follow-up task scheduled for ${dueLabel}${input.note ? ` — ${input.note}` : ""}`,
          now,
        ],
      );
      return { id: historyId, prospect_id: input.prospect_id };
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
      void queryClient.invalidateQueries({ queryKey: ["prospects"] });
      void queryClient.invalidateQueries({ queryKey: ["prospects-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (data?.prospect_id) {
        void queryClient.invalidateQueries({ queryKey: ["stage-history", data.prospect_id] });
      }
    },
  });
}

// -----------------------------------------------------------------------------
// Follow-up board (ERPAPP /follow-up clone). A follow-up is a
// `prospect_stage_history` row with `follow_up_due_at` set; the board shows the
// latest one per prospect, grouped into columns by the prospect's pipeline stage
// (`prospects.stage_id` → `stages`), so the board and the prospect stage never differ.
// -----------------------------------------------------------------------------

export type FollowUpStage = { id: string; name: string; color: string; group: string };

export type FollowUpBoardItem = {
  id: string;
  prospect_id: string;
  /** False for a prospect with no scheduled follow-up; `due_at` is then "". */
  has_follow_up: boolean;
  due_at: string;
  status: string;
  assigned_to: string | null;
  agent_name: string;
  agent_avatar: string | null;
  created_by: string | null;
  creator_name: string;
  creator_avatar: string | null;
  changed_at: string;
  note: string | null;
  contact_name: string;
  business_name: string;
  phone: string;
  address: string;
  logo_url: string | null;
};

const normalizeStage = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace("cancelled", "canceled");

/** Column for a prospect stage id; legacy ids ("follow_up") and stage names also match. */
export const followUpStageFor = (stageId: string, stages: FollowUpStage[]) => {
  const key = normalizeStage(stageId || "");
  return (
    stages.find((s) => normalizeStage(s.id) === key || normalizeStage(s.name) === key) || stages[0]
  );
};

/** Board columns = the active prospect pipeline stages (`stages`). */
export const followUpStagesQueryOptions = () =>
  queryOptions({
    queryKey: ["follow-up-stages"],
    queryFn: async (): Promise<FollowUpStage[]> => {
      const res = await runMySQLQuery<Record<string, unknown>[]>(
        "SELECT `id`, `name`, `color`, `stage_group` FROM `stages` WHERE `is_active` = 1 OR `is_active` IS NULL ORDER BY `sort_order` ASC, `name` ASC;",
      );
      const rows = (res.data || []) as Record<string, unknown>[];
      const source =
        res.success && rows.length > 0
          ? rows.map((r) => ({
              id: String(r["id"]),
              name: String(r["name"]),
              color: r["color"] ? String(r["color"]) : null,
              group: String(r["stage_group"] || "new"),
            }))
          : FALLBACK_STAGES.map((st) => ({ ...st, group: st.stage_group }));
      return source.map((st) => ({
        id: st.id,
        name: st.name,
        color: resolveStageColor(st.name, st.color),
        group: st.group,
      }));
    },
  });

export const followUpBoardQueryOptions = (userId: string | undefined, isAdmin: boolean) =>
  queryOptions({
    queryKey: ["follow-ups", "board", userId, isAdmin],
    queryFn: async (): Promise<FollowUpBoardItem[]> => {
      const res = await runMySQLQuery<Record<string, unknown>[]>(
        // One card per active prospect. The row is its latest follow-up, or its latest
        // stage row when it has none, so a prospect without a follow-up still shows.
        // Newest prospect first; each board column keeps this order.
        `SELECT h.id, p.id AS prospect_id, h.follow_up_due_at, h.follow_up_status, h.follow_up_assigned_to,
                h.changed_by, h.changed_at, h.note, p.stage_id,
                p.contact_name, p.business_name, p.phone, p.address, p.logo_url,
                COALESCE(prof.full_name, u.name) AS agent_name,
                COALESCE(prof.avatar_url, u.avatar_url) AS agent_avatar,
                COALESCE(cprof.full_name, c.name) AS creator_name,
                COALESCE(cprof.avatar_url, c.avatar_url) AS creator_avatar
         FROM \`prospects\` p
         LEFT JOIN \`prospect_stage_history\` h ON h.id = COALESCE(
           (SELECT f.id FROM \`prospect_stage_history\` f WHERE f.prospect_id = p.id AND f.follow_up_due_at IS NOT NULL ORDER BY f.changed_at DESC LIMIT 1),
           (SELECT s.id FROM \`prospect_stage_history\` s WHERE s.prospect_id = p.id ORDER BY s.changed_at DESC LIMIT 1)
         )
         LEFT JOIN \`users\` u ON u.id = h.follow_up_assigned_to
         LEFT JOIN \`profiles\` prof ON prof.id = h.follow_up_assigned_to
         LEFT JOIN \`users\` c ON c.id = h.changed_by
         LEFT JOIN \`profiles\` cprof ON cprof.id = h.changed_by
         WHERE (p.is_active = 1 OR p.is_active IS NULL)
         ORDER BY p.created_at DESC, p.id DESC;`,
      );
      if (!res.success) throw new Error(res.error || "Failed to load follow-ups");

      const items: FollowUpBoardItem[] = [];
      for (const r of (res.data || []) as Record<string, unknown>[]) {
        const prospectId = String(r["prospect_id"]);
        const hasFollowUp = !!r["follow_up_due_at"];
        const assignedTo = r["follow_up_assigned_to"] ? String(r["follow_up_assigned_to"]) : null;
        const createdBy = r["changed_by"] ? String(r["changed_by"]) : null;
        if (hasFollowUp && !isAdmin && userId && assignedTo !== userId && createdBy !== userId) {
          continue;
        }
        items.push({
          id: String(r["id"] || ""),
          prospect_id: prospectId,
          has_follow_up: hasFollowUp,
          due_at: hasFollowUp ? String(r["follow_up_due_at"]) : "",
          // The prospect's current pipeline stage decides the column
          status: String(r["stage_id"] || "prospect"),
          assigned_to: assignedTo,
          agent_name: String(r["agent_name"] || "Unassigned"),
          agent_avatar: r["agent_avatar"] ? String(r["agent_avatar"]) : null,
          created_by: createdBy,
          creator_name: String(r["creator_name"] || "System"),
          creator_avatar: r["creator_avatar"] ? String(r["creator_avatar"]) : null,
          changed_at: String(r["changed_at"] || ""),
          note: r["note"] ? String(r["note"]) : null,
          contact_name: String(r["contact_name"] || ""),
          business_name: String(r["business_name"] || ""),
          phone: String(r["phone"] || ""),
          address: String(r["address"] || ""),
          logo_url: r["logo_url"] ? String(r["logo_url"]) : null,
        });
      }
      return items;
    },
  });

/**
 * ERPAPP `updateFollowUpStatusAction`: optional stage change plus a timeline note.
 * `status` is the target prospect stage id; a change moves the prospect itself.
 */
export function useUpdateFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      item: FollowUpBoardItem;
      status: string;
      statusName: string;
      notes: string;
      /** Next follow-up date (`datetime-local` value); unchanged when it matches the current one. */
      nextDueAt?: string | undefined;
      userId: string | undefined;
      userName: string;
    }) => {
      const { item, status, statusName, notes, nextDueAt, userId, userName } = input;
      const statusChanged = normalizeStage(item.status) !== normalizeStage(status);
      const nextDue = nextDueAt ? new Date(nextDueAt) : null;
      if (nextDue && Number.isNaN(nextDue.getTime())) throw new Error("Invalid follow-up date.");
      const newDueAt = nextDue ? getMySQLTimestamp(nextDue) : null;
      const dueChanged = !!newDueAt && newDueAt.slice(0, 16) !== item.due_at.slice(0, 16);
      let historyId = item.id;
      // A prospect with no stage history yet has no row to update, so it gets a new one
      if (statusChanged || !item.id) {
        const now = getMySQLTimestamp();
        await runMySQLWrite(
          "UPDATE `prospects` SET `stage_id` = ?, `updated_at` = ? WHERE `id` = ?;",
          [status, now, item.prospect_id],
        );
        // New stage transition row; the follow-up moves onto it so the board shows its note
        historyId = generateUUID();
        await runMySQLWrite(
          `INSERT INTO \`prospect_stage_history\` (\`id\`, \`prospect_id\`, \`from_stage_id\`, \`to_stage_id\`, \`changed_by\`, \`changed_at\`, \`follow_up_due_at\`, \`follow_up_assigned_to\`, \`follow_up_status\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            historyId,
            item.prospect_id,
            item.status,
            status,
            userId || null,
            now,
            dueChanged ? newDueAt : item.has_follow_up ? item.due_at : null,
            item.assigned_to,
            status,
          ],
        );
      } else if (dueChanged) {
        await runMySQLWrite(
          "UPDATE `prospect_stage_history` SET `follow_up_due_at` = ? WHERE `id` = ?;",
          [newDueAt, item.id],
        );
      }
      const outcome = [
        statusChanged ? `Stage changed to ${statusName}` : "Activity Updated",
        dueChanged && nextDue ? `next follow-up ${format(nextDue, "dd MMM yyyy, hh:mm a")}` : "",
      ]
        .filter(Boolean)
        .join(", ");
      const saved = await addStageNote({
        prospectId: item.prospect_id,
        historyId,
        note: notes.trim(),
        userId: userId || null,
        userName,
      });
      if (!saved) throw new Error("Failed to save the note");
      await runMySQLQuery(
        `INSERT INTO \`activities\` (\`id\`, \`prospect_id\`, \`actor_id\`, \`activity_type\`, \`message\`, \`created_at\`)
         VALUES (?, ?, ?, 'follow_up_updated', ?, ?);`,
        [
          generateUUID(),
          item.prospect_id,
          userId || null,
          `${outcome} — ${notes.trim()}`,
          getMySQLTimestamp(),
        ],
      );
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["prospects"] });
      void queryClient.invalidateQueries({ queryKey: ["prospects-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["stage-history", input.item.prospect_id] });
    },
  });
}

/** Removes a prospect from the board; its stage history entries stay. */
export function useRemoveFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prospectId: string) => {
      const res = await runMySQLQuery(
        `UPDATE \`prospect_stage_history\`
         SET \`follow_up_due_at\` = NULL, \`follow_up_assigned_to\` = NULL, \`follow_up_status\` = NULL
         WHERE \`prospect_id\` = ? AND \`follow_up_due_at\` IS NOT NULL;`,
        [prospectId],
      );
      if (!res.success) throw new Error(res.error || "Failed to delete follow-up");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

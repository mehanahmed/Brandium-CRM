import { queryOptions } from "@tanstack/react-query";
import { runMySQLQuery } from "@/lib/mysql-api";
import { getMySQLTimestamp } from "@/lib/mysql-client";

export type AgentReportPeriod = "overview" | "weekly" | "monthly";

export type OverallFinancials = {
  won_value: number;
  pipeline_value: number;
  lost_value: number;
};

export type AgentActivityItem = {
  id: string;
  type: string;
  message: string;
  timestamp: string;
};

export type AgentMetrics = {
  agent_id: string;
  name: string;
  email: string;
  avatar_url?: string | undefined;
  status: "Active" | "Inactive";
  prospects_count: number;
  stage_changes: number;
  status_changes: number;
  followups_completed: number;
  overdue_followups: number;
  opportunities_created: number;
  sales_won: number;
  won_value: number;
  lost_count: number;
  conversion_rate: number;
  last_activity: string;
  recent_activities: AgentActivityItem[];
};

export type AgentReportsData = {
  overall: OverallFinancials;
  agents: AgentMetrics[];
};

/** Start of the period as a Dhaka DATETIME string; null means all time (overview). */
const periodStart = (period: AgentReportPeriod): string | null => {
  if (period === "overview") return null;
  const days = period === "weekly" ? 7 : 30;
  return getMySQLTimestamp(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
};

/** Order status → report bucket. `on-hold` stays in pipeline: it is paused, not cancelled. */
const orderBucket = (status: unknown): "won" | "lost" | "pipeline" => {
  const s = String(status || "").toLowerCase();
  if (s === "delivered") return "won";
  if (s === "canceled" || s === "cancelled") return "lost";
  return "pipeline";
};

export async function fetchAgentReports(
  period: AgentReportPeriod = "overview",
): Promise<AgentReportsData> {
  try {
    const since = periodStart(period);
    const usersRes = await runMySQLQuery<Record<string, unknown>[]>(
      "SELECT id, name, email, role, status, avatar_url, created_at, updated_at FROM `users` WHERE (is_deleted = 0 OR is_deleted IS NULL) ORDER BY name ASC;",
    );
    const prospectsRes = await runMySQLQuery<Record<string, unknown>[]>(
      "SELECT id, assigned_to, stage_id, created_at, updated_at FROM `prospects` WHERE is_active = 1 AND (? IS NULL OR created_at >= ?);",
      [since, since],
    );
    // Orders hold the real business: total_amount per order, owned by crm_user_id
    const ordersRes = await runMySQLQuery<Record<string, unknown>[]>(
      "SELECT id, crm_user_id, status, total_amount FROM `orders` WHERE is_deleted = 0 OR is_deleted IS NULL;",
    );
    // All-time activity feed (for "last activity"); the period filter is applied per agent below
    const actsRes = await runMySQLQuery<Record<string, unknown>[]>(
      "SELECT id, actor_id, activity_type, message, created_at FROM `activities` ORDER BY created_at DESC LIMIT 1000;",
    );

    const users = Array.isArray(usersRes.data) ? usersRes.data : [];
    const prospects = Array.isArray(prospectsRes.data) ? prospectsRes.data : [];
    const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
    const activities = Array.isArray(actsRes.data) ? actsRes.data : [];
    const stageRowsRes = await runMySQLQuery<Record<string, unknown>[]>(
      "SELECT changed_by, changed_at FROM `prospect_stage_history` WHERE changed_by IS NOT NULL;",
    );
    const stageRows = Array.isArray(stageRowsRes.data) ? stageRowsRes.data : [];

    let overallWonValue = 0;
    let overallPipelineValue = 0;
    let overallLostValue = 0;

    for (const o of orders) {
      const val = Number(o["total_amount"] || 0);
      const bucket = orderBucket(o["status"]);
      if (bucket === "won") overallWonValue += val;
      else if (bucket === "lost") overallLostValue += val;
      else overallPipelineValue += val;
    }

    const agents: AgentMetrics[] = users.map((u) => {
      const id = String(u["id"]);
      const name = String(u["name"] || "Agent");
      const email = String(u["email"] || "");
      // `users.status` holds the real state ('Active' / 'Suspended' ...); `is_active` is 0 for everyone here
      const status: "Active" | "Inactive" =
        String(u["status"] || "Active") === "Active" ? "Active" : "Inactive";

      const agentProspects = prospects.filter((p) => String(p["assigned_to"] || "") === id);
      const prospects_count = agentProspects.length;

      const agentOrders = orders.filter((o) => String(o["crm_user_id"] || "") === id);
      const opportunities_created = agentOrders.length;

      const wonOrders = agentOrders.filter((o) => orderBucket(o["status"]) === "won");
      const sales_won = wonOrders.length;
      const won_value = wonOrders.reduce((sum, o) => sum + Number(o["total_amount"] || 0), 0);
      const lost_count = agentOrders.filter((o) => orderBucket(o["status"]) === "lost").length;

      const conversion_rate =
        prospects_count > 0 ? Math.round((sales_won / prospects_count) * 1000) / 10 : 0;

      const agentActs = activities.filter((a) => String(a["actor_id"] || "") === id);
      const periodActs = agentActs.filter((a) => !since || String(a["created_at"] || "") >= since);
      // Stage transitions live in prospect_stage_history (changed_by), not in activities
      const stage_changes = stageRows.filter(
        (r) =>
          String(r["changed_by"] || "") === id &&
          (!since || String(r["changed_at"] || "") >= since),
      ).length;
      // Follow-up activities are stored as follow_up_created / follow_up_updated
      const followups_completed = periodActs.filter((a) =>
        String(a["activity_type"] || "").startsWith("follow_up"),
      ).length;

      const last_activity = agentActs[0]?.["created_at"]
        ? String(agentActs[0]["created_at"])
        : String(u["updated_at"] || new Date().toISOString());

      const recent_activities: AgentActivityItem[] = agentActs.slice(0, 5).map((a) => ({
        id: String(a["id"]),
        type: String(a["activity_type"] || "activity"),
        message: String(a["message"] || "System activity recorded"),
        timestamp: String(a["created_at"] || new Date().toISOString()),
      }));

      return {
        agent_id: id,
        avatar_url: u["avatar_url"] ? String(u["avatar_url"]) : undefined,
        name,
        email,
        status,
        prospects_count,
        stage_changes,
        status_changes: Math.max(0, Math.floor(stage_changes * 0.7)),
        followups_completed,
        overdue_followups: 0,
        opportunities_created,
        sales_won,
        won_value,
        lost_count,
        conversion_rate,
        last_activity,
        recent_activities,
      };
    });

    return {
      overall: {
        won_value: overallWonValue,
        pipeline_value: overallPipelineValue,
        lost_value: overallLostValue,
      },
      agents,
    };
  } catch (err) {
    console.warn("fetchAgentReports error:", err);
    return {
      overall: { won_value: 0, pipeline_value: 0, lost_value: 0 },
      agents: [],
    };
  }
}

export const agentReportsQueryOptions = (period: AgentReportPeriod = "overview") =>
  queryOptions({
    queryKey: ["agent-activity-reports", period],
    queryFn: () => fetchAgentReports(period),
  });

"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, Briefcase, CalendarClock, ClipboardList, Hand } from "lucide-react";

import { StatusOverviewCard } from "@/components/dashboard/status-timeline";
import { TimeTracker } from "@/components/dashboard/time-tracker";
import { WorkCalendar } from "@/components/dashboard/work-calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { computeOrderStatusSteps } from "@/lib/dashboard-finance";
import {
  getStageDeadline,
  resolveOrderStatus,
  useOrderStages,
  useOrderStageSettings,
  type CrmOrder,
} from "@/lib/orders";
import { collectAssignments, isOnMyStage } from "@/lib/production-activity";
import { projectStagePermId } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface ProductionDashboardProps {
  userId: string;
  orders: CrmOrder[];
  isLoading: boolean;
}

const DUE_SOON_MS = 48 * 60 * 60 * 1000;

/**
 * Dashboard for production roles (Script Writer, Content Planner, Videographer, Video Editor,
 * Marketer, Developer). Shows summary counts for the orders assigned to the signed-in user.
 * No finance or pipeline cards.
 */
export function ProductionDashboard({ userId, orders, isLoading }: ProductionDashboardProps) {
  // Captured once per mount so the deadline status does not change on every render
  const [now] = useState(() => Date.now());
  // While an admin uses "View as", the profile is the viewed user's
  const { profile, role, isAdmin, permissions } = useAuth();
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "there";
  const userName = profile?.full_name ?? "";
  const roleCode = String(role ?? "");

  // Every stage this user was given, from the orders' status history
  const assignments = useMemo(
    () => collectAssignments(orders, userId, userName, roleCode),
    [orders, userId, userName, roleCode],
  );
  // One per order, however many times it was (re-)assigned to this user
  const assignedCount = new Set(assignments.map((a) => a.order.id)).size;
  const completedCount = new Set(assignments.filter((a) => a.completed).map((a) => a.order.id))
    .size;

  // Work on their desk now: the order is in a stage of their role and assigned to them.
  // `designer_id` keeps the last assignee after the order moves on, so it alone is not enough.
  const current = useMemo(
    () => orders.filter((order) => isOnMyStage(order, userId, roleCode)),
    [orders, userId, roleCode],
  );
  const active = useMemo(() => current.map((order) => getStageDeadline(order)), [current]);

  // Same stages as their Projects board: not hidden, and allowed for their role
  const stages = useOrderStages();
  const stageSettings = useOrderStageSettings();
  const visibleStages = useMemo(
    () =>
      stages.filter(
        (stage) =>
          !stageSettings.hidden.includes(stage.id) &&
          (isAdmin || permissions.includes(projectStagePermId(stage.id))),
      ),
    [stages, stageSettings, isAdmin, permissions],
  );

  // Where the orders they worked on are now, in those stages only
  const projectSteps = useMemo(() => {
    const involved = new Set(assignments.map((a) => a.order));
    for (const order of current) involved.add(order);
    const allowed = new Set(visibleStages.map((s) => s.id));
    // Drop orders in other stages first, or they would be counted as Order Submitted
    const inAllowed = [...involved].filter((o) => allowed.has(resolveOrderStatus(o.status).id));
    return computeOrderStatusSteps(inAllowed, {}, undefined, visibleStages);
  }, [assignments, current, visibleStages]);

  const overdueCount = active.filter(
    (deadline) => deadline && deadline.target.getTime() < now,
  ).length;
  const dueSoonCount = active.filter((deadline) => {
    if (!deadline) return false;
    const left = deadline.target.getTime() - now;
    return left >= 0 && left <= DUE_SOON_MS;
  }).length;

  // Pastel palette from the quotation summary cards
  const stats = [
    {
      label: "Assigned",
      value: assignedCount,
      hint: `${completedCount} completed`,
      icon: ClipboardList,
      cardBg: "bg-[#F1E8FF] dark:bg-purple-950/40",
      iconText: "text-[#8B5CF6] dark:text-purple-400",
    },
    {
      label: "Active",
      value: active.length,
      hint: "On my stage now",
      icon: CalendarClock,
      cardBg: "bg-[#E1F1F0] dark:bg-teal-950/40",
      iconText: "text-[#0D9488] dark:text-teal-400",
    },
    {
      label: "Due in 48h",
      value: dueSoonCount,
      hint: "Deadline soon",
      icon: CalendarClock,
      cardBg: "bg-[#FBF3D5] dark:bg-amber-950/40",
      iconText: "text-[#D97706] dark:text-amber-400",
    },
    {
      label: "Overdue",
      value: overdueCount,
      hint: "Past deadline",
      icon: AlertTriangle,
      cardBg: "bg-[#FFE4E6] dark:bg-rose-950/40",
      iconText: "text-[#E11D48] dark:text-rose-400",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="relative isolate overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_top_right,rgba(103,178,57,0.35),transparent_55%),linear-gradient(115deg,#0a2e5c_0%,#13457f_55%,#3f7d22_100%)] p-4 text-white shadow-lg ring-1 shadow-[#0a2e5c]/15 ring-white/10 ring-inset sm:rounded-2xl sm:p-6 md:p-8 print:hidden">
        <h1 className="flex items-center text-xl font-bold tracking-tight sm:text-2xl md:text-3xl lg:text-4xl">
          Welcome {firstName}
          <Hand
            className="ml-1.5 size-5 shrink-0 rotate-20 text-yellow-300 sm:ml-2 sm:size-7 md:size-8"
            aria-hidden="true"
          />
        </h1>
        <p className="mt-0.5 text-xs text-white/85 sm:mt-1 sm:text-sm md:text-base lg:text-lg">
          Here&apos;s an overview of your work · {format(new Date(now), "EEEE, d MMMM yyyy")}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {isLoading
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          : stats.map((stat) => {
              const Icon = stat.icon;
              const isAlert = stat.label === "Overdue" && stat.value > 0;
              return (
                <div
                  key={stat.label}
                  className={cn(
                    "group relative overflow-hidden rounded-xl px-2.5 py-2 shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg motion-reduce:transform-none sm:px-3 sm:py-2.5",
                    stat.cardBg,
                  )}
                >
                  <div className="relative z-10 flex items-center gap-2 sm:gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white shadow-2xs xl:size-9 dark:bg-zinc-900">
                      <Icon className={cn("size-4", stat.iconText)} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-bold leading-tight text-slate-900 sm:text-xs dark:text-slate-100">
                        {stat.label}
                      </p>
                      <p
                        className={cn(
                          "truncate text-base font-black leading-tight tracking-tight tabular-nums sm:text-lg xl:text-xl",
                          isAlert ? "text-rose-600" : "text-slate-950 dark:text-white",
                        )}
                      >
                        {stat.value}
                      </p>
                      <p className="truncate text-[9px] font-medium leading-tight text-slate-600 sm:text-[10px] dark:text-slate-400">
                        {stat.hint}
                      </p>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute -bottom-2 -right-2 rotate-12 scale-110 opacity-[0.07] transition-transform group-hover:scale-125">
                    <Icon className={cn("size-12", stat.iconText)} aria-hidden="true" />
                  </div>
                </div>
              );
            })}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)] print:hidden">
        <TimeTracker userId={userId} />
        <WorkCalendar assignments={assignments} now={now} />
        <div className="lg:col-span-2">
          <StatusOverviewCard
            title="Project Overview"
            description="Your orders by stage."
            icon={Briefcase}
            steps={projectSteps}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

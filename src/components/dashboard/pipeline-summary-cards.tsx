"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Users2, UserPlus, UserCheck, Repeat, Calendar, Trophy, PhoneMissed } from "lucide-react";
import { prospectsStatsQuery } from "@/lib/prospects";
import type { DashboardDateRange } from "@/lib/dashboard";

interface PipelineStatCardProps {
  label: string;
  value: number | string;
  hint?: string | undefined;
  icon: LucideIcon;
  colorScheme:
    | "pastelPurple"
    | "pastelTeal"
    | "pastelEmerald"
    | "pastelPeach"
    | "pastelYellow"
    | "pastelBlue"
    | "pastelIndigo"
    | "pastelRose";
  href: string;
}

function PipelineStatCard({
  label,
  value,
  hint,
  icon: Icon,
  colorScheme,
  href,
}: PipelineStatCardProps) {
  const styles = {
    pastelPurple: {
      cardBg: "bg-[#F1E8FF] dark:bg-purple-950/40",
      iconText: "text-[#8B5CF6] dark:text-purple-400",
    },
    pastelTeal: {
      cardBg: "bg-[#E1F1F0] dark:bg-teal-950/40",
      iconText: "text-[#0D9488] dark:text-teal-400",
    },
    pastelEmerald: {
      cardBg: "bg-[#E3F2E1] dark:bg-emerald-950/40",
      iconText: "text-[#059669] dark:text-emerald-400",
    },
    pastelPeach: {
      cardBg: "bg-[#FCE8E2] dark:bg-rose-950/40",
      iconText: "text-[#EA580C] dark:text-orange-400",
    },
    pastelYellow: {
      cardBg: "bg-[#FBF3D5] dark:bg-amber-950/40",
      iconText: "text-[#D97706] dark:text-amber-400",
    },
    pastelBlue: {
      cardBg: "bg-[#E0F2FE] dark:bg-sky-950/40",
      iconText: "text-[#0284C7] dark:text-sky-400",
    },
    pastelIndigo: {
      cardBg: "bg-[#E0E7FF] dark:bg-indigo-950/40",
      iconText: "text-[#4F46E5] dark:text-indigo-400",
    },
    pastelRose: {
      cardBg: "bg-[#FFE4E6] dark:bg-rose-950/40",
      iconText: "text-[#E11D48] dark:text-rose-400",
    },
  }[colorScheme];

  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-2xl p-3 sm:p-3.5 xl:p-4 shadow-md hover:shadow-lg transition-all duration-200 select-none cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${styles.cardBg}`}
    >
      <div className="relative z-10 flex items-center gap-2.5 sm:gap-3 xl:gap-3.5">
        <div className="size-9 sm:size-10 xl:size-11 rounded-full bg-white dark:bg-card shadow-2xs flex items-center justify-center shrink-0">
          <Icon className={`size-4.5 sm:size-5 xl:size-5.5 ${styles.iconText}`} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate">
            {label}
          </p>
          <p className="text-lg sm:text-xl xl:text-2xl font-black text-slate-950 dark:text-white leading-tight mt-0.5 tracking-tight truncate">
            {value}
          </p>
          {hint && (
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate mt-0.5">
              {hint}
            </p>
          )}
        </div>
      </div>

      <div className="absolute -right-3 -bottom-3 opacity-[0.07] pointer-events-none transform rotate-12 scale-125 transition-transform group-hover:scale-135">
        <Icon className={`size-16 ${styles.iconText}`} />
      </div>
    </Link>
  );
}

export function PipelineSummaryCards({
  userId,
  isAdmin,
  filterUserId,
  range,
}: {
  userId: string;
  isAdmin: boolean;
  filterUserId?: string | undefined;
  range?: DashboardDateRange | undefined;
}) {
  const stats = useQuery({
    ...prospectsStatsQuery(userId, isAdmin, filterUserId, range),
    enabled: Boolean(userId),
  });

  return (
    <div className="grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
      <PipelineStatCard
        label="All"
        value={stats.data?.totalProspects ?? 0}
        hint="All pipeline leads"
        icon={Users2}
        colorScheme="pastelPurple"
        href="/prospects"
      />
      <PipelineStatCard
        label="Prospect"
        value={stats.data?.prospectCount ?? 0}
        hint="New leads"
        icon={UserPlus}
        colorScheme="pastelBlue"
        href="/prospects?stage=prospect"
      />
      <PipelineStatCard
        label="Qualified"
        value={stats.data?.qualifiedLeads ?? 0}
        hint="Ready for sales"
        icon={UserCheck}
        colorScheme="pastelTeal"
        href="/prospects?stage=opportunity-created"
      />
      <PipelineStatCard
        label="Follow-Up"
        value={stats.data?.followUps ?? 0}
        hint="Active outreach"
        icon={Repeat}
        colorScheme="pastelYellow"
        href="/prospects?stage=follow-up"
      />
      <PipelineStatCard
        label="Meeting"
        value={stats.data?.meetingCount ?? 0}
        hint="Scheduled calls"
        icon={Calendar}
        colorScheme="pastelIndigo"
        href="/prospects?stage=meeting-scheduled"
      />
      <PipelineStatCard
        label="Won"
        value={stats.data?.salesWon ?? 0}
        hint={stats.data?.successRate ? `Rate: ${stats.data.successRate}` : "Rate: 0.0%"}
        icon={Trophy}
        colorScheme="pastelEmerald"
        href="/prospects?stage=sales-won"
      />
      <PipelineStatCard
        label="Lost/DNP"
        value={stats.data?.lostDnpCount ?? 0}
        hint="Unreached / Lost"
        icon={PhoneMissed}
        colorScheme="pastelPeach"
        href="/prospects?stage=dnp"
      />
    </div>
  );
}

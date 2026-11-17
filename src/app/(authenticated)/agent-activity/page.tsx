"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Activity,
  Building2,
  CalendarClock,
  CalendarDays,
  FileSpreadsheet,
  Layers,
  type LucideIcon,
  MessageSquare,
  Phone,
  PhoneCall,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  SearchX,
  ShoppingCart,
  Target,
  User,
  Users,
  Users2,
  Wallet,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { ActivityLogMetadataModal } from "@/components/activity-log-metadata-modal";
import {
  DateRangePicker3,
  getDateRangeForPredefined,
} from "@/components/dashboard/date-range-picker3";
import { getInitials } from "@/components/orders/assign-stage-dialog";
import { activityLogsQueryOptions, type ActivityLog } from "@/lib/activity-logs";
import { agentOptionsQueryOptions } from "@/lib/won-sales";
import { cn } from "@/lib/utils";

type CategoryKey =
  | "stage"
  | "followup"
  | "meeting"
  | "order"
  | "quotation"
  | "payment"
  | "expense"
  | "sms"
  | "prospect"
  | "invoice"
  | "other";

/** One visual identity per category; the icon and label carry the meaning, colour only helps. */
const CATEGORIES: Record<CategoryKey, { label: string; icon: LucideIcon; tone: string }> = {
  stage: {
    label: "Stage changes",
    icon: Layers,
    tone: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
  },
  followup: {
    label: "Follow-ups",
    icon: PhoneCall,
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
  meeting: {
    label: "Meetings",
    icon: CalendarClock,
    tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
  },
  order: {
    label: "Orders",
    icon: ShoppingCart,
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
  },
  quotation: {
    label: "Quotations",
    icon: FileSpreadsheet,
    tone: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300",
  },
  payment: {
    label: "Payments",
    icon: Wallet,
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  expense: {
    label: "Expenses",
    icon: Receipt,
    tone: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  },
  sms: {
    label: "SMS",
    icon: MessageSquare,
    tone: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
  },
  prospect: {
    label: "Prospects",
    icon: Users2,
    tone: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  },
  invoice: {
    label: "Invoices",
    icon: Target,
    tone: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
  },
  other: {
    label: "Other",
    icon: Activity,
    tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

const categoryOf = (entityType: string): CategoryKey => {
  const type = entityType.toLowerCase();
  if (type === "billing") return "invoice";
  return type in CATEGORIES ? (type as CategoryKey) : "other";
};

const PAGE_SIZE = 50;

const dayLabel = (date: Date) =>
  isToday(date) ? "Today" : isYesterday(date) ? "Yesterday" : format(date, "EEEE, d MMM yyyy");

const parseLogDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export default function AgentActivityPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryKey | "all">("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [inspectLog, setInspectLog] = useState<ActivityLog | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() =>
    getDateRangeForPredefined("thisMonth"),
  );
  const rangeFilter = {
    from: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
    to: dateRange?.to
      ? format(dateRange.to, "yyyy-MM-dd")
      : dateRange?.from
        ? format(dateRange.from, "yyyy-MM-dd")
        : undefined,
  };

  const {
    data: logs = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery(activityLogsQueryOptions(rangeFilter));
  const { data: agents = [] } = useQuery(agentOptionsQueryOptions());

  // Agent + search narrow the feed first; category counts are taken from that set
  const scopedLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    const agentName = agents.find((a) => a.id === agentFilter)?.name.toLowerCase();
    return logs.filter((log) => {
      if (
        agentFilter !== "all" &&
        log.user_id !== agentFilter &&
        log.user_name.toLowerCase() !== agentName
      ) {
        return false;
      }
      if (!term) return true;
      return (
        log.action.toLowerCase().includes(term) ||
        log.user_name.toLowerCase().includes(term) ||
        JSON.stringify(log.metadata_json).toLowerCase().includes(term)
      );
    });
  }, [logs, agents, agentFilter, search]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<CategoryKey, number>();
    scopedLogs.forEach((log) => {
      const key = categoryOf(log.entity_type);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [scopedLogs]);

  const filteredLogs = useMemo(
    () =>
      category === "all"
        ? scopedLogs
        : scopedLogs.filter((log) => categoryOf(log.entity_type) === category),
    [scopedLogs, category],
  );

  const dayGroups = useMemo(() => {
    const groups: { key: string; label: string; logs: ActivityLog[] }[] = [];
    for (const log of filteredLogs.slice(0, visibleCount)) {
      const date = parseLogDate(log.created_at);
      const key = date ? format(date, "yyyy-MM-dd") : "unknown";
      const last = groups.at(-1);
      if (last?.key === key) last.logs.push(log);
      else groups.push({ key, label: date ? dayLabel(date) : "Unknown date", logs: [log] });
    }
    return groups;
  }, [filteredLogs, visibleCount]);

  const topAgents = useMemo(() => {
    const byAgent = new Map<
      string,
      { id: string | null; name: string; avatar: string | null; count: number }
    >();
    logs.forEach((log) => {
      const key = log.user_id || log.user_name;
      const entry = byAgent.get(key) || {
        id: log.user_id,
        name: log.user_name,
        avatar: log.user_avatar || null,
        count: 0,
      };
      entry.count += 1;
      byAgent.set(key, entry);
    });
    return [...byAgent.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [logs]);

  const countOf = (keys: CategoryKey[]) =>
    logs.filter((log) => keys.includes(categoryOf(log.entity_type))).length;
  const activeAgents = new Set(logs.map((log) => log.user_id || log.user_name)).size;
  const hasFilters = Boolean(search) || category !== "all" || agentFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setAgentFilter("all");
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Activity className="size-6 text-[#67B239]" aria-hidden />
            Agent Activity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Who did what, and when, across prospects, follow-ups, orders, payments and SMS.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker3
            initialRange={dateRange}
            onDateRangeChange={(range) => {
              setDateRange(range);
              setVisibleCount(PAGE_SIZE);
            }}
            align="end"
            compactOnMobile
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="Refresh activity"
            title="Refresh activity"
            className="size-10 rounded-xl cursor-pointer"
          >
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total events"
          value={String(logs.length)}
          icon={Activity}
          loading={isLoading}
          colorScheme="pastelPurple"
        />
        <StatCard
          label="Active agents"
          value={String(activeAgents)}
          icon={Users}
          loading={isLoading}
          colorScheme="pastelTeal"
        />
        <StatCard
          label="Stages & follow-ups"
          value={String(countOf(["stage", "followup", "meeting", "prospect"]))}
          icon={Layers}
          loading={isLoading}
          colorScheme="pastelYellow"
        />
        <StatCard
          label="Orders & money"
          value={String(countOf(["order", "quotation", "payment", "expense", "invoice"]))}
          icon={Wallet}
          loading={isLoading}
          colorScheme="pastelEmerald"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-4">
          <Card className="gap-0 space-y-3 rounded-2xl border-slate-200/80 bg-white p-4 shadow-xs dark:bg-card">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  aria-label="Search activity"
                  placeholder="Search action, prospect, phone, note..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className="h-10 rounded-xl pl-9"
                />
              </div>
              <Select
                value={agentFilter}
                onValueChange={(value) => {
                  setAgentFilter(value);
                  setVisibleCount(PAGE_SIZE);
                }}
              >
                <SelectTrigger
                  aria-label="Filter by agent"
                  className="h-10 w-full rounded-xl sm:w-56"
                >
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <span className="flex items-center gap-2">
                        <ActorAvatar name={agent.name} src={agent.avatar_url} />
                        <span className="truncate">{agent.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button
                  variant="ghost"
                  onClick={resetFilters}
                  className="h-10 gap-1.5 rounded-xl text-sm cursor-pointer"
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Reset
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
              <CategoryChip
                label="All"
                count={scopedLogs.length}
                isActive={category === "all"}
                onClick={() => setCategory("all")}
              />
              {(Object.keys(CATEGORIES) as CategoryKey[])
                .filter((key) => categoryCounts.get(key))
                .map((key) => (
                  <CategoryChip
                    key={key}
                    label={CATEGORIES[key].label}
                    icon={CATEGORIES[key].icon}
                    count={categoryCounts.get(key) || 0}
                    isActive={category === key}
                    onClick={() => {
                      setCategory(key);
                      setVisibleCount(PAGE_SIZE);
                    }}
                  />
                ))}
            </div>
          </Card>

          <Card className="gap-0 rounded-2xl border-slate-200/80 bg-white p-0 shadow-xs dark:bg-card">
            {isLoading ? (
              <div className="space-y-4 p-5" aria-busy="true">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="flex gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <EmptyState
                title="Activity could not be loaded"
                text="Check your connection, then try again."
                action={
                  <Button
                    onClick={() => void refetch()}
                    className="bg-[#67B239] text-white hover:bg-[#5aa030] cursor-pointer"
                  >
                    Try again
                  </Button>
                }
              />
            ) : filteredLogs.length === 0 ? (
              <EmptyState
                title={
                  hasFilters ? "No activity matches these filters" : "No activity in this period"
                }
                text={
                  hasFilters
                    ? "Clear the filters or pick another category or agent."
                    : "Choose a wider date range to see older activity."
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" onClick={resetFilters} className="cursor-pointer">
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            ) : (
              <div>
                {dayGroups.map((group) => (
                  <section key={group.key} aria-label={group.label}>
                    <h2 className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-slate-50/95 px-5 py-2 text-xs font-semibold text-slate-600 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" aria-hidden />
                        {group.label}
                      </span>
                      <span className="font-normal text-muted-foreground">
                        {group.logs.length} {group.logs.length === 1 ? "event" : "events"}
                      </span>
                    </h2>
                    <ol className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {group.logs.map((log) => (
                        <ActivityRow
                          key={log.id}
                          log={log}
                          avatar={log.user_avatar || null}
                          onInspect={() => setInspectLog(log)}
                        />
                      ))}
                    </ol>
                  </section>
                ))}
                {visibleCount < filteredLogs.length && (
                  <div className="border-t border-slate-100 p-3 text-center dark:border-slate-800">
                    <Button
                      variant="ghost"
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="text-sm cursor-pointer"
                    >
                      Show more ({filteredLogs.length - visibleCount} left)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <aside
          className="space-y-4 lg:sticky lg:top-4 lg:self-start"
          aria-label="Most active agents"
        >
          <Card className="gap-0 rounded-2xl border-slate-200/80 bg-white p-4 shadow-xs dark:bg-card">
            <h2 className="text-sm font-semibold text-[#0a2e5c] dark:text-slate-100">
              Most active agents
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Click an agent to see only their activity.
            </p>
            <div className="mt-3 space-y-1">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-10 w-full rounded-lg" />
                ))
              ) : topAgents.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No activity yet.</p>
              ) : (
                topAgents.map((agent) => {
                  const isActive = agent.id !== null && agentFilter === agent.id;
                  const share = Math.round((agent.count / (topAgents[0]?.count || 1)) * 100);
                  return (
                    <button
                      key={agent.id || agent.name}
                      type="button"
                      disabled={!agent.id}
                      aria-pressed={isActive}
                      onClick={() => {
                        if (!agent.id) return;
                        setAgentFilter(isActive ? "all" : agent.id);
                        setVisibleCount(PAGE_SIZE);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B239]/50",
                        agent.id
                          ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                          : "",
                        isActive && "bg-[#67B239]/10 hover:bg-[#67B239]/15",
                      )}
                    >
                      <ActorAvatar name={agent.name} src={agent.avatar} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 text-xs font-medium text-foreground">
                          <span className="truncate">{agent.name}</span>
                          <span className="tabular-nums text-muted-foreground">{agent.count}</span>
                        </span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <span
                            className="block h-full rounded-full bg-[#67B239]"
                            style={{ width: `${share}%` }}
                          />
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </aside>
      </div>

      <ActivityLogMetadataModal
        open={Boolean(inspectLog)}
        onOpenChange={(open) => !open && setInspectLog(null)}
        log={inspectLog}
      />
    </div>
  );
}

function ActorAvatar({
  name,
  src,
  size = "sm",
}: {
  name: string;
  src?: string | null | undefined;
  size?: "sm" | "md";
}) {
  return (
    <Avatar className={size === "md" ? "size-8" : "size-6"}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="bg-[#0a2e5c] text-[10px] font-semibold text-white">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function CategoryChip({
  label,
  icon: Icon,
  count,
  isActive,
  onClick,
}: {
  label: string;
  icon?: LucideIcon;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B239]/50",
        isActive
          ? "border-[#67B239] bg-[#67B239] text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-[#67B239]/60 dark:border-slate-700 dark:bg-transparent dark:text-slate-300",
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 tabular-nums",
          isActive
            ? "bg-white/25"
            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ActivityRow({
  log,
  avatar,
  onInspect,
}: {
  log: ActivityLog;
  avatar: string | null;
  onInspect: () => void;
}) {
  const meta = CATEGORIES[categoryOf(log.entity_type)];
  const Icon = meta.icon;
  const date = parseLogDate(log.created_at);
  const prospectName = log.metadata_json["prospect_name"] as string | undefined;
  const businessName = log.metadata_json["business_name"] as string | undefined;
  const phone = log.metadata_json["phone"] as string | undefined;

  return (
    <li className="group flex gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
          meta.tone,
        )}
        title={meta.label}
      >
        <Icon className="size-4" aria-hidden />
        <span className="sr-only">{meta.label}</span>
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-foreground wrap-anywhere">{log.action}</p>
        {(prospectName || businessName || phone) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {prospectName && (
              <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                <User className="size-3" aria-hidden />
                {prospectName}
              </span>
            )}
            {businessName && businessName !== prospectName && (
              <span className="flex items-center gap-1">
                <Building2 className="size-3" aria-hidden />
                {businessName}
              </span>
            )}
            {phone && (
              <span className="flex items-center gap-1 tabular-nums">
                <Phone className="size-3" aria-hidden />
                {phone}
              </span>
            )}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <ActorAvatar name={log.user_name} src={avatar} />
          <span className="truncate font-medium text-slate-700 dark:text-slate-300">
            {log.user_name}
          </span>
          {date && (
            <>
              <span aria-hidden>·</span>
              <time dateTime={date.toISOString()} className="tabular-nums">
                {format(date, "h:mm a")}
              </time>
            </>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onInspect}
        aria-label={`Details: ${log.action}`}
        className="h-8 shrink-0 self-start rounded-lg px-2.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground"
      >
        Details
      </Button>
    </li>
  );
}

function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <SearchX className="size-6 text-slate-500" aria-hidden />
      </span>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

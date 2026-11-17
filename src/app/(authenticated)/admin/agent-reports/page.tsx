"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Eye,
  Search,
  TrendingUp,
  Trophy,
  Users,
  X,
  XCircle,
} from "lucide-react";

import { StatCard } from "@/components/stat-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  agentReportsQueryOptions,
  type AgentMetrics,
  type AgentReportPeriod,
} from "@/lib/agent-reports";
import { formatCrmDateTime } from "@/lib/mysql-client";
import { cn } from "@/lib/utils";

const PERIOD_LABELS: Record<AgentReportPeriod, string> = {
  overview: "All time",
  weekly: "Last 7 days",
  monthly: "Last 30 days",
};

// Podium colours: rank 1 brand green, rank 2 brand navy, rank 3 neutral
const PODIUM = [
  { badge: "bg-[#67B239] text-white", ring: "ring-[#67B239]/30" },
  { badge: "bg-[#0a2e5c] text-white", ring: "ring-[#0a2e5c]/20" },
  { badge: "bg-slate-300 text-slate-900", ring: "ring-slate-300/60" },
];

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "AG";

const formatCurrency = (amount: number) =>
  `৳${Number(amount || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

// Highest won value first; ties go to more won deals, then conversion, then follow-ups
const compareByWon = (a: AgentMetrics, b: AgentMetrics) =>
  b.won_value - a.won_value ||
  b.sales_won - a.sales_won ||
  b.conversion_rate - a.conversion_rate ||
  b.followups_completed - a.followups_completed;

export default function AdminAgentReportsPage() {
  const [period, setPeriod] = useState<AgentReportPeriod>("overview");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery(agentReportsQueryOptions(period));
  const overall = data?.overall;
  const agents = useMemo(() => data?.agents ?? [], [data]);

  const ranked = useMemo(() => [...agents].sort(compareByWon), [agents]);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      query
        ? ranked.filter(
            (agent) =>
              agent.name.toLowerCase().includes(query) || agent.email.toLowerCase().includes(query),
          )
        : ranked,
    [ranked, query],
  );

  const activeCount = agents.filter((agent) => agent.status === "Active").length;
  const podium = ranked.slice(0, 3);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#67B239]">
            Admin · Reports
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a2e5c] dark:text-white">
            Agent Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Won value, pipeline, conversion and follow-ups for every agent.
          </p>
        </div>

        <Tabs value={period} onValueChange={(value) => setPeriod(value as AgentReportPeriod)}>
          <TabsList className="grid w-full grid-cols-3 lg:w-96">
            {(Object.keys(PERIOD_LABELS) as AgentReportPeriod[]).map((key) => (
              <TabsTrigger key={key} value={key} className="cursor-pointer text-xs">
                {PERIOD_LABELS[key]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Won value"
          value={formatCurrency(overall?.won_value ?? 0)}
          hint="All time"
          icon={Trophy}
          colorScheme="pastelEmerald"
          loading={isLoading}
        />
        <StatCard
          label="Pipeline value"
          value={formatCurrency(overall?.pipeline_value ?? 0)}
          hint="Open orders, all time"
          icon={TrendingUp}
          colorScheme="pastelTeal"
          loading={isLoading}
        />
        <StatCard
          label="Lost value"
          value={formatCurrency(overall?.lost_value ?? 0)}
          hint="All time"
          icon={XCircle}
          colorScheme="pastelPeach"
          loading={isLoading}
        />
        <StatCard
          label="Active agents"
          value={activeCount}
          hint={`${agents.length} in total`}
          icon={Users}
          colorScheme="pastelPurple"
          loading={isLoading}
        />
      </div>

      {!isLoading && podium.length > 0 && (
        <section aria-label="Top agents" className="grid gap-3 md:grid-cols-3">
          {podium.map((agent, index) => (
            <div
              key={agent.agent_id}
              className={cn(
                "flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm",
                index === 0 && "border-[#67B239]/50",
              )}
            >
              <div className="relative shrink-0">
                <Avatar className={cn("size-14 ring-4", PODIUM[index]?.ring)}>
                  {agent.avatar_url && <AvatarImage src={agent.avatar_url} alt={agent.name} />}
                  <AvatarFallback className="bg-[#0a2e5c]/10 text-sm font-semibold text-[#0a2e5c] dark:text-white">
                    {getInitials(agent.name)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full text-xs font-bold ring-2 ring-card",
                    PODIUM[index]?.badge,
                  )}
                >
                  {index + 1}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{agent.name}</p>
                <p className="text-lg font-bold tabular-nums text-[#67B239]">
                  {formatCurrency(agent.won_value)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {agent.sales_won} won · {agent.conversion_rate}% conversion ·{" "}
                  {agent.followups_completed} follow-ups
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      <Card className="overflow-hidden rounded-xl border shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-[#0a2e5c] dark:text-white">
                Leaderboard{" "}
                <span className="font-normal text-muted-foreground">({visible.length})</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Ranked by won value. Ties are broken by won deals, then conversion.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search agent or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white pl-9 pr-8 dark:bg-slate-900"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 pl-6 font-semibold">Rank</TableHead>
                  <TableHead className="min-w-52 font-semibold">Agent</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Prospects</TableHead>
                  <TableHead className="text-right font-semibold">Won</TableHead>
                  <TableHead className="text-right font-semibold">Lost</TableHead>
                  <TableHead className="min-w-36 font-semibold">Conversion</TableHead>
                  <TableHead className="min-w-28 text-right font-semibold">Follow-ups</TableHead>
                  <TableHead className="min-w-36 font-semibold">Last activity</TableHead>
                  <TableHead className="pr-6 text-right font-semibold">
                    <span className="sr-only">Details</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell colSpan={10} className="px-6 py-4">
                        <Skeleton className="h-12 w-full rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                      <Users className="mx-auto mb-2 size-8 text-slate-300" />
                      <p className="font-semibold text-foreground">No agents found</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Try a different name or email.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((agent) => {
                    const rank = ranked.indexOf(agent);
                    return (
                      <TableRow
                        key={agent.agent_id}
                        className="transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="pl-6">
                          <span
                            className={cn(
                              "inline-flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                              PODIUM[rank]?.badge ?? "bg-muted text-muted-foreground",
                            )}
                          >
                            {rank + 1}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar className="size-9 border border-border/70">
                              {agent.avatar_url && (
                                <AvatarImage src={agent.avatar_url} alt={agent.name} />
                              )}
                              <AvatarFallback className="bg-[#0a2e5c]/10 text-xs font-semibold text-[#0a2e5c] dark:text-white">
                                {getInitials(agent.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {agent.name}
                              </p>
                              <p className="truncate font-mono text-xs text-muted-foreground">
                                {agent.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {agent.status === "Active" ? (
                            <Badge
                              variant="outline"
                              className="gap-1 rounded-full border-[#67B239]/40 bg-[#67B239]/15 px-2.5 py-0.5 text-xs font-semibold text-[#3f7a1e] dark:text-[#9bd16f]"
                            >
                              <CheckCircle2 className="size-3" /> Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1 rounded-full border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400"
                            >
                              <XCircle className="size-3" /> Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {agent.prospects_count}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {agent.sales_won}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold tabular-nums text-destructive">
                          {agent.lost_count}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-[#67B239]"
                                style={{ width: `${Math.min(100, agent.conversion_rate)}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                              {agent.conversion_rate}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-sm">
                          <span className="font-mono tabular-nums">
                            {agent.followups_completed}
                          </span>
                          {agent.overdue_followups > 0 && (
                            <span className="ml-1.5 text-xs text-destructive">
                              ({agent.overdue_followups} overdue)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {agent.last_activity ? (
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3 text-slate-400" />
                              {formatCrmDateTime(agent.last_activity)}
                            </span>
                          ) : (
                            "No activity"
                          )}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <span
                            aria-hidden="true"
                            className="inline-flex size-8 items-center justify-center rounded-full text-slate-500"
                          >
                            <Eye className="size-4" />
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

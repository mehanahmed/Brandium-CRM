"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, endOfWeek, format, getYear, startOfWeek } from "date-fns";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildWorkCalendar,
  type StageAssignment,
  type WorkDay,
  type WorkDayStatus,
} from "@/lib/production-activity";
import { cn } from "@/lib/utils";

type CellStatus = WorkDayStatus | "none";

const STATUS: Record<CellStatus, { label: string; className: string }> = {
  none: {
    label: "No activity",
    className: "bg-transparent border-slate-200/70 dark:border-zinc-800",
  },
  gap: {
    label: "In progress",
    className: "bg-slate-50 border-slate-200/60 dark:bg-zinc-900/40 dark:border-zinc-800",
  },
  assigned: {
    label: "Assigned",
    className: "bg-slate-100 border-slate-300/70 dark:bg-zinc-800 dark:border-zinc-700",
  },
  missed: {
    label: "Missed deadline",
    className: "bg-red-100 border-red-200 dark:bg-red-950 dark:border-red-900",
  },
  late: {
    label: "Commitment break",
    className: "bg-yellow-100 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-900",
  },
  onTime: { label: "On time", className: "bg-[#67B239] border-[#5aa030]" },
};

const LEGEND: CellStatus[] = ["none", "gap", "assigned", "missed", "late", "onTime"];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

const describe = (date: Date, day: WorkDay | undefined) =>
  `${format(date, "d MMM yyyy")}: ${STATUS[day?.status ?? "none"].label}, ${day?.assigned ?? 0} assigned, ${day?.completed ?? 0} completed`;

interface WorkCalendarProps {
  assignments: StageAssignment[];
  now: number;
}

/** One square per day of the year: assignments, hand-offs and deadline results for this user. */
export function WorkCalendar({ assignments, now }: WorkCalendarProps) {
  const thisYear = getYear(new Date(now));
  const [year, setYear] = useState(thisYear);
  const [selected, setSelected] = useState<Date | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => buildWorkCalendar(assignments, now), [assignments, now]);

  const years = useMemo(() => {
    const set = new Set<number>([thisYear]);
    for (const key of days.keys()) set.add(Number(key.slice(0, 4)));
    return [...set].sort((a, b) => b - a);
  }, [days, thisYear]);

  const columns = useMemo(() => {
    const first = startOfWeek(new Date(year, 0, 1));
    const last = endOfWeek(new Date(year, 11, 31));
    const weeks: Date[][] = [];
    for (let day = first; day <= last; day = addDays(day, 7)) {
      weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)));
    }
    return weeks;
  }, [year]);

  const totals = useMemo(() => {
    // One per order in the year, however many times it was (re-)assigned
    const assigned = new Set<string>();
    const completed = new Set<string>();
    for (const a of assignments) {
      if (a.start.getFullYear() === year) assigned.add(a.order.id);
      if (a.completed && a.end?.getFullYear() === year) completed.add(a.order.id);
    }
    let active = 0;
    for (const [key, day] of days) {
      if (key.startsWith(String(year)) && day.assigned + day.completed > 0) active += 1;
    }
    return { assigned: assigned.size, completed: completed.size, active };
  }, [assignments, days, year]);

  // Current year: show today's side of the grid first on narrow screens
  useEffect(() => {
    const el = scrollRef.current;
    if (el && year === thisYear) el.scrollLeft = el.scrollWidth;
  }, [year, thisYear]);

  const selectedDay = selected ? days.get(format(selected, "yyyy-MM-dd")) : undefined;

  return (
    <section
      aria-labelledby="work-calendar-heading"
      className="min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-lg ring-1 ring-inset ring-slate-200/60 sm:p-6 dark:bg-zinc-900 dark:ring-zinc-800"
    >
      <h2 id="work-calendar-heading" className="sr-only">
        Work calendar
      </h2>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-zinc-100">
          <span className="size-2.5 rounded-sm bg-slate-300" aria-hidden="true" />
          <span className="tabular-nums">{totals.assigned}</span> assigned
        </p>
        <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-zinc-100">
          <span className="size-2.5 rounded-sm bg-[#67B239]" aria-hidden="true" />
          <span className="tabular-nums">{totals.completed}</span> completed
        </p>
        <span className="text-xs text-slate-500 dark:text-zinc-400">
          {totals.active} active {totals.active === 1 ? "day" : "days"}
        </span>
        <div className="ml-auto">
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger aria-label="Activity year" className="h-9 w-28 rounded-lg text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto rounded-xl border border-slate-200/60 p-4 dark:border-zinc-800"
      >
        <div className="flex w-max gap-2 pb-1">
          <div className="flex shrink-0 flex-col gap-1 pt-6 text-[10px] text-slate-500 dark:text-zinc-400">
            {DAY_LABELS.map((label, index) => (
              <span key={index} className="flex h-4.5 items-center">
                {label}
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            {columns.map((week, col) => {
              const monthStart = week.find((d) => d.getDate() === 1 && d.getFullYear() === year);
              return (
                <div key={col} className="relative flex flex-col gap-1 pt-6">
                  {(monthStart || col === 0) && (
                    <span className="absolute top-0 left-0 text-[10px] whitespace-nowrap text-slate-500 dark:text-zinc-400">
                      {format(monthStart ?? new Date(year, 0, 1), "MMM")}
                    </span>
                  )}
                  {week.map((date) => {
                    if (date.getFullYear() !== year) {
                      return <span key={date.toISOString()} className="size-4.5" />;
                    }
                    const day = days.get(format(date, "yyyy-MM-dd"));
                    const status = day?.status ?? "none";
                    const label = describe(date, day);
                    return (
                      <button
                        key={date.toISOString()}
                        type="button"
                        aria-label={label}
                        title={label}
                        onClick={() => setSelected(date)}
                        onFocus={() => setSelected(date)}
                        className={cn(
                          "size-4.5 rounded-[4px] border transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0a2e5c] motion-reduce:transform-none",
                          STATUS[status].className,
                          date.getTime() > now && "opacity-35",
                        )}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p aria-live="polite" className="mt-3 min-h-4 text-xs text-slate-600 dark:text-zinc-300">
        {selected ? describe(selected, selectedDay) : null}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-zinc-400">
        <span>One square per day. Deadline issues take priority on mixed days.</span>
        <ul
          aria-label="Activity status legend"
          className="flex flex-wrap items-center gap-x-3 gap-y-2"
        >
          {LEGEND.map((key) => (
            <li key={key} className="flex items-center gap-1.5">
              <span
                className={cn("size-3 rounded-[3px] border", STATUS[key].className)}
                aria-hidden="true"
              />
              {STATUS[key].label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

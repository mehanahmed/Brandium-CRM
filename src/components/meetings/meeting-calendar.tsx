"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Clock3, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Meeting, MeetingStatus } from "@/lib/meetings";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS = 2;

const STATUS_DOT: Record<MeetingStatus, string> = {
  Scheduled: "bg-amber-500",
  Completed: "bg-emerald-500",
  Cancelled: "bg-rose-500",
};

const initialsOf = (name?: string) =>
  name
    ? name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "?"
    : "?";

const dayKey = (value: string) => value.slice(0, 10);

/** Month grid of meetings; each meeting shows the assigned user's avatar (joined by user id). */
export function MeetingCalendarView({
  meetings,
  onSelectMeeting,
}: {
  meetings: Meeting[];
  onSelectMeeting: (meeting: Meeting) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(() => new Date());

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month)),
        end: endOfWeek(endOfMonth(month)),
      }),
    [month],
  );

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const meeting of meetings) {
      const key = dayKey(meeting.meeting_date);
      map.set(key, [...(map.get(key) ?? []), meeting]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.meeting_time.localeCompare(b.meeting_time));
    }
    return map;
  }, [meetings]);

  const selectedMeetings = meetingsByDay.get(format(selected, "yyyy-MM-dd")) ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section
        aria-label="Meeting calendar"
        className="overflow-hidden rounded-lg border bg-card shadow-xl"
      >
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">{format(month, "MMMM yyyy")}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8 cursor-pointer"
              aria-label="Previous month"
              onClick={() => setMonth((m) => subMonths(m, 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer"
              onClick={() => {
                const today = new Date();
                setMonth(startOfMonth(today));
                setSelected(today);
              }}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 cursor-pointer"
              aria-label="Next month"
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-semibold text-muted-foreground">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-2 text-center">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const items = meetingsByDay.get(key) ?? [];
            const isSelected = isSameDay(day, selected);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${format(day, "d MMMM yyyy")}, ${items.length} meeting${items.length === 1 ? "" : "s"}`}
                onClick={() => setSelected(day)}
                className={cn(
                  "min-h-20 cursor-pointer border-b border-r p-1.5 text-left align-top transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B239] sm:min-h-28",
                  !isSameMonth(day, month) && "bg-muted/20 text-muted-foreground/60",
                  isSelected && "bg-[#67B239]/10 ring-1 ring-inset ring-[#67B239]",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                    isToday(day) && "bg-[#67B239] text-white",
                  )}
                >
                  {format(day, "d")}
                </span>

                {/* Phones: colour dots only; larger screens show avatar chips */}
                <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                  {items.slice(0, 3).map((m) => (
                    <span
                      key={m.id}
                      className={cn("size-1.5 rounded-full", STATUS_DOT[m.status])}
                    />
                  ))}
                </div>
                <div className="mt-1 hidden space-y-1 sm:block">
                  {items.slice(0, MAX_CHIPS).map((m) => (
                    <span
                      key={m.id}
                      className="flex items-center gap-1 rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800"
                    >
                      <Avatar className="size-4 shrink-0">
                        <AvatarImage src={m.assigned_user_avatar ?? undefined} alt="" />
                        <AvatarFallback className="text-[8px]">
                          {initialsOf(m.assigned_user_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-[11px] font-medium text-foreground">
                        {m.meeting_time.slice(0, 5)} {m.title}
                      </span>
                    </span>
                  ))}
                  {items.length > MAX_CHIPS && (
                    <span className="block text-[11px] text-muted-foreground">
                      +{items.length - MAX_CHIPS} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="h-fit space-y-3 rounded-lg border bg-card p-4 shadow-xl">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {format(selected, "EEEE")}
          </p>
          <h3 className="text-lg font-semibold text-foreground">
            {format(selected, "d MMM yyyy")}
          </h3>
        </div>

        {selectedMeetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No meetings on this day.</p>
        ) : (
          <ul className="space-y-2">
            {selectedMeetings.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onSelectMeeting(m)}
                  className="flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <Avatar className="size-9 shrink-0">
                    <AvatarImage src={m.assigned_user_avatar ?? undefined} alt="" />
                    <AvatarFallback className="text-xs">
                      {initialsOf(m.assigned_user_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {m.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="size-3 shrink-0" />
                      {m.meeting_time.slice(0, 5)} · {m.assigned_user_name || "Unassigned"}
                    </span>
                    {m.location && (
                      <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        {m.location}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", STATUS_DOT[m.status])}
                    aria-label={m.status}
                    role="img"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

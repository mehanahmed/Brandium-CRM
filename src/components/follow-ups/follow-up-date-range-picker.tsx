"use client";

import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  Clock,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type FollowUpDateFilterType =
  | "all"
  | "today"
  | "tomorrow"
  | "next7Days"
  | "thisWeek"
  | "thisMonth"
  | "nextMonth"
  | "overdue"
  | "custom";

export interface FollowUpDateFilterValue {
  type: FollowUpDateFilterType;
  range?: DateRange | undefined;
  label: string;
}

export function parseScheduledDate(dueAt: string | null | undefined): Date | null {
  if (!dueAt) return null;
  const normalized = dueAt.includes(" ") ? dueAt.replace(" ", "T") : dueAt;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    const match = dueAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match && match[1] && match[2] && match[3]) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    return null;
  }
  return d;
}

export function getPresetDateRange(type: FollowUpDateFilterType): DateRange | undefined {
  const now = new Date();
  switch (type) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "tomorrow": {
      const tomorrow = addDays(now, 1);
      return { from: startOfDay(tomorrow), to: endOfDay(tomorrow) };
    }
    case "next7Days":
      return { from: startOfDay(now), to: endOfDay(addDays(now, 6)) };
    case "thisWeek":
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "thisMonth":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "nextMonth": {
      const nextM = addMonths(now, 1);
      return { from: startOfMonth(nextM), to: endOfMonth(nextM) };
    }
    case "overdue":
    case "all":
    case "custom":
    default:
      return undefined;
  }
}

export function getFilterLabel(type: FollowUpDateFilterType, range?: DateRange): string {
  switch (type) {
    case "today":
      return "Today";
    case "tomorrow":
      return "Tomorrow";
    case "next7Days":
      return "Next 7 Days";
    case "thisWeek":
      return "This Week";
    case "thisMonth":
      return "This Month";
    case "nextMonth":
      return "Next Month";
    case "overdue":
      return "Overdue";
    case "custom": {
      if (!range?.from) return "Custom Range";
      if (!range.to || isSameDay(range.from, range.to)) {
        return format(range.from, "MMM d, yyyy");
      }
      if (range.from.getFullYear() !== range.to.getFullYear()) {
        return `${format(range.from, "MMM d, yyyy")} - ${format(range.to, "MMM d, yyyy")}`;
      }
      return `${format(range.from, "MMM d")} - ${format(range.to, "MMM d, yyyy")}`;
    }
    case "all":
    default:
      return "All Scheduled Dates";
  }
}

export function isFollowUpInDateFilter(
  dueAt: string | null | undefined,
  filter: FollowUpDateFilterValue,
): boolean {
  if (filter.type === "all") return true;
  const date = parseScheduledDate(dueAt);
  if (!date) return false;

  const now = new Date();
  if (filter.type === "overdue") {
    return date.getTime() < startOfDay(now).getTime();
  }

  const range = filter.range || getPresetDateRange(filter.type);
  if (!range?.from) return true;

  const start = startOfDay(range.from).getTime();
  const end = endOfDay(range.to || range.from).getTime();
  const time = date.getTime();
  return time >= start && time <= end;
}

const PRESETS: Array<{
  type: FollowUpDateFilterType;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badgeColor?: string;
}> = [
  { type: "all", label: "All Scheduled Dates", icon: Sparkles },
  { type: "today", label: "Today", icon: Clock },
  { type: "tomorrow", label: "Tomorrow", icon: CalendarDays },
  { type: "next7Days", label: "Next 7 Days", icon: CalendarRange },
  { type: "thisWeek", label: "This Week", icon: CalendarDays },
  { type: "thisMonth", label: "This Month", icon: CalendarDays },
  { type: "nextMonth", label: "Next Month", icon: CalendarDays },
  { type: "overdue", label: "Overdue", icon: AlertCircle, badgeColor: "text-red-500" },
];

interface FollowUpDateRangePickerProps {
  value: FollowUpDateFilterValue;
  onChange: (value: FollowUpDateFilterValue) => void;
  className?: string;
  totalFilteredCount?: number;
}

export function FollowUpDateRangePicker({
  value,
  onChange,
  className,
  totalFilteredCount,
}: FollowUpDateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>(value.range);

  const displayLabel = useMemo(() => {
    return getFilterLabel(value.type, value.range);
  }, [value.type, value.range]);

  const handleSelectPreset = (presetType: FollowUpDateFilterType) => {
    const range = getPresetDateRange(presetType);
    setTempRange(range);
    onChange({
      type: presetType,
      range,
      label: getFilterLabel(presetType, range),
    });
    setOpen(false);
  };

  const handleApplyCustom = () => {
    if (!tempRange?.from) return;
    const finalRange = tempRange.to ? tempRange : { from: tempRange.from, to: tempRange.from };
    onChange({
      type: "custom",
      range: finalRange,
      label: getFilterLabel("custom", finalRange),
    });
    setOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTempRange(undefined);
    onChange({
      type: "all",
      range: undefined,
      label: getFilterLabel("all"),
    });
    setOpen(false);
  };

  const isFiltered = value.type !== "all";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 px-3 bg-card border-border/50 rounded-xl flex items-center gap-2 hover:bg-muted/40 cursor-pointer text-xs font-medium justify-between min-w-44 max-w-full group",
            isFiltered && "border-[#67B239]/60 bg-[#67B239]/5 text-foreground",
            className,
          )}
        >
          <div className="flex items-center gap-2 truncate min-w-0">
            <CalendarDays
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                isFiltered ? "text-[#67B239]" : "text-muted-foreground",
              )}
            />
            <span className="truncate">{displayLabel}</span>
            {typeof totalFilteredCount === "number" && isFiltered && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#67B239]/20 text-[#55962e] shrink-0">
                {totalFilteredCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {isFiltered ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear filter"
                onClick={handleClear}
                className="size-4.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <X className="size-3" />
              </span>
            ) : (
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            )}
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-auto p-0 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
          {/* Presets List */}
          <div className="p-2.5 w-full sm:w-48 space-y-1 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
              Scheduled Date
            </div>
            {PRESETS.map((preset) => {
              const active = value.type === preset.type;
              const Icon = preset.icon || CalendarDays;
              return (
                <button
                  key={preset.type}
                  type="button"
                  onClick={() => handleSelectPreset(preset.type)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer",
                    active
                      ? "bg-[#67B239] text-white shadow-xs font-semibold"
                      : "text-foreground hover:bg-muted/80",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5",
                        active ? "text-white" : preset.badgeColor || "text-muted-foreground",
                      )}
                    />
                    <span>{preset.label}</span>
                  </div>
                  {active && <Check className="h-3 w-3 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Custom Date Range Picker */}
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-foreground">Custom Date Range</span>
              {tempRange?.from && (
                <span className="text-[11px] font-medium text-[#55962e]">
                  {getFilterLabel("custom", tempRange)}
                </span>
              )}
            </div>

            <Calendar
              mode="range"
              selected={tempRange}
              onSelect={setTempRange}
              defaultMonth={tempRange?.from || new Date()}
              numberOfMonths={1}
              className="p-1 rounded-xl border border-border/40"
            />

            <div className="flex items-center justify-between pt-2 border-t border-border gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2.5 cursor-pointer"
              >
                Reset to All
              </Button>
              <Button
                size="sm"
                disabled={!tempRange?.from}
                onClick={handleApplyCustom}
                className="bg-[#67B239] hover:bg-[#55962e] text-white text-xs h-8 px-3 rounded-lg cursor-pointer font-semibold shadow-xs"
              >
                Apply Range
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

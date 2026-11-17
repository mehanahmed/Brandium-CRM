"use client";

import React from "react";
import { Calendar2 as Calendar } from "@/components/ui/calendar2";
import type { Lead } from "@/types";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { format, isToday, isBefore, startOfDay, addMonths, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface LeadCalendarViewProps {
  leads: Lead[];
  onViewLead: (lead: Lead) => void;
}

const getCategoryClass = (category: string) => {
  switch (category?.toUpperCase()) {
    case "POP":
      return "bg-sky-500";
    case "APPOINTMENT":
      return "bg-indigo-500";
    case "PROSPECT":
      return "bg-pink-500";
    case "POG":
      return "bg-blue-500";
    case "OC":
      return "bg-purple-500";
    case "BUDGET_ISSUE":
      return "bg-amber-500";
    case "CANCELLED":
    case "CANCELED":
      return "bg-red-500";
    case "PENDING":
      return "bg-blue-500";
    case "IN PROGRESS":
    case "IN_PROGRESS":
      return "bg-purple-500";
    case "COMPLETED":
      return "bg-emerald-500";
    default:
      return "bg-gray-500";
  }
};

// Define DayWithEvents outside of LeadCalendarView to prevent re-creation on every render
const DayWithEvents = ({
  date,
  dayEvents,
  onViewLead,
}: {
  date: Date;
  dayEvents: Lead[];
  onViewLead: (lead: Lead) => void;
}) => {
  const isCurrentDay = isToday(date);
  const today = startOfDay(new Date());
  const isPastDate = isBefore(date, today) && !isToday(date);

  const cardBackgroundColor = () => {
    if (isPastDate && dayEvents.length > 0) {
      return "bg-red-100 dark:bg-red-900/30";
    }
    if (!isPastDate && dayEvents.length > 0) {
      return "bg-green-100 dark:bg-green-900/30";
    }
    return "";
  };

  return (
    <Popover>
      <PopoverTrigger asChild disabled={dayEvents.length === 0}>
        <div
          className={cn(
            "relative flex flex-col items-start justify-start p-1.5 w-full h-[120px] rounded-md transition-colors border border-border/30 shadow-xs",
            dayEvents.length > 0 && "cursor-pointer hover:bg-accent hover:border-primary/50",
            cardBackgroundColor(),
          )}
        >
          <span
            className={cn(
              "flex items-center justify-center text-xs h-6 w-6 rounded-full font-medium",
              isCurrentDay ? "bg-primary text-primary-foreground font-semibold" : "",
            )}
          >
            {date.getDate()}
          </span>
          <div className="flex-grow w-full mt-1.5 space-y-1 overflow-hidden">
            {dayEvents.slice(0, 3).map((lead) => (
              <div key={lead.id} className="flex items-center gap-1.5 w-full">
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    getCategoryClass(lead.category),
                  )}
                />
                <span className="text-xs text-foreground/80 truncate">{lead.contactName}</span>
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="text-xs text-muted-foreground ml-3 pt-0.5">
                + {dayEvents.length - 3} more
              </div>
            )}
          </div>
        </div>
      </PopoverTrigger>
      {dayEvents.length > 0 && (
        <PopoverContent className="w-72 p-0" align="start">
          <div className="font-semibold text-sm mb-2 px-3 pt-3">{format(date, "PPP")}</div>
          <ScrollArea className="h-[20rem] px-1">
            <div className="space-y-1 p-2">
              {dayEvents.map((lead) => (
                <div key={lead.id} className="p-1.5 rounded-md hover:bg-muted">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        getCategoryClass(lead.category),
                      )}
                    />
                    <span className="text-xs font-medium truncate">{lead.contactName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-4 truncate">{lead.businessName}</p>
                  <div className="flex justify-end mt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "h-6 text-xs px-2",
                        lead.customerType === "WARM" &&
                          "bg-purple-100 text-purple-800 hover:bg-purple-200",
                        lead.customerType === "COLD" &&
                          "bg-blue-100 text-blue-800 hover:bg-blue-200",
                      )}
                      onClick={() => onViewLead(lead)}
                    >
                      View {lead.customerType ? `${lead.customerType} Lead` : "Lead"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      )}
    </Popover>
  );
};

export function LeadCalendarView({ leads, onViewLead }: LeadCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const eventsByDate = React.useMemo(() => {
    const events: Record<string, Lead[]> = {};
    leads.forEach((lead) => {
      if (lead.schedule) {
        try {
          const raw = String(lead.schedule);
          const parsed = new Date(raw.includes(" ") ? raw.replace(" ", "T") : raw);
          if (!Number.isNaN(parsed.getTime())) {
            const dateKey = parsed.toDateString();
            if (!events[dateKey]) {
              events[dateKey] = [];
            }
            events[dateKey].push(lead);
          }
        } catch (e) {
          console.error("Invalid schedule date found for lead:", lead.id, lead.schedule, e);
        }
      }
    });
    return events;
  }, [leads]);

  return (
    <div className="p-2 sm:p-4 bg-card rounded-2xl border border-border/50 shadow-sm mt-2 flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between px-2 pb-3">
        <h2 className="text-lg font-semibold text-foreground">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs cursor-pointer"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Calendar
        month={currentMonth}
        onMonthChange={setCurrentMonth}
        mode="single"
        className="w-full"
        components={{
          Day: (props: any) => {
            const date: Date | undefined = props.date || props.day?.date;
            if (!date) return <td {...props}>{props.children}</td>;
            return (
              <td
                {...props}
                className={cn("p-0.5 align-top h-full w-full", props.className)}
                data-day={props.day?.isoDate}
              >
                <DayWithEvents
                  date={date}
                  dayEvents={eventsByDate[date.toDateString()] || []}
                  onViewLead={onViewLead}
                />
              </td>
            );
          },
        }}
      />
    </div>
  );
}

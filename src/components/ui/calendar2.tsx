"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar2({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-0 w-full", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4 w-full",
        month: "space-y-3 flex flex-col flex-grow w-full",
        month_caption: "hidden",
        caption_label: "hidden",
        nav: "hidden",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        month_grid: "w-full border-collapse flex flex-col flex-grow",
        weekdays: "flex w-full mb-1",
        weekday: "text-muted-foreground rounded-md w-full font-semibold text-xs text-center py-1.5",
        weeks: "flex-1 flex flex-col gap-1 w-full",
        week: "grid grid-cols-7 gap-1 w-full",
        day: "p-0 relative text-center text-sm focus-within:relative focus-within:z-20 h-full w-full",
        day_button: "h-full w-full p-0 border-0 bg-transparent",
        today: "bg-accent text-accent-foreground font-semibold",
        outside: "text-muted-foreground opacity-30",
        disabled: "text-muted-foreground opacity-50",
        selected: "bg-primary text-primary-foreground font-semibold",
        hidden: "invisible",
        ...classNames,
      }}
      formatters={{
        formatWeekdayName: (day) => format(day, "EEE"),
        ...props.formatters,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
        ...props.components,
      }}
      {...props}
    />
  );
}
Calendar2.displayName = "Calendar2";

export { Calendar2 };

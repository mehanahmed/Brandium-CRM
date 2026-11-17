"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Timeline = React.forwardRef<HTMLOListElement, React.HTMLAttributes<HTMLOListElement>>(
  ({ className, ...props }, ref) => (
    <ol ref={ref} className={cn("flex flex-col space-y-4", className)} {...props} />
  ),
);
Timeline.displayName = "Timeline";

const TimelineItem = React.forwardRef<HTMLLIElement, React.LiHTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn("relative flex flex-col pb-4 last:pb-0", className)} {...props} />
  ),
);
TimelineItem.displayName = "TimelineItem";

const TimelineConnector = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "absolute left-4 top-8 -ml-px h-[calc(100%-1.5rem)] w-0.5 border-l-2 border-dashed border-slate-200 dark:border-slate-800",
        className,
      )}
      {...props}
    />
  ),
);
TimelineConnector.displayName = "TimelineConnector";

const TimelineHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("relative flex items-center gap-3", className)} {...props} />
  ),
);
TimelineHeader.displayName = "TimelineHeader";

const TimelineIcon = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white dark:bg-card border-2 border-[#67B239]/40 text-[#55962e] shadow-xs",
        className,
      )}
      {...props}
    />
  ),
);
TimelineIcon.displayName = "TimelineIcon";

const TimelineTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h4 ref={ref} className={cn("font-semibold text-sm text-foreground", className)} {...props} />
));
TimelineTitle.displayName = "TimelineTitle";

const TimelineDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("ml-11 mt-1 text-xs text-muted-foreground", className)} {...props} />
));
TimelineDescription.displayName = "TimelineDescription";

export {
  Timeline,
  TimelineItem,
  TimelineConnector,
  TimelineHeader,
  TimelineIcon,
  TimelineTitle,
  TimelineDescription,
};

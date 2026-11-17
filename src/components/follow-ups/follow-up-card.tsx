"use client";

import { format } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  Eye,
  MapPin,
  MessageSquarePlus,
  MoreVertical,
  Phone,
  StickyNote,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/components/orders/assign-stage-dialog";
import { followUpStageFor, type FollowUpBoardItem, type FollowUpStage } from "@/lib/follow-ups";
import { parseNotesToItems } from "@/lib/stages";
import { cn } from "@/lib/utils";

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.substring(0, max)}...` : value;

export const formatFollowUpDate = (value: string, pattern: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : format(date, pattern);
};

interface FollowUpCardProps {
  followUp: FollowUpBoardItem;
  statusColor: string;
  isOverlay?: boolean;
  isAdmin: boolean;
  stages?: FollowUpStage[];
  onMoveToStage?: (item: FollowUpBoardItem, stage: FollowUpStage) => void;
  onAddUpdate?: (item: FollowUpBoardItem) => void;
  onViewDetails?: ((item: FollowUpBoardItem) => void) | undefined;
  onDelete?: (item: FollowUpBoardItem) => void;
}

/** Robust Kanban card using @dnd-kit/core and Motion Box architecture. */
export function FollowUpCard({
  followUp,
  statusColor,
  isOverlay = false,
  isAdmin,
  stages,
  onMoveToStage,
  onAddUpdate,
  onViewDetails,
  onDelete,
}: FollowUpCardProps) {
  const displayName = followUp.business_name || followUp.contact_name || "Unnamed prospect";
  const latestNote = parseNotesToItems(followUp.note).at(-1)?.text || "";

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: followUp.id,
    data: { followUp },
    disabled: isOverlay,
  });

  return (
    <div
      ref={!isOverlay ? setNodeRef : null}
      {...(!isOverlay ? { ...attributes, ...listeners } : {})}
      className={cn(
        "relative group w-full select-none transition-all duration-150",
        !isOverlay && isDragging && "opacity-40",
        isOverlay && "cursor-grabbing shadow-2xl scale-105 rotate-1 z-10 pointer-events-none",
      )}
    >
      <Card
        className={cn(
          "bg-card w-full shadow-xs transition-shadow",
          !isOverlay && "cursor-grab active:cursor-grabbing hover:shadow-md",
          isOverlay && "ring-2 ring-[#67B239] shadow-2xl bg-card/95 backdrop-blur-sm",
        )}
      >
        <CardContent className="p-3 space-y-2.5">
          <div
            className="flex items-center gap-2.5 min-w-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (!isOverlay && onViewDetails) {
                onViewDetails(followUp);
              }
            }}
          >
            <Avatar className="size-7 rounded-full shrink-0 border border-slate-200/80 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-2xs overflow-hidden">
              <AvatarImage
                src={followUp.logo_url || undefined}
                alt={displayName}
                className="size-full object-cover rounded-full"
              />
              <AvatarFallback className="text-[10px] font-bold bg-[#67B239]/10 text-[#55962e] uppercase">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <h3
              className="text-sm font-semibold text-foreground group-hover:text-[#67B239] transition-colors flex-1 truncate"
              title={displayName}
            >
              {truncate(displayName, 24)}
            </h3>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium min-w-0">
              <UserIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate" title={followUp.contact_name}>
                {followUp.contact_name || "N/A"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {followUp.phone ? (
                <a
                  href={`tel:${followUp.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="hover:text-[#67B239]"
                >
                  {followUp.phone}
                </a>
              ) : (
                <span>N/A</span>
              )}
            </div>
          </div>

          <div className="flex items-end justify-between gap-2 pt-1">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Next Follow-up
              </span>
              <div
                className="inline-flex w-fit items-center rounded-md border px-2 py-1 text-[10px] font-bold shadow-xs"
                style={{
                  backgroundColor: `${statusColor}1A`,
                  color: statusColor,
                  borderColor: `${statusColor}33`,
                }}
                title="Next follow-up date"
              >
                <CalendarDays className="mr-1.5 h-3 w-3 shrink-0" />
                <span>{formatFollowUpDate(followUp.due_at, "dd MMM, yyyy h:mm a")}</span>
              </div>
            </div>

            {followUp.address && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      className="h-7 w-7 shrink-0 rounded-lg bg-muted/30 flex items-center justify-center cursor-help border border-border/40"
                    >
                      <MapPin className="h-3.5 w-3.5 text-[#67B239]" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs leading-relaxed">{followUp.address}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <div
            className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50 px-2 py-1.5 text-[11px] leading-snug"
            title={latestNote || "No note"}
          >
            <StickyNote className="h-3.5 w-3.5 shrink-0 mt-px text-amber-700 dark:text-amber-400" />
            {latestNote ? (
              <span className="line-clamp-2 wrap-anywhere text-amber-900 dark:text-amber-200">
                {latestNote}
              </span>
            ) : (
              <span className="italic text-muted-foreground">No note</span>
            )}
          </div>

          <div className="pt-2.5 border-t border-border/40 flex items-center justify-between">
            <div
              className="flex items-center gap-2 min-w-0"
              title={`Assigned to ${followUp.agent_name}`}
            >
              <Avatar className="h-7 w-7 ring-2 ring-background border border-border/40 shadow-xs">
                <AvatarImage src={followUp.agent_avatar || undefined} alt={followUp.agent_name} />
                <AvatarFallback className="text-[9px] font-bold bg-[#67B239]/10 text-[#55962e]">
                  {getInitials(followUp.agent_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] font-bold text-foreground/80 truncate max-w-24">
                {followUp.agent_name}
              </span>
            </div>
            {!isOverlay && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Follow-up actions"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-[#67B239] hover:bg-[#67B239]/5 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {stages && stages.length > 0 && onMoveToStage && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="cursor-pointer">
                        <ArrowRight className="h-4 w-4 mr-2 text-[#67B239]" />
                        Move to Stage
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-44">
                        {stages.map((stg) => {
                          const isCurrent =
                            followUpStageFor(followUp.status, stages)?.id === stg.id;
                          return (
                            <DropdownMenuItem
                              key={stg.id}
                              disabled={isCurrent}
                              onClick={() => onMoveToStage(followUp, stg)}
                              className="cursor-pointer flex items-center gap-2"
                            >
                              <span
                                className="size-2 rounded-full shrink-0"
                                style={{ backgroundColor: stg.color }}
                              />
                              <span className={cn(isCurrent && "font-semibold")}>{stg.name}</span>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  {onAddUpdate && (
                    <DropdownMenuItem
                      onClick={() => onAddUpdate(followUp)}
                      className="cursor-pointer"
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                      Add Update
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      if (onViewDetails) onViewDetails(followUp);
                    }}
                    className="cursor-pointer"
                  >
                    <Eye className="h-4 w-4 mr-2 text-[#67B239]" />
                    View Details
                  </DropdownMenuItem>
                  {isAdmin && onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(followUp)}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Record
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

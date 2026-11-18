"use client";

import React, { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CrmUser } from "@/lib/admin-users";
import { resolveOrderStatus, type CrmOrder } from "@/lib/orders";

interface AssignStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: CrmOrder;
  /** Assignable stage the order is moving into (or re-assigning). */
  statusId: string;
  users: CrmUser[];
  /** `deadline` is an ISO time when the admin set one, otherwise null. */
  onAssign: (assignee: CrmUser, deadline: string | null) => Promise<void>;
  isSaving: boolean;
}

export const getInitials = (name: string | null | undefined): string => {
  const parts = (name || "").split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return (parts[0] as string).charAt(0).toUpperCase();
  return (
    (parts[0] as string).charAt(0) + (parts[parts.length - 1] as string).charAt(0)
  ).toUpperCase();
};

/** Based on ERPAPP `assign-dr-dialog.tsx`: picks the user responsible for an assignable stage. */
export function AssignStageDialog({
  open,
  onOpenChange,
  order,
  statusId,
  users,
  onAssign,
  isSaving,
}: AssignStageDialogProps) {
  const stage = resolveOrderStatus(statusId);
  const isReassign = resolveOrderStatus(order.status).id === stage.id;
  const [selectedDrId, setSelectedDrId] = useState(isReassign ? order.designer_id || "" : "");
  // Optional stage deadline as a datetime-local value; empty means no deadline and no progress bar
  const [deadline, setDeadline] = useState("");
  // Earliest pickable deadline: start of today (local), so previous days are disabled
  const earliestDeadline = useMemo(() => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T00:00`;
  }, []);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const designerReps = useMemo(
    () => users.filter((u) => !u.is_deleted && (u.status || "Active") !== "Deleted"),
    [users],
  );
  // Only people with this stage's short role (e.g. SW for Script Writer) can be assigned.
  // Stages without a role (no stage team) list every active user.
  const stageRole = stage.role?.toUpperCase();
  const stageTeam = useMemo(
    () =>
      stageRole
        ? designerReps.filter((u) => (u.role || "").toUpperCase() === stageRole)
        : designerReps,
    [designerReps, stageRole],
  );
  const selected = stageTeam.find((dr) => dr.id === selectedDrId);

  const renderUser = (dr: CrmUser) => (
    <CommandItem
      key={dr.id}
      value={`${dr.name} ${dr.role || ""}`}
      onSelect={() => {
        setSelectedDrId(dr.id);
        setIsPopoverOpen(false);
      }}
      className="flex items-center gap-2"
    >
      <Check className={cn("h-4 w-4", selectedDrId === dr.id ? "opacity-100" : "opacity-0")} />
      <Avatar className="h-6 w-6">
        <AvatarImage src={dr.avatar_url || undefined} alt={dr.name} />
        <AvatarFallback className="text-xs">{getInitials(dr.name)}</AvatarFallback>
      </Avatar>
      <span>{dr.name}</span>
      <span className="ms-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {(dr.role || "").toUpperCase()}
      </span>
    </CommandItem>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const deadlineDate = deadline ? new Date(deadline) : null;
    if (deadlineDate && Number.isNaN(deadlineDate.getTime())) {
      toast.error("Invalid deadline", { description: "Pick a valid date and time." });
      return;
    }
    if (deadlineDate && deadline < earliestDeadline) {
      toast.error("Invalid deadline", { description: "The deadline cannot be a previous day." });
      return;
    }
    await onAssign(selected, deadlineDate ? deadlineDate.toISOString() : null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Assign {stage.name}
            {stageRole && (
              <span className="rounded-md bg-[#67B239]/15 px-2 py-0.5 text-xs font-semibold text-[#55962e] dark:text-[#7ac142]">
                {stageRole}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            The order moves to <span className="font-semibold text-foreground">{stage.name}</span>{" "}
            and the selected person takes it on.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-900/60">
          <span className="font-semibold text-foreground">{order.order_number}</span>
          <span className="truncate text-muted-foreground">{order.company_name}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Assign to</Label>
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={isPopoverOpen}
                  className="h-auto min-h-10 w-full justify-between px-3 py-2"
                  disabled={stageTeam.length === 0}
                >
                  {selected ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={selected.avatar_url || undefined} alt={selected.name} />
                        <AvatarFallback className="text-xs">
                          {getInitials(selected.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{selected.name}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {stageTeam.length === 0 ? "No one available" : "Select a user..."}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                <Command>
                  <CommandInput placeholder="Search user..." />
                  <CommandList>
                    <CommandEmpty>No user found.</CommandEmpty>
                    <CommandGroup heading={stageRole ? `${stage.name} (${stageRole})` : undefined}>
                      {stageTeam.map(renderUser)}
                    </CommandGroup>
                    {stageRole && stageTeam.length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        No user has the {stageRole} role yet. Set it in Users.
                      </p>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="stage-deadline">Deadline (optional)</Label>
              {deadline && (
                <button
                  type="button"
                  onClick={() => setDeadline("")}
                  className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <Input
              id="stage-deadline"
              type="datetime-local"
              min={earliestDeadline}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={isSaving}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              Progress is shown on the card only when a deadline is set.
            </p>
          </div>

          <DialogFooter className="gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !selected}
              className="bg-[#67B239] text-white hover:bg-[#5aa030]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

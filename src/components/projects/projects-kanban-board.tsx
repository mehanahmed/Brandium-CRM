"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfDay, format, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { projectStagePermId } from "@/lib/roles";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Clock,
  ClipboardCheck,
  Code,
  Download,
  Film,
  Loader2,
  Megaphone,
  NotebookPen,
  PackageCheck,
  PenLine,
  User as UserIcon,
  Users as UsersIcon,
  Video,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { crmUsersQueryOptions, type CrmUser } from "@/lib/admin-users";
import {
  ORDER_STATUSES,
  ORDER_SUBMITTED_STATUS_ID,
  useOrderStages,
  useOrderStageSettings,
  ordersQueryOptions,
  requiresStatusReason,
  resolveOrderStatus,
  useAssignStageMutation,
  useUpdateOrderStatusMutation,
  type CrmOrder,
} from "@/lib/orders";
import { DateRangePicker3 } from "@/components/dashboard/date-range-picker3";
import { AssignStageDialog, getInitials } from "@/components/orders/assign-stage-dialog";
import { StatusReasonDialog } from "@/components/orders/status-reason-dialog";
import { KanbanColumn } from "./kanban-column";
import { ProjectCard } from "./project-card";
import { getStageStartedAt } from "@/lib/orders";
import { useSeesAllData } from "@/lib/use-data-scope";

const STAGE_ICONS: Record<string, LucideIcon> = {
  "order-submitted": ClipboardCheck,
  "script-writer": PenLine,
  "content-planner": NotebookPen,
  videographer: Video,
  "video-graphy-complete": CheckCircle2,
  "video-editor": Film,
  marketer: Megaphone,
  developer: Code,
  delivered: PackageCheck,
  "on-hold": Clock,
  canceled: XCircle,
};

const COLUMN_IDS = new Set(ORDER_STATUSES.map((s) => s.id));

/** Column for an order; legacy statuses outside the workflow land in Order Submitted. */
const columnIdFor = (order: CrmOrder) => {
  const id = resolveOrderStatus(order.status).id;
  return COLUMN_IDS.has(id) ? id : ORDER_SUBMITTED_STATUS_ID;
};

const toCsvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

/** Prevents dragged card from ever crossing into the sidebar, header, or viewport edges */
const restrictToBoard: Modifier = ({ transform, draggingNodeRect }) => {
  if (!draggingNodeRect || typeof window === "undefined") return transform;

  const sidebar = document.querySelector("aside");
  const sidebarRight = sidebar ? sidebar.getBoundingClientRect().right : 0;
  const header = document.querySelector("header");
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;

  const value = { ...transform };

  // Stop card from crossing into the sidebar (left boundary)
  if (draggingNodeRect.left + transform.x < sidebarRight + 8) {
    value.x = sidebarRight + 8 - draggingNodeRect.left;
  }

  // Stop card from crossing off the right edge of the screen
  if (draggingNodeRect.right + transform.x > window.innerWidth - 8) {
    value.x = window.innerWidth - 8 - draggingNodeRect.right;
  }

  // Stop card from crossing into the top header
  if (draggingNodeRect.top + transform.y < headerBottom + 8) {
    value.y = headerBottom + 8 - draggingNodeRect.top;
  }

  // Stop card from crossing off the bottom edge of the screen
  if (draggingNodeRect.bottom + transform.y > window.innerHeight - 8) {
    value.y = window.innerHeight - 8 - draggingNodeRect.bottom;
  }

  return value;
};

/** Clone of ERPAPP `ProjectsKanbanClient2.tsx`: every order is a card in its stage column. */
export function ProjectsKanbanBoard() {
  const stages = useOrderStages();
  const { user, profile, isAdmin, permissions } = useAuth();
  const stageSettings = useOrderStageSettings();
  // Columns this user may see: not hidden, and (admins, or the role has the stage permission)
  const visibleStages = useMemo(
    () =>
      stages.filter(
        (stage) =>
          !stageSettings.hidden.includes(stage.id) &&
          (isAdmin || permissions.includes(projectStagePermId(stage.id))),
      ),
    [stages, stageSettings, isAdmin, permissions],
  );
  const seesAllOrders = useSeesAllData("orders");
  const {
    data: ordersData,
    isLoading,
    isFetching,
  } = useQuery({
    ...ordersQueryOptions(user?.id, seesAllOrders),
    refetchInterval: 30000,
  });
  const { data: usersData } = useQuery(crmUsersQueryOptions());
  const orders = useMemo(() => ordersData || [], [ordersData]);
  const users = useMemo(() => (usersData as CrmUser[]) || [], [usersData]);

  const updateStatusMutation = useUpdateOrderStatusMutation();
  const assignStageMutation = useAssignStageMutation();
  const changedByName = profile?.full_name || "Admin";

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [selectedUserIdFilter, setSelectedUserIdFilter] = useState("all");
  const [isUserFilterOpen, setIsUserFilterOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<CrmOrder | null>(null);
  const [stageAssign, setStageAssign] = useState<{ order: CrmOrder; statusId: string } | null>(
    null,
  );
  const [reasonTarget, setReasonTarget] = useState<{ order: CrmOrder; statusId: string } | null>(
    null,
  );

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10,
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const selectedUser = users.find((u) => u.id === selectedUserIdFilter);

  const filteredOrders = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase();
    return orders.filter((order) => {
      if (
        selectedUserIdFilter !== "all" &&
        order.crm_user_id !== selectedUserIdFilter &&
        order.designer_id !== selectedUserIdFilter
      ) {
        return false;
      }
      if (
        term &&
        ![
          order.company_name,
          order.job_id,
          order.order_number,
          order.crm_user_name,
          order.designer_name,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term))
      ) {
        return false;
      }
      if (selectedDateRange?.from) {
        const start = startOfDay(selectedDateRange.from).getTime();
        const end = endOfDay(selectedDateRange.to || selectedDateRange.from).getTime();
        const t = new Date(order.created_at).getTime();
        if (t < start || t > end) return false;
      }
      return true;
    });
  }, [orders, debouncedSearchTerm, selectedDateRange, selectedUserIdFilter]);

  const ordersByStatus = useMemo(() => {
    const grouped: Record<string, CrmOrder[]> = {};
    stages.forEach((s) => (grouped[s.id] = []));
    // Starred first (most stars), then newest stage entry first — like ERPAPP
    const sorted = [...filteredOrders].sort((a, b) => {
      if (a.is_starred !== b.is_starred) return b.is_starred - a.is_starred;
      return new Date(getStageStartedAt(b)).getTime() - new Date(getStageStartedAt(a)).getTime();
    });
    sorted.forEach((order) => grouped[columnIdFor(order)]?.push(order));
    return grouped;
  }, [filteredOrders, stages]);

  const handleDropOrder = (orderId: string, statusId: string) => {
    setActiveOrder(null);
    const order = orders.find((o) => o.id === orderId);
    if (!order || columnIdFor(order) === statusId) return;
    if (!isAdmin && !permissions.includes(projectStagePermId(statusId))) {
      toast.error("Permission Denied", {
        description: `You do not have permission to move projects to the '${resolveOrderStatus(statusId).name}' stage.`,
      });
      return;
    }
    const target = resolveOrderStatus(statusId);
    if (target.assignable) {
      setStageAssign({ order, statusId });
      return;
    }
    if (requiresStatusReason(statusId)) {
      setReasonTarget({ order, statusId });
      return;
    }
    updateStatusMutation.mutate({ order, statusId, changedByName });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const order = event.active.data.current?.["order"] as CrmOrder | undefined;
    if (order) {
      setActiveOrder(order);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOrder(null);
    if (!over) return;

    const orderId = String(active.id);
    const targetStatusId = String(over.id);
    handleDropOrder(orderId, targetStatusId);
  };

  const handleDragCancel = () => {
    setActiveOrder(null);
  };

  const handleExport = (statusId: string) => {
    const stage = resolveOrderStatus(statusId);
    const rows = ordersByStatus[statusId] || [];
    if (rows.length === 0) {
      toast("No Data", {
        description: `There are no projects in the '${stage.name}' stage to export.`,
      });
      return;
    }
    const header = ["Job ID", "Company Name", "Assignee", "Assigned To", "Status", "Created At"];
    const lines = rows.map((o) =>
      [
        o.job_id || o.order_number,
        o.company_name,
        o.crm_user_name || "N/A",
        o.designer_name || "N/A",
        stage.name,
        format(new Date(o.created_at), "yyyy-MM-dd HH:mm"),
      ]
        .map((v) => toCsvCell(String(v)))
        .join(","),
    );
    const csv = [header.map(toCsvCell).join(","), ...lines].join("\n");
    const blob = new Blob([String.fromCharCode(0xfeff) + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${stage.name.toLowerCase().replace(/ /g, "_")}_projects_export.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Export Started", {
      description: `Your ${stage.name} projects data is being downloaded.`,
    });
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-card border-border/50 pr-8 h-10"
          />
          {isFetching && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {isAdmin && (
          <Popover open={isUserFilterOpen} onOpenChange={setIsUserFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isUserFilterOpen}
                className="w-full justify-between bg-card border-border/50 h-10 cursor-pointer"
              >
                <span className="flex items-center min-w-0">
                  {selectedUser ? (
                    <Avatar className="mr-2 h-6 w-6">
                      <AvatarImage src={selectedUser.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(selectedUser.name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="truncate">{selectedUser?.name || "All Users"}</span>
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
              <Command>
                <CommandInput placeholder="Search user..." />
                <CommandList>
                  <CommandEmpty>No user found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all-users"
                      onSelect={() => {
                        setSelectedUserIdFilter("all");
                        setIsUserFilterOpen(false);
                      }}
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <Check
                        className={cn(
                          "h-4 w-4",
                          selectedUserIdFilter === "all" ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <UsersIcon className="h-5 w-5 text-muted-foreground" />
                      <span>All Users</span>
                    </CommandItem>
                    {users.map((u) => (
                      <CommandItem
                        key={u.id}
                        value={u.name}
                        onSelect={() => {
                          setSelectedUserIdFilter(u.id);
                          setIsUserFilterOpen(false);
                        }}
                        className="cursor-pointer flex items-center gap-2"
                      >
                        <Check
                          className={cn(
                            "h-4 w-4",
                            selectedUserIdFilter === u.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">{getInitials(u.name)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{u.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto capitalize">
                          ({(u.role || "").toLowerCase()})
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
        <DateRangePicker3
          initialRange={selectedDateRange}
          onDateRangeChange={(range) => setSelectedDateRange(range)}
          className="bg-card border-border/50 w-full sm:w-full"
        />
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={isLoading}
                className="bg-card border-border/50 w-full h-10 cursor-pointer"
              >
                {isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export Data
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Select Stage to Export</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {stages.map((stage) => {
                const Icon = STAGE_ICONS[stage.id] || ClipboardCheck;
                return (
                  <DropdownMenuItem
                    key={stage.id}
                    onClick={() => handleExport(stage.id)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 opacity-70" />
                    {stage.name}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        modifiers={[restrictToBoard]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex-1 min-h-0 overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex space-x-4 h-full min-w-max">
            {visibleStages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                id={stage.id}
                title={stage.name}
                icon={STAGE_ICONS[stage.id] || ClipboardCheck}
                color={stage.color}
                orders={ordersByStatus[stage.id] || []}
                isLoading={isLoading}
                onAssign={(order) => setStageAssign({ order, statusId: columnIdFor(order) })}
              />
            ))}
          </div>
          {filteredOrders.length === 0 && !isLoading && (
            <div className="text-center py-10 text-muted-foreground mt-8">
              <ClipboardCheck className="mx-auto h-16 w-16 opacity-30 mb-4" />
              <p className="text-xl font-semibold">No projects found.</p>
              <p className="text-sm">
                {searchTerm
                  ? "Try adjusting your filters or search term."
                  : "Get started by adding new orders."}
              </p>
            </div>
          )}
        </div>

        <DragOverlay modifiers={[restrictToBoard]} zIndex={20} dropAnimation={null}>
          {activeOrder ? (
            <ProjectCard
              order={activeOrder}
              isOverlay
              onAssign={(order) => setStageAssign({ order, statusId: columnIdFor(order) })}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {reasonTarget && (
        <StatusReasonDialog
          key={`${reasonTarget.order.id}-${reasonTarget.statusId}`}
          order={reasonTarget.order}
          statusId={reasonTarget.statusId}
          isSaving={updateStatusMutation.isPending}
          onCancel={() => setReasonTarget(null)}
          onConfirm={(reason) =>
            updateStatusMutation.mutate(
              { ...reasonTarget, changedByName, reason },
              { onSuccess: () => setReasonTarget(null) },
            )
          }
        />
      )}

      {stageAssign && (
        <AssignStageDialog
          key={`${stageAssign.order.id}-${stageAssign.statusId}`}
          open
          onOpenChange={(open) => !open && setStageAssign(null)}
          order={stageAssign.order}
          statusId={stageAssign.statusId}
          users={users}
          onAssign={async (assignee) => {
            await assignStageMutation.mutateAsync({
              order: stageAssign.order,
              statusId: stageAssign.statusId,
              assigneeId: assignee.id,
              assigneeName: assignee.name,
              changedByName,
            });
            setStageAssign(null);
          }}
          isSaving={assignStageMutation.isPending}
        />
      )}
    </div>
  );
}

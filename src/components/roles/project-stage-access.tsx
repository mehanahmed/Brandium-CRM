"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getContrastTextColor,
  saveOrderStageSettings,
  useOrderStages,
  useOrderStageSettings,
  type OrderStatus,
} from "@/lib/orders";
import { ensureProjectStagePermissions, projectStagePermId, type CrmRoleItem } from "@/lib/roles";
import { cn } from "@/lib/utils";

export type RolesView = "roles" | "stages";

/** Roles / Project Stages switch shown at the top of the Roles page. */
export function RolesViewTabs({
  value,
  onChange,
}: {
  value: RolesView;
  onChange: (next: RolesView) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as RolesView)}>
      <TabsList className="bg-muted/60">
        <TabsTrigger value="roles" className="cursor-pointer">
          Roles
        </TabsTrigger>
        <TabsTrigger value="stages" className="cursor-pointer">
          Project Stages
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

/** Admin roles (name Admin, the admin role id, or the admin-roles permission) see every stage. */
const isAdminRole = (role: CrmRoleItem) =>
  role.id === "role-global-admin" ||
  role.name.trim().toLowerCase() === "admin" ||
  (role.permission_ids ?? []).includes("perm-admin-roles");

type SavePayload = {
  id: string;
  name: string;
  description: string | null;
  permission_ids: string[];
};

/**
 * Project stage control, the same model as Motion Box: each role may work on a stage (a tick is
 * the `perm-pstage-<stage>` permission), a stage can be hidden from the board for everyone (eye),
 * and the admin sets the column order (arrows). The Projects board shows only the stages the
 * current user may see. Saving rewrites each changed role with its full permission list.
 */
export function ProjectStageAccessTab({
  roles,
  onSaveRole,
}: {
  roles: CrmRoleItem[];
  onSaveRole: (payload: SavePayload) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const savedStages = useOrderStages();
  const savedSettings = useOrderStageSettings();
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  // Stage ids in the order the admin is arranging; null means "as saved"
  const [orderDraft, setOrderDraft] = useState<string[] | null>(null);
  // Hidden stage ids being edited; null means "as saved"
  const [hiddenDraft, setHiddenDraft] = useState<string[] | null>(null);
  const [isSavingLayout, setIsSavingLayout] = useState(false);

  const stages = useMemo<OrderStatus[]>(() => {
    if (!orderDraft) return savedStages;
    const byId = new Map(savedStages.map((stage) => [stage.id, stage]));
    return orderDraft
      .map((id) => byId.get(id))
      .filter((stage): stage is OrderStatus => Boolean(stage));
  }, [orderDraft, savedStages]);

  const hiddenNow = hiddenDraft ?? savedSettings.hidden;
  const layoutDirty = orderDraft !== null || hiddenDraft !== null;

  // Admin roles see every stage: their boxes are ticked and locked, and never saved
  const permissionsOf = (role: CrmRoleItem) =>
    isAdminRole(role)
      ? stages.map((stage) => projectStagePermId(stage.id))
      : (draft[role.id] ?? role.permission_ids ?? []);

  const changedRoles = roles.filter((role) => {
    const next = draft[role.id];
    if (!next || isAdminRole(role)) return false;
    const before = new Set(role.permission_ids ?? []);
    return next.length !== before.size || next.some((id) => !before.has(id));
  });

  const toggle = (role: CrmRoleItem, stageId: string, checked: boolean) => {
    const permId = projectStagePermId(stageId);
    const current = permissionsOf(role);
    const next = checked
      ? Array.from(new Set([...current, permId]))
      : current.filter((id) => id !== permId);
    setDraft((prev) => ({ ...prev, [role.id]: next }));
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const ids = stages.map((stage) => stage.id);
    [ids[index], ids[target]] = [ids[target] as string, ids[index] as string];
    setOrderDraft(ids);
  };

  const toggleHidden = (stageId: string) => {
    setHiddenDraft((prev) => {
      const current = prev ?? savedSettings.hidden;
      return current.includes(stageId)
        ? current.filter((id) => id !== stageId)
        : [...current, stageId];
    });
  };

  const discardLayout = () => {
    setOrderDraft(null);
    setHiddenDraft(null);
  };

  const saveLayout = async () => {
    setIsSavingLayout(true);
    try {
      await saveOrderStageSettings(
        stages.map((stage) => stage.id),
        hiddenNow,
      );
      await queryClient.invalidateQueries({ queryKey: ["order-stage-order"] });
      setOrderDraft(null);
      setHiddenDraft(null);
      toast.success("Project stage layout saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save stage layout");
    } finally {
      setIsSavingLayout(false);
    }
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await ensureProjectStagePermissions(stages);
      for (const role of changedRoles) {
        await onSaveRole({
          id: role.id,
          name: role.name,
          description: role.description,
          permission_ids: draft[role.id] ?? [],
        });
      }
      setDraft({});
      toast.success("Project stage access saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save project stage access");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Project stage access
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Tick the roles that may work on each project stage. Use the eye to hide a stage from the
            Projects board for everyone, and the arrows to change the column order.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {layoutDirty && (
            <>
              <Button
                variant="outline"
                onClick={discardLayout}
                disabled={isSavingLayout}
                className="cursor-pointer"
              >
                Discard layout
              </Button>
              <Button
                onClick={saveLayout}
                disabled={isSavingLayout}
                className="cursor-pointer bg-[#0a2e5c] text-white hover:bg-[#0b3364]"
              >
                {isSavingLayout && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save stage layout
              </Button>
            </>
          )}
          {changedRoles.length > 0 && (
            <span className="text-xs font-medium text-slate-500">
              {changedRoles.length} unsaved {changedRoles.length === 1 ? "role" : "roles"}
            </span>
          )}
          <Button
            onClick={save}
            disabled={changedRoles.length === 0 || isSaving}
            className="cursor-pointer bg-[#67B239] text-white hover:bg-[#5aa030]"
          >
            {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save stage access
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-card">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="w-28 px-3 py-3 text-center">Order</th>
              <th className="w-44 px-3 py-3">Stage</th>
              <th className="w-20 px-1 py-3 text-center">Board</th>
              {roles.map((role) => (
                <th key={role.id} className="px-1 py-3 text-center break-words">
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {stages.map((stage, index) => {
              const isHidden = hiddenNow.includes(stage.id);
              return (
                <tr
                  key={stage.id}
                  className={cn(
                    "hover:bg-slate-50/70 dark:hover:bg-slate-900/40",
                    isHidden && "bg-slate-50/60 text-slate-400 dark:bg-slate-900/30",
                  )}
                >
                  <td className="px-4 py-2 text-center">
                    <div className="inline-flex items-center gap-1">
                      <span className="w-5 text-xs tabular-nums text-slate-500">{index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => moveStage(index, -1)}
                        disabled={index === 0 || isSavingLayout}
                        aria-label={`Move ${stage.name} up`}
                        className="size-7 cursor-pointer"
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => moveStage(index, 1)}
                        disabled={index === stages.length - 1 || isSavingLayout}
                        aria-label={`Move ${stage.name} down`}
                        className="size-7 cursor-pointer"
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                    </div>
                  </td>
                  <th scope="row" className="px-4 py-2.5 font-medium">
                    <Badge
                      className={cn(
                        "rounded border-transparent font-medium",
                        isHidden && "opacity-60",
                      )}
                      style={{
                        backgroundColor: stage.color,
                        color: getContrastTextColor(stage.color),
                      }}
                    >
                      {stage.name}
                    </Badge>
                  </th>
                  <td className="px-1 py-2 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleHidden(stage.id)}
                      disabled={isSavingLayout}
                      title={
                        isHidden
                          ? `'${stage.name}' is hidden on the Projects board. Click to show.`
                          : `'${stage.name}' is shown on the Projects board. Click to hide.`
                      }
                      aria-label={
                        isHidden ? `Show ${stage.name} on board` : `Hide ${stage.name} from board`
                      }
                      className={cn(
                        "size-8 cursor-pointer rounded-md",
                        isHidden
                          ? "text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                          : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40",
                      )}
                    >
                      {isHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </td>
                  {roles.map((role) => {
                    const checked = permissionsOf(role).includes(projectStagePermId(stage.id));
                    return (
                      <td key={`${stage.id}-${role.id}`} className="px-1 py-2.5">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={checked}
                            disabled={isAdminRole(role)}
                            onCheckedChange={(value) => toggle(role, stage.id, Boolean(value))}
                            aria-label={`Allow ${role.name} on ${stage.name}`}
                            className="data-[state=checked]:border-[#67B239] data-[state=checked]:bg-[#67B239]"
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

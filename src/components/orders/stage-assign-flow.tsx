"use client";

import { useState } from "react";
import { toast } from "sonner";

import { AssignStageDialog } from "@/components/orders/assign-stage-dialog";
import { ContentPlannerBriefDialog } from "@/components/orders/content-planner-brief-dialog";
import { ScriptWriterRequirementsDialog } from "@/components/orders/script-writer-requirements-dialog";
import { VideographerBriefDialog } from "@/components/orders/videographer-brief-dialog";
import { StageBriefDialog } from "@/components/orders/stage-brief-dialog";
import { STAGE_BRIEF_CONFIG } from "@/components/orders/stage-brief-config";
import type { CrmUser } from "@/lib/admin-users";
import {
  saveOrderBrief,
  saveStageBrief,
  saveScriptWriterRequirements,
  saveVideographerBrief,
  type ContentPlannerBrief,
  type CrmOrder,
  type ScriptWriterRequirements,
  type VideographerBrief,
} from "@/lib/orders";

interface StageAssignFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: CrmOrder;
  statusId: string;
  users: CrmUser[];
  onAssign: (assignee: CrmUser, deadline: string | null) => Promise<void>;
  isSaving: boolean;
}

/**
 * Assign step for an assignable stage. Content Planner and Script Writer show their requirements
 * popup first; it is saved on the order, then the user picker opens.
 */
export function StageAssignFlow(props: StageAssignFlowProps) {
  const generic = STAGE_BRIEF_CONFIG[props.statusId];
  const briefStage =
    props.statusId === "content-planner" ||
    props.statusId === "script-writer" ||
    props.statusId === "videographer" ||
    Boolean(generic);
  const [briefDone, setBriefDone] = useState(!briefStage);

  if (!briefStage || briefDone) {
    return <AssignStageDialog {...props} />;
  }

  const finish = () => {
    toast.success("Saved", { description: `Requirements for ${props.order.order_number} saved.` });
    setBriefDone(true);
  };

  if (props.statusId === "script-writer") {
    const saveRequirements = async (requirements: ScriptWriterRequirements) => {
      await saveScriptWriterRequirements(props.order.id, requirements);
      finish();
    };
    return (
      <ScriptWriterRequirementsDialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        order={props.order}
        initial={props.order.script_writer_brief}
        onSave={saveRequirements}
      />
    );
  }

  if (props.statusId === "videographer") {
    const saveShootingBrief = async (brief: VideographerBrief) => {
      await saveVideographerBrief(props.order.id, brief);
      finish();
    };
    return (
      <VideographerBriefDialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        order={props.order}
        initial={props.order.videographer_brief}
        onSave={saveShootingBrief}
      />
    );
  }

  if (generic) {
    const saveGeneric = async (values: Record<string, string>) => {
      await saveStageBrief(props.order.id, generic.key, values);
      finish();
    };
    return (
      <StageBriefDialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        order={props.order}
        config={generic}
        initial={props.order.stage_briefs?.[generic.key] ?? null}
        onSave={saveGeneric}
      />
    );
  }

  const saveBrief = async (brief: ContentPlannerBrief) => {
    await saveOrderBrief(props.order.id, brief);
    finish();
  };

  return (
    <ContentPlannerBriefDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      order={props.order}
      initial={props.order.brief}
      onSave={saveBrief}
    />
  );
}

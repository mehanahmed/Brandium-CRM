"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { CreateOrderDialog } from "@/components/orders/create-order-dialog";
import { CreateQuotationDialog } from "@/components/quotations/create-quotation-dialog";
import { ScheduleMeetingDialog } from "@/components/schedule-meeting-dialog";
import { useAuth } from "@/lib/auth";
import { useSaveOrderMutation } from "@/lib/orders";
import type { Prospect } from "@/lib/prospects";
import { useSaveQuotationMutation } from "@/lib/quotations";
import { servicesQueryOptions } from "@/lib/services";
import { addStageNote } from "@/lib/stages";

export type LeadAction = { type: "order" | "quotation" | "meeting"; prospect: Prospect };

/**
 * Order, quotation and meeting dialogs opened from a lead. Each successful save adds an
 * activity to the lead's timeline, e.g. "[Order] ORD-123 created".
 */
export function LeadActionDialogs({
  action,
  onClose,
}: {
  action: LeadAction | null;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const services = useQuery(servicesQueryOptions());
  const saveOrder = useSaveOrderMutation();
  const saveQuotation = useSaveQuotationMutation();

  const logActivity = async (prospect: Prospect, text: string) => {
    const saved = await addStageNote({
      prospectId: prospect.id,
      stageId: prospect.stage_id ?? null,
      note: text,
      userId: user?.id || null,
      userName: profile?.full_name || user?.email || "User",
    });
    if (!saved) toast.error("Saved, but the activity could not be logged.");
    void queryClient.invalidateQueries({ queryKey: ["stage-history", prospect.id] });
    void queryClient.invalidateQueries({ queryKey: ["prospects"] });
  };

  if (!action) return null;
  const { prospect } = action;
  const serviceList = services.data || [];

  if (action.type === "order") {
    return (
      <CreateOrderDialog
        open
        onOpenChange={(open) => !open && onClose()}
        services={serviceList}
        allOrders={[]}
        initial={{
          companyName: prospect.business_name || prospect.contact_name || "",
          address: prospect.address || "",
          phone: prospect.phone || "",
        }}
        onSave={async (data) => {
          const res = await saveOrder.mutateAsync(data);
          await logActivity(
            prospect,
            `[Order] ${res?.order_number ? `${res.order_number} ` : ""}created · BDT ${Number(data.total_amount || 0).toLocaleString("en-US")}`,
          );
          onClose();
        }}
        isSaving={saveOrder.isPending}
      />
    );
  }

  if (action.type === "quotation") {
    return (
      <CreateQuotationDialog
        open
        onOpenChange={(open) => !open && onClose()}
        services={serviceList}
        allQuotations={[]}
        initial={{
          prospectId: prospect.id,
          contactPerson: prospect.contact_name || "",
          companyName: prospect.business_name || "",
          address: prospect.address || "",
          phone: prospect.phone || "",
        }}
        onSave={async (data) => {
          await saveQuotation.mutateAsync(data);
          await logActivity(
            prospect,
            `[Quotation] Quotation created · BDT ${Number(data.budget || 0).toLocaleString("en-US")}`,
          );
          onClose();
        }}
        isSaving={saveQuotation.isPending}
      />
    );
  }

  return (
    <ScheduleMeetingDialog
      open
      onOpenChange={(open) => !open && onClose()}
      defaultProspectId={prospect.id}
      onSuccess={(meeting) =>
        void logActivity(
          prospect,
          `[Meeting] ${meeting.meeting_type} meeting scheduled for ${meeting.meeting_date} ${meeting.meeting_time}`,
        )
      }
    />
  );
}

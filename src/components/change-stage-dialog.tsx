"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Bot,
  Briefcase,
  Building,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Edit,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  PhoneCall,
  PlusCircle,
  Receipt,
  Package,
  RefreshCw,
  StickyNote,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/components/orders/assign-stage-dialog";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";

import {
  stageHistoryQuery,
  deleteStageNote,
  addStageNote,
  formatStageSlugOrName,
  parseNotesToItems,
} from "@/lib/stages";
import type { Prospect } from "@/lib/prospects";
import { useAuth } from "@/lib/auth";
import { runMySQLQuery } from "@/lib/mysql-api";
import { cn } from "@/lib/utils";

export type ChangeStageTarget = {
  id: string;
  label: string;
  stageId: string | null;
  currentStageName?: string | null;
  prospect?: Prospect | null;
};

const ACTIVITY_TYPES = [
  "Follow-up Call",
  "Sent Proposal",
  "Meeting",
  "Site Visit",
  "Negotiation",
  "No Response",
  "Other",
] as const;

/** One contact fact: icon, screen-reader label, value that wraps instead of being cut off. */
function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <dt className="sr-only">{label}</dt>
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
      <dd className="min-w-0 text-slate-700 wrap-anywhere dark:text-slate-300">
        <span className="text-slate-500 dark:text-slate-400">{label} · </span>
        {value}
      </dd>
    </div>
  );
}

export interface ChangeStageDialogProps {
  target: ChangeStageTarget | null;
  onOpenChange: (open: boolean) => void;
  onStageChange?: (stageId: string, stageName: string) => void;
  onEditRequest?: (prospect: Prospect) => void;
  onBookMeeting?: (prospect: Prospect) => void;
  onCreateQuotation?: (prospect: Prospect) => void;
  onCreateOrder?: (prospect: Prospect) => void;
}

const formatDateSafe = (dateString?: string | null, includeTime: boolean = false) => {
  if (!dateString) return "No Date";
  try {
    const normalized = dateString.includes("T") ? dateString : dateString.replace(" ", "T");
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return "No Date";
    return format(parsed, includeTime ? "d MMM yyyy, h:mm a" : "d MMM yyyy");
  } catch {
    return "No Date";
  }
};

const getActivityIcon = (activityType: string) => {
  const norm = (activityType || "").toLowerCase();
  if (norm.includes("call") || norm.includes("phone")) {
    return <PhoneCall className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  }
  if (norm.includes("proposal") || norm.includes("invoice") || norm.includes("quotation")) {
    return <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
  }
  if (norm.includes("meeting")) {
    return <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
  }
  if (norm.includes("visit") || norm.includes("site") || norm.includes("location")) {
    return <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
  }
  if (norm.includes("negotiation") || norm.includes("chat") || norm.includes("message")) {
    return <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
  }
  if (norm.includes("created") || norm.includes("new lead")) {
    return <PlusCircle className="h-4 w-4 text-[#67B239]" />;
  }
  if (norm.includes("no response") || norm.includes("dnp")) {
    return <PhoneCall className="h-4 w-4 text-rose-500" />;
  }
  if (norm.includes("stage") || norm.includes("transition") || norm.includes("status")) {
    return <RefreshCw className="h-4 w-4 text-teal-600 dark:text-teal-400" />;
  }
  return <Activity className="h-4 w-4 text-[#67B239]" />;
};

function getBadgeStyle(stageName?: string | null, stageColor?: string | null) {
  if (stageColor) {
    return {
      style: {
        backgroundColor: `${stageColor}1A`,
        color: stageColor,
        borderColor: `${stageColor}33`,
      },
      className: "border",
    };
  }
  const name = (stageName || "").toLowerCase();
  if (name.includes("won") || name.includes("sales"))
    return { className: "bg-[#67B239]/15 text-[#55962e] border border-[#67B239]/30" };
  if (name.includes("prospect") || name.includes("lead"))
    return {
      className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30",
    };
  if (name.includes("follow"))
    return {
      className: "bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-500/30",
    };
  if (name.includes("opportunity"))
    return {
      className:
        "bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30",
    };
  if (name.includes("dnp"))
    return {
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30",
    };
  if (name.includes("switched"))
    return {
      className:
        "bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30",
    };
  if (name.includes("invalid"))
    return {
      className: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30",
    };
  if (name.includes("not_interested") || name.includes("not interested"))
    return {
      className: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30",
    };
  if (name.includes("denied"))
    return { className: "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30" };
  return { className: "bg-[#67B239]/15 text-[#55962e] border border-[#67B239]/30" };
}

export function ChangeStageDialog({
  target,
  onOpenChange,
  onStageChange,
  onEditRequest,
  onBookMeeting,
  onCreateQuotation,
  onCreateOrder,
}: ChangeStageDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  const [activityType, setActivityType] = useState<string>("Follow-up Call");
  const [note, setNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<{
    historyId: string;
    noteIndex: number;
  } | null>(null);
  const [isDeletingActivity, setIsDeletingActivity] = useState(false);

  // Fetch full prospect details if not fully provided
  const prospectQuery = useQuery({
    queryKey: ["prospect", target?.id],
    queryFn: async (): Promise<Prospect | null> => {
      if (!target?.id) return null;
      const res = await runMySQLQuery<Record<string, unknown>[]>(
        `SELECT 
          p.*,
          s.name AS service_name,
          COALESCE(st.name, p.stage_id, 'Prospect') AS stage_name,
          st.stage_group AS stage_group,
          st.color AS stage_color,
          st.icon AS stage_icon,
          COALESCE(prof_assign.full_name, u_assign.name) AS assigned_agent_name,
          COALESCE(prof_assign.avatar_url, u_assign.avatar_url) AS assigned_agent_avatar,
          COALESCE(prof_artist.full_name, u_artist.name) AS assigned_artist_name,
          COALESCE(prof_artist.avatar_url, u_artist.avatar_url) AS assigned_artist_avatar,
          COALESCE(prof_create.full_name, u_create.name, prof_assign.full_name, u_assign.name) AS creator_name,
          COALESCE(prof_create.avatar_url, u_create.avatar_url, prof_assign.avatar_url, u_assign.avatar_url) AS creator_avatar,
          (SELECT follow_up_due_at FROM \`prospect_stage_history\` WHERE prospect_id = p.id AND follow_up_due_at IS NOT NULL ORDER BY changed_at DESC LIMIT 1) AS follow_up_due_at
        FROM \`prospects\` p
        LEFT JOIN \`services\` s ON p.service_id = s.id
        LEFT JOIN \`stages\` st ON (p.stage_id = st.id OR p.stage_id = REPLACE(st.id, '-', '_') OR p.stage_id = st.name)
        LEFT JOIN \`users\` u_assign ON p.assigned_to = u_assign.id
        LEFT JOIN \`profiles\` prof_assign ON p.assigned_to = prof_assign.id
        LEFT JOIN \`users\` u_artist ON p.assigned_artist_id = u_artist.id
        LEFT JOIN \`profiles\` prof_artist ON p.assigned_artist_id = prof_artist.id
        LEFT JOIN \`users\` u_create ON p.created_by = u_create.id
        LEFT JOIN \`profiles\` prof_create ON p.created_by = prof_create.id
        WHERE p.id = ? LIMIT 1;`,
        [target.id],
      );
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        return res.data[0] as unknown as Prospect;
      }
      return null;
    },
    enabled: Boolean(target?.id),
    initialData: target?.prospect || undefined,
  });

  const prospect: (Prospect & { follow_up_due_at?: string | null }) | null =
    (prospectQuery.data as (Prospect & { follow_up_due_at?: string | null }) | null) ||
    (target?.prospect as (Prospect & { follow_up_due_at?: string | null }) | null) ||
    null;

  // Fetch full stage history for the prospect
  const historyQuery = useQuery({
    ...stageHistoryQuery(target?.id || ""),
    enabled: Boolean(target?.id),
  });

  const currentStageName =
    prospect?.stage_name ||
    target?.currentStageName ||
    formatStageSlugOrName(target?.stageId) ||
    "Prospect";

  // Reset form when target changes
  useEffect(() => {
    setActivityType("Follow-up Call");
    setNote("");
  }, [target]);

  // Combine and sort activity log items
  const activityHistory = useMemo(() => {
    const items: Array<{
      id: string;
      activity: string;
      timestamp: string;
      changedByUserName: string;
      notes: string;
      isInitial?: boolean;
      /** Set only for a note inside a stage history row; only those can be deleted here. */
      note?: { historyId: string; noteIndex: number };
    }> = [];

    const rawHistory = historyQuery.data ?? [];

    for (const h of rawHistory) {
      const rawName = h.to_stage_name || formatStageSlugOrName(h.to_stage_id) || "Stage Update";
      const actorName = h.changed_by_name || "System";
      const parsedNotes = parseNotesToItems(h.note, h.changed_at, actorName, h.changed_by_avatar);

      if (parsedNotes.length > 0) {
        for (const [noteIndex, pn] of parsedNotes.entries()) {
          // Notes are saved as "[Activity Type] text"; skip "[Artist: x]"-style tags.
          const tagged = /^\[([^\]:]+)\]\s*([\s\S]*)$/.exec(pn.text);
          items.push({
            id: `${h.id}-${pn.id || pn.createdAt || Math.random()}`,
            activity: tagged?.[1] || rawName,
            timestamp: pn.createdAt || h.changed_at,
            changedByUserName: pn.createdByName || actorName,
            notes: tagged ? (tagged[2] ?? "") : pn.text,
            note: { historyId: h.id, noteIndex },
          });
        }
      } else {
        items.push({
          id: h.id,
          activity: rawName,
          timestamp: h.changed_at,
          changedByUserName: actorName,
          notes: `Moved to ${rawName}`,
        });
      }
    }

    // Include Lead Created initial item if creation date is present
    if (prospect?.created_at) {
      const initialAuthor = prospect.creator_name || "System";
      const initialNote = prospect.notes || "Initial lead entry created.";
      const hasInitialAlready = items.some(
        (i) =>
          Math.abs(new Date(i.timestamp).getTime() - new Date(prospect.created_at).getTime()) <
          2000,
      );
      if (!hasInitialAlready) {
        items.push({
          id: `initial-${prospect.id}`,
          activity: "Lead Created",
          timestamp: prospect.created_at,
          changedByUserName: initialAuthor,
          notes: initialNote,
          isInitial: true,
        });
      }
    }

    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [historyQuery.data, prospect]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!target) return;
    if (!activityType.trim()) {
      toast.error("Please select an activity type.");
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmed = note.trim();
      const formattedNote = trimmed ? `[${activityType}] ${trimmed}` : `[${activityType}]`;

      const uRecord = user as Record<string, unknown> | null;
      const pRecord = profile as Record<string, unknown> | null;
      const currentUserName =
        profile?.full_name ||
        (user?.user_metadata?.["full_name"] as string) ||
        (uRecord?.["name"] as string) ||
        user?.email ||
        "User";
      const currentUserAvatar =
        (pRecord?.["avatar_url"] as string) ||
        (user?.user_metadata?.["avatar_url"] as string) ||
        null;

      const saved = await addStageNote({
        prospectId: target.id,
        stageId: target.stageId,
        note: formattedNote,
        userId: user?.id || null,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
      });
      if (!saved) throw new Error("Activity was not saved");

      queryClient.invalidateQueries({ queryKey: ["stage-history", target.id] });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      queryClient.invalidateQueries({ queryKey: ["prospects-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("New activity has been logged for this lead.");
      setNote("");
      setActivityType("Follow-up Call");
    } catch (err) {
      console.error("Failed to add activity:", err);
      toast.error("Failed to add activity. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteActivity = async () => {
    if (!target || !activityToDelete) return;
    setIsDeletingActivity(true);
    try {
      const removed = await deleteStageNote({
        prospectId: target.id,
        historyId: activityToDelete.historyId,
        noteIndex: activityToDelete.noteIndex,
      });
      if (!removed) throw new Error("Activity was not removed");
      toast.success("Activity removed from log.");
      queryClient.invalidateQueries({ queryKey: ["stage-history", target.id] });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      queryClient.invalidateQueries({ queryKey: ["prospects-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      console.error("Error deleting activity:", err);
      toast.error("Could not delete activity.");
    } finally {
      setIsDeletingActivity(false);
      setActivityToDelete(null);
    }
  };

  if (!target) return null;

  const contactName = prospect?.contact_name || target.label || "Unnamed Prospect";
  const businessName = prospect?.business_name || "";
  const phone = prospect?.phone || "";
  const altPhone = prospect?.alternative_phone || "";
  const address = prospect?.address || "";
  const email = prospect?.email || "";
  const source = prospect?.source || "Direct / Bot";
  const service = prospect?.service_name || "";
  const onboardingDate = prospect?.created_at ? formatDateSafe(prospect.created_at) : "N/A";
  const scheduleDate = prospect?.follow_up_due_at
    ? formatDateSafe(prospect.follow_up_due_at, true)
    : null;
  const agentName = prospect?.assigned_agent_name || "Unassigned";
  const agentAvatar = prospect?.assigned_agent_avatar || null;
  const notesText = prospect?.notes || "";
  const badgeMeta = getBadgeStyle(currentStageName, prospect?.stage_color);
  const waNumber = phone.replace(/[^0-9]/g, "");

  const goTo = (handler: ((p: Prospect) => void) | undefined, fallback: string) => {
    onOpenChange(false);
    if (handler && prospect) handler(prospect);
    else router.push(fallback);
  };

  return (
    <>
      <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-2xl lg:max-w-5xl max-h-[92vh] overflow-y-auto custom-scrollbar gap-0 p-0 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl bg-white dark:bg-card">
          {/* Header: who this lead is, and where it stands */}
          <DialogHeader className="flex-row items-center gap-3.5 space-y-0 border-b border-slate-100 dark:border-slate-800 px-6 py-5 pr-14 text-left">
            <Avatar className="size-12 shrink-0">
              {prospect?.logo_url && <AvatarImage src={prospect.logo_url} alt="" />}
              <AvatarFallback className="bg-[#0a2e5c] text-sm font-semibold text-white">
                {getInitials(contactName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-100 wrap-anywhere sm:text-xl">
                {contactName}
              </DialogTitle>
              <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                {businessName && (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Building className="size-3.5 shrink-0" aria-hidden />
                    <span className="wrap-anywhere">{businessName}</span>
                  </span>
                )}
                {!businessName && <span>Lead details</span>}
              </DialogDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize",
                badgeMeta.className,
              )}
              style={badgeMeta.style}
            >
              {currentStageName}
            </Badge>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            {/* Left: contact facts and next steps */}
            <aside className="space-y-5 border-b border-slate-100 p-6 dark:border-slate-800 lg:border-b-0 lg:border-r">
              <section aria-labelledby="lead-contact-heading" className="space-y-3">
                <h3
                  id="lead-contact-heading"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  Contact
                </h3>

                <div className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0 text-slate-400" aria-hidden />
                  <span className="min-w-0 flex-1 text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">
                    {phone || <span className="font-normal text-slate-400">No phone</span>}
                  </span>
                  {phone && (
                    <>
                      <a
                        href={`tel:${phone}`}
                        aria-label={`Call ${phone}`}
                        title="Call"
                        className="flex size-8 items-center justify-center rounded-lg text-[#55962e] transition-colors hover:bg-[#67B239]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B239]/50"
                      >
                        <PhoneCall className="size-4" />
                      </a>
                      <a
                        href={`https://wa.me/${waNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`WhatsApp ${phone}`}
                        title="WhatsApp"
                        className="flex size-8 items-center justify-center rounded-lg text-green-600 transition-colors hover:bg-green-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50 dark:text-green-400"
                      >
                        <WhatsAppIcon className="size-4" />
                      </a>
                    </>
                  )}
                </div>

                <dl className="space-y-2.5 text-sm">
                  {altPhone && <Fact icon={Phone} label="Alt. phone" value={altPhone} />}
                  {email && <Fact icon={Mail} label="Email" value={email} />}
                  {address && <Fact icon={MapPin} label="Address" value={address} />}
                  <Fact icon={Bot} label="Source" value={source} />
                  {service && <Fact icon={Briefcase} label="Service" value={service} />}
                  <Fact icon={CalendarDays} label="Onboarded" value={onboardingDate} />
                  <div className="flex items-center gap-2.5">
                    <dt className="sr-only">CR</dt>
                    <Avatar className="size-5 shrink-0">
                      {agentAvatar && <AvatarImage src={agentAvatar} alt="" />}
                      <AvatarFallback className="bg-slate-200 text-[9px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                        {getInitials(agentName)}
                      </AvatarFallback>
                    </Avatar>
                    <dd className="min-w-0 text-slate-700 dark:text-slate-300">
                      <span className="text-slate-500 dark:text-slate-400">CR · </span>
                      <span className="wrap-anywhere">{agentName}</span>
                    </dd>
                  </div>
                </dl>

                {scheduleDate && (
                  <p className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                    <CalendarClock className="size-4 shrink-0" aria-hidden />
                    Next follow-up: {scheduleDate}
                  </p>
                )}

                {notesText && (
                  <p className="flex gap-2 rounded-lg bg-amber-50/70 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <StickyNote className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="whitespace-pre-wrap wrap-anywhere">{notesText}</span>
                  </p>
                )}
              </section>

              <section
                aria-label="Next steps"
                className="space-y-2 border-t border-slate-100 pt-5 dark:border-slate-800"
              >
                {onCreateOrder && prospect && (
                  <Button
                    type="button"
                    onClick={() => goTo(onCreateOrder, "/orders")}
                    className="h-10 w-full gap-2 rounded-xl bg-[#67B239] text-sm font-semibold text-white hover:bg-[#5aa030] cursor-pointer"
                  >
                    <Package className="size-4" /> Create Order
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      goTo(
                        onBookMeeting,
                        `/meetings?search=${encodeURIComponent(contactName || businessName)}`,
                      )
                    }
                    className="h-10 gap-1.5 rounded-xl text-sm font-medium cursor-pointer"
                  >
                    <CalendarPlus className="size-4 text-[#55962e]" /> Meeting
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      goTo(
                        onCreateQuotation,
                        `/quotations?search=${encodeURIComponent(businessName || contactName)}`,
                      )
                    }
                    className="h-10 gap-1.5 rounded-xl text-sm font-medium cursor-pointer"
                  >
                    <Receipt className="size-4 text-[#55962e]" /> Quotation
                  </Button>
                </div>
                {onEditRequest && prospect && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      onOpenChange(false);
                      onEditRequest(prospect);
                    }}
                    className="h-9 w-full gap-1.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    <Edit className="size-4" /> Edit lead
                  </Button>
                )}
              </section>
            </aside>

            {/* Right: what happened, and logging what happens next */}
            <section aria-labelledby="lead-activity-heading" className="flex min-w-0 flex-col p-6">
              <div className="mb-3 flex items-center justify-between">
                <h3
                  id="lead-activity-heading"
                  className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                  <Activity className="size-4 text-[#67B239]" aria-hidden /> Activity
                </h3>
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {activityHistory.length} {activityHistory.length === 1 ? "entry" : "entries"}
                </span>
              </div>

              {/* Plain scroll box: Radix ScrollArea lets wrapping text overflow inside dialogs */}
              <div className="max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                {historyQuery.isLoading ? (
                  <p className="flex items-center gap-2 py-10 text-sm text-slate-500">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Loading activity...
                  </p>
                ) : activityHistory.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    No activity yet. Log the first call or meeting below.
                  </p>
                ) : (
                  <ol className="relative space-y-1">
                    {activityHistory.map((item, index) => (
                      <li
                        key={item.id}
                        className="group relative flex gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        {index < activityHistory.length - 1 && (
                          <span
                            className="absolute left-6 top-11 bottom-0 w-px bg-slate-200 dark:bg-slate-700"
                            aria-hidden
                          />
                        )}
                        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                          {getActivityIcon(item.activity)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {item.activity}
                            </p>
                            <time
                              dateTime={item.timestamp}
                              className="text-xs tabular-nums text-slate-500 dark:text-slate-400"
                            >
                              {formatDateSafe(item.timestamp, true)}
                            </time>
                          </div>
                          {item.notes && (
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 wrap-anywhere dark:text-slate-300">
                              {item.notes}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            by {item.changedByUserName}
                          </p>
                        </div>
                        {item.note && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 rounded-lg text-slate-400 opacity-60 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100 dark:hover:bg-red-950/40 cursor-pointer"
                            onClick={() => setActivityToDelete(item.note ?? null)}
                            aria-label={`Delete activity: ${item.activity}`}
                            title="Delete activity"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <form
                onSubmit={handleSubmit}
                className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40"
              >
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Log activity
                  </legend>
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="radiogroup"
                    aria-label="Activity type"
                  >
                    {ACTIVITY_TYPES.map((type) => {
                      const isActive = activityType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          onClick={() => setActivityType(type)}
                          className={cn(
                            "h-8 rounded-full border px-3 text-xs font-medium transition-colors cursor-pointer",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B239]/50",
                            isActive
                              ? "border-[#67B239] bg-[#67B239] text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-[#67B239]/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                          )}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                <Label htmlFor="activity-notes" className="sr-only">
                  Activity notes
                </Label>
                <Textarea
                  id="activity-notes"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  placeholder="What happened? (optional)"
                  className="min-h-20 rounded-lg bg-white text-sm dark:bg-slate-900"
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="hidden text-xs text-slate-500 sm:inline dark:text-slate-400">
                    Ctrl + Enter to save
                  </span>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="ml-auto h-9 gap-1.5 rounded-lg bg-[#67B239] px-4 text-sm font-semibold text-white hover:bg-[#5aa030] cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      "Add activity"
                    )}
                  </Button>
                </div>
              </form>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Activity Confirmation Dialog */}
      {activityToDelete && (
        <AlertDialog open={!!activityToDelete} onOpenChange={() => setActivityToDelete(null)}>
          <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-slate-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                <AlertTriangle className="size-5 text-red-500" /> Delete Activity?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-500 dark:text-slate-400 pt-2 leading-relaxed">
                Are you sure you want to delete this activity entry? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel
                onClick={() => setActivityToDelete(null)}
                disabled={isDeletingActivity}
                className="text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteActivity}
                disabled={isDeletingActivity}
                className="text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                {isDeletingActivity ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" /> Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

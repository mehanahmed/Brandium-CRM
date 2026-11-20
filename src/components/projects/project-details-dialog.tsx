"use client";

import React, { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  Check,
  ClipboardList,
  Clock,
  Code2,
  Compass,
  Copy,
  ExternalLink,
  FileText,
  Film,
  Globe,
  HelpCircle,
  Link2,
  ListChecks,
  Megaphone,
  Package,
  Pencil,
  Plus,
  Quote,
  ScrollText,
  Scissors,
  Share2,
  Target,
  UserCheck,
  Video,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ScriptWriterRequirementsDialog } from "@/components/orders/script-writer-requirements-dialog";
import { ContentPlannerBriefDialog } from "@/components/orders/content-planner-brief-dialog";
import { VideographerBriefDialog } from "@/components/orders/videographer-brief-dialog";
import { StageBriefDialog } from "@/components/orders/stage-brief-dialog";
import { STAGE_BRIEF_CONFIG, type StageBriefConfig } from "@/components/orders/stage-brief-config";
import {
  EMPTY_CONTENT_PLANNER_BRIEF,
  EMPTY_SCRIPT_WRITER_REQUIREMENTS,
  EMPTY_VIDEOGRAPHER_BRIEF,
  FOOTAGE_STAGE_ID,
  resolveOrderStatus,
  saveOrderBrief,
  saveScriptWriterRequirements,
  saveStageBrief,
  saveVideographerBrief,
  type CrmOrder,
  type OrderStatusHistoryEntry,
  type ScriptWriterRequirements,
} from "@/lib/orders";
import { cn } from "@/lib/utils";
import { useUserName } from "@/lib/user-names";

interface ProjectDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: CrmOrder;
}

// Brand social icons, same artwork as the Motion Box project details popup
function FacebookIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function YouTubeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function InstagramIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function TikTokIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.86 4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-.04-4.52z" />
    </svg>
  );
}

type FilterKey = "all" | "creative" | "context" | "guardrails";
type SectionKey =
  "requirements" | "content" | "shoot" | "edit" | "final" | "marketing" | "developer";

const SECTION_META: Record<SectionKey, { label: string; icon: React.ElementType }> = {
  requirements: { label: "Requirements", icon: ClipboardList },
  content: { label: "Content plan", icon: ScrollText },
  shoot: { label: "Shoot", icon: Camera },
  edit: { label: "Edit", icon: Scissors },
  final: { label: "Final project", icon: Film },
  marketing: { label: "Marketing", icon: Megaphone },
  developer: { label: "Developer", icon: Code2 },
};

/** Stage whose move note carries the final project link ("Link: <url>" or "PDF: <path>"). */
const FINAL_STAGE = "delivered";

/** Latest "Link: <url>" / "PDF: <path>" left in a move note when the order entered `stage`. */
function latestStageLink(order: CrmOrder, stage: string) {
  const history: OrderStatusHistoryEntry[] = order.status_history || [];
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (!entry || entry.status !== stage) continue;
    const m = /(Link|PDF):\s*(\S+)/i.exec(entry.notes || "");
    if (m) {
      return {
        url: m[2] as string,
        isPdf: (m[1] as string).toUpperCase() === "PDF",
        at: entry.timestamp,
        by: entry.changedByUserName,
        byId: entry.changedByUserId ?? null,
      };
    }
  }
  return null;
}

/** Free-text brief fields rendered as cards; `group` drives the filter chips. */
const TEXT_FIELDS: Array<{
  key: keyof ScriptWriterRequirements;
  label: string;
  icon: React.ElementType;
  group: Exclude<FilterKey, "all">;
  warn?: boolean;
}> = [
  { key: "messageDelivery", label: "Message delivery", icon: Quote, group: "creative" },
  { key: "callToAction", label: "Call to action", icon: Megaphone, group: "creative" },
  { key: "productDetails", label: "Product / service details", icon: Package, group: "context" },
  { key: "keyPoints", label: "Key points to highlight", icon: ListChecks, group: "context" },
  { key: "painPoints", label: "Customer pain points", icon: HelpCircle, group: "context" },
  { key: "targetAudience", label: "Target audience", icon: Target, group: "context" },
  {
    key: "importantNotes",
    label: "Important notes & must avoid",
    icon: AlertTriangle,
    group: "guardrails",
    warn: true,
  },
];

const RATIO_INFO: Record<string, { label: string; icons: React.ReactNode }> = {
  "9:16": {
    label: "Vertical · Reels / TikTok / Story",
    icons: (
      <>
        <TikTokIcon className="h-3.5 w-3.5" />
        <InstagramIcon className="h-3.5 w-3.5 text-[#E4405F]" />
      </>
    ),
  },
  "16:9": {
    label: "Landscape · YouTube / Desktop",
    icons: <YouTubeIcon className="h-3.5 w-3.5 text-[#FF0000]" />,
  },
  "1:1": {
    label: "Square · Feed post",
    icons: <InstagramIcon className="h-3.5 w-3.5 text-[#E4405F]" />,
  },
  "4:5": {
    label: "Portrait · Instagram",
    icons: <InstagramIcon className="h-3.5 w-3.5 text-[#E4405F]" />,
  },
};

const formatExternalUrl = (url?: string) => {
  if (!url) return "";
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
};

const URL_SPLIT = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

/** Renders plain text with every http(s)/www link as a clickable link that opens in a new tab. */
function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_SPLIT).map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={formatExternalUrl(part)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="break-all text-[#0a2e5c] underline underline-offset-2 hover:text-[#67B239] dark:text-[#7ac142] dark:hover:text-[#67B239]"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

const formatWhen = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

/** Small icon-only copy button with a check confirmation. */
function CopyButton({
  copied,
  onClick,
  label,
  tone = "default",
}: {
  copied: boolean;
  onClick: () => void;
  label: string;
  tone?: "default" | "warn";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      className={cn(
        "h-7 w-7 shrink-0 rounded-lg inline-flex items-center justify-center transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tone === "warn"
          ? "text-amber-700/70 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-300/70 dark:hover:text-amber-200"
          : "text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

/** Empty state shared by every tab. */
function EmptyPanel({
  icon: Icon,
  title,
  hint,
  stageName,
  onEdit,
}: {
  icon: React.ElementType;
  title: string;
  hint: string;
  stageName?: string;
  onEdit?: (() => void) | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 px-6 py-14 text-center">
      <div className="relative mb-5">
        <div
          className="absolute inset-0 -m-3 rounded-full bg-primary/10 blur-xl"
          aria-hidden="true"
        />
        <div className="relative h-14 w-14 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 shadow-sm flex items-center justify-center text-slate-400 dark:text-zinc-500">
          <Icon className="h-6 w-6 stroke-[1.5]" />
        </div>
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
        {title}
      </h3>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
        {hint}
        {stageName && (
          <>
            {" "}
            <span className="inline-flex items-center rounded-full bg-slate-200/70 dark:bg-zinc-800 px-2 py-0.5 font-medium text-slate-700 dark:text-zinc-300">
              {stageName}
            </span>
          </>
        )}
      </p>
      {onEdit && (
        <Button
          type="button"
          size="sm"
          onClick={onEdit}
          className="mt-5 h-9 rounded-full bg-[#67B239] px-5 text-xs font-medium text-white shadow-lg shadow-green-700/20 hover:bg-[#5aa030]"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add brief
        </Button>
      )}
    </div>
  );
}

/** Final project tab: the link left in the move note when the order was delivered. */
function StageLinkPanel({ order }: { order: CrmOrder }) {
  const [copied, setCopied] = useState(false);
  const link = latestStageLink(order, FINAL_STAGE);
  // Current name by user id (the history entry keeps the name from when it was saved)
  const nameOf = useUserName();
  const linkBy = link ? nameOf(link.byId, link.by) : "";
  const Icon = SECTION_META.final.icon;

  if (!link) {
    return (
      <EmptyPanel
        icon={Icon}
        title="No final project yet"
        hint="The link shows up here as soon as the order is moved to"
        stageName={resolveOrderStatus(FINAL_STAGE).name}
      />
    );
  }

  const absolute =
    link.isPdf && typeof window !== "undefined"
      ? new URL(link.url, window.location.origin).href
      : link.url;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed", { description: "Could not copy the link." });
    }
  };

  let host = "";
  try {
    host = new URL(absolute).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.18)]">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-[#67B239] to-[#4a8a25] text-white flex items-center justify-center shadow-lg shadow-green-700/25">
            {link.isPdf ? <FileText className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
                Final project
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#67B239]/15 px-2 py-0.5 text-[11px] font-medium text-[#55962e] dark:text-[#7ac142]">
                <Check className="h-3 w-3" /> Submitted
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
              {linkBy && (
                <span className="inline-flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  {linkBy}
                </span>
              )}
              {link.at && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatWhen(link.at)}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* URL "address bar" */}
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/60 p-1.5 pl-3">
          {link.isPdf ? (
            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700 hover:text-primary dark:text-zinc-300"
            title={absolute}
          >
            {link.isPdf ? (link.url.split("/").pop() ?? link.url) : absolute}
          </a>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy link"
            className="h-8 shrink-0 rounded-xl px-2.5 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <Button
            type="button"
            size="sm"
            asChild
            className="h-8 shrink-0 rounded-xl px-3 text-xs shadow-sm"
          >
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open
            </a>
          </Button>
        </div>
        {host && !link.isPdf && (
          <p className="mt-2 pl-1 text-[11px] text-slate-400 dark:text-zinc-500">
            Hosted on {host}
          </p>
        )}
      </div>
    </div>
  );
}

type BriefRow = { label: string; value: string; wide?: boolean | undefined };

/** One detail as a card: numbered tile on the left, title + text in the middle, copy action on the right. */
/** One detail as a mail-style row: name and number on top, bold subject, grey preview below. */
function DetailRow({
  index,
  label,
  value,
  warn = false,
  copied,
  onCopy,
}: {
  index: number;
  icon: React.ElementType;
  label: string;
  value: string;
  warn?: boolean | undefined;
  copied: boolean;
  onCopy: () => void;
}) {
  const [subject, ...rest] = value.split("\n");
  const preview = rest.join(" ").trim();
  return (
    <li className="space-y-1 py-4 first:pt-4 last:pb-4">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
          {label}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-zinc-500">
            No. {String(index).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={onCopy}
            aria-label={`Copy ${label}`}
            className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full px-2 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-900 hover:text-white dark:text-zinc-400 dark:hover:bg-white dark:hover:text-zinc-900"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <p
        className={cn(
          "truncate text-sm font-semibold select-text",
          warn ? "text-amber-800 dark:text-amber-200" : "text-slate-800 dark:text-zinc-200",
        )}
      >
        <Linkified text={subject ?? ""} />
      </p>
      {preview && (
        <p className="line-clamp-2 text-[13px] leading-relaxed text-slate-400 select-text dark:text-zinc-500">
          <Linkified text={preview} />
        </p>
      )}
    </li>
  );
}

const hasFilled = (rows: BriefRow[]) => rows.some((row) => row.value.trim().length > 0);

/** Read-only brief tab for the Content Planner, Videographer, Editor, Marketer and Developer briefs. */
function BriefPanel({
  rows,
  title,
  icon: Icon,
  hint,
  stageName,
  onEdit,
}: {
  rows: BriefRow[];
  title: string;
  icon: React.ElementType;
  hint: string;
  stageName: string;
  onEdit: () => void;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const filled = rows.filter((row) => row.value.trim().length > 0);
  if (filled.length === 0) {
    return (
      <EmptyPanel
        icon={Icon}
        title={`No ${title.toLowerCase()} details yet`}
        hint={hint}
        stageName={stageName}
        onEdit={onEdit}
      />
    );
  }
  const handleCopy = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success("Copied", { description: `${label} copied to clipboard.` });
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const copyAll = () =>
    handleCopy(
      filled.map((row) => `${row.label}\n${row.value}`).join("\n\n"),
      "full-brief",
      `${title} brief`,
    );

  return (
    <div className="space-y-4">
      {/* Same toolbar as the Motion Box requirements tab */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={copyAll}
          className="h-7 rounded-full bg-white px-3 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 hover:text-slate-900 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copiedKey === "full-brief" ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
          {copiedKey === "full-brief" ? "Copied" : "Copy brief"}
        </button>
      </div>
      <ul className="divide-y divide-slate-200 rounded-2xl bg-white px-5 ring-1 ring-inset ring-slate-200/80 dark:divide-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
        {filled.map((row, i) => (
          <DetailRow
            key={row.label}
            index={i + 1}
            icon={Icon}
            label={row.label}
            value={row.value}
            copied={copiedKey === row.label}
            onCopy={() => handleCopy(row.value, row.label, row.label)}
          />
        ))}
      </ul>
    </div>
  );
}

const contentRows = (order: CrmOrder): BriefRow[] => {
  const b = order.brief ?? EMPTY_CONTENT_PLANNER_BRIEF;
  return [
    { label: "Script drive link", value: b.driveLink },
    { label: "Reference", value: b.reference },
    { label: "Model / artist names", value: b.modelArtistNames },
    { label: "Location", value: b.location },
    { label: "Aspect ratio", value: b.aspectRatio },
    { label: "Shooting brief", value: b.shootingBrief, wide: true },
    { label: "Special notes", value: b.specialNotes, wide: true },
  ];
};

const shootRows = (order: CrmOrder): BriefRow[] => {
  const v = order.videographer_brief ?? EMPTY_VIDEOGRAPHER_BRIEF;
  return [
    { label: "Script for director", value: v.scriptForDirector, wide: true },
    { label: "Camera setup", value: v.cameraSetup },
    { label: "Shooting location", value: v.shootingLocation },
    { label: "Artist / talent", value: v.artistTalent },
    { label: "Special notes", value: v.specialNotes, wide: true },
    // Footage link saved when the order moved to Video Graphy Complete
    { label: "Footage drive link", value: latestStageLink(order, FOOTAGE_STAGE_ID)?.url ?? "" },
  ];
};

/** Rows for a generic stage brief, labelled from its config (numbering stripped). */
const configRows = (order: CrmOrder, config: StageBriefConfig | undefined): BriefRow[] => {
  if (!config) return [];
  const values: Record<string, string> = order.stage_briefs?.[config.key] ?? {};
  return config.fields.map((field) => ({
    label: field.label.replace(/^\d+\.\s*/, ""),
    value: values[field.key] ?? "",
    wide: field.multiline,
  }));
};

/**
 * Project details popup for an order (Motion Box "Project details" design). Tabs follow the
 * Brandium production flow; Marketing and Developer appear only when the order reached them.
 */
export function ProjectDetailsDialog({ open, onOpenChange, order }: ProjectDetailsDialogProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [section, setSection] = useState<SectionKey>("requirements");
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  // Brief editor opened from a tab; saving only stores the brief, it never assigns the order
  const [editingBrief, setEditingBrief] = useState<SectionKey | null>(null);
  const openBriefEditor = (key: SectionKey) => {
    setSection(key);
    onOpenChange(false);
    setEditingBrief(key);
  };
  const closeBriefEditor = () => {
    setEditingBrief(null);
    onOpenChange(true);
  };
  const editBrief = STAGE_BRIEF_CONFIG["video-editor"];
  const marketingBrief = STAGE_BRIEF_CONFIG["marketer"];
  const developerBrief = STAGE_BRIEF_CONFIG["developer"];

  const req: ScriptWriterRequirements =
    order.script_writer_brief ?? EMPTY_SCRIPT_WRITER_REQUIREMENTS;
  const hasRestriction =
    !!req.modelRestrictions.trim() && req.modelRestrictions !== "No Restrictions";
  const hasAnyData = Object.values(req).some((value) => value.trim().length > 0);

  const editRows = configRows(order, STAGE_BRIEF_CONFIG["video-editor"]);
  const marketingRows = configRows(order, STAGE_BRIEF_CONFIG["marketer"]);
  const developerRows = configRows(order, STAGE_BRIEF_CONFIG["developer"]);
  const stageSeen = (id: string) =>
    order.status === id || order.status_history.some((entry) => entry.status === id);
  const showMarketing = stageSeen("marketer") || hasFilled(marketingRows);
  const showDeveloper = stageSeen("developer") || hasFilled(developerRows);

  const sections: SectionKey[] = [
    "requirements",
    "content",
    "shoot",
    "edit",
    "final",
    ...(showMarketing ? (["marketing"] as const) : []),
    ...(showDeveloper ? (["developer"] as const) : []),
  ];

  const done: Record<SectionKey, boolean> = {
    requirements: hasAnyData,
    content: hasFilled(contentRows(order)),
    shoot: hasFilled(shootRows(order)),
    edit: hasFilled(editRows),
    final: !!latestStageLink(order, FINAL_STAGE),
    marketing: hasFilled(marketingRows),
    developer: hasFilled(developerRows),
  };
  const doneCount = sections.filter((key) => done[key]).length;
  const active: SectionKey = sections.includes(section) ? section : "requirements";
  const onRequirements = active === "requirements";
  // Brief tabs (not Requirements, not the Final link) get the footer "Edit brief" button
  const isBriefTab = active !== "requirements" && active !== "final";

  const handleCopyText = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success("Copied", { description: `${label} copied to clipboard.` });
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const hasLinks = !!(
    req.facebookPageLink ||
    req.websiteLink ||
    req.competitorReferences ||
    req.brandLogoUrl
  );
  const ratio = req.videoRatio ? RATIO_INFO[req.videoRatio] : undefined;

  const title = order.items[0]?.model || order.company_name;
  const edit = () => {
    onOpenChange(false);
    setRequirementsOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          hideClose
          className="max-w-3xl max-h-[90vh] flex flex-col p-0 sm:p-0 gap-0 sm:gap-0 overflow-hidden rounded-[28px] sm:rounded-[28px] border-0 bg-white dark:bg-zinc-950 shadow-[0_32px_80px_-16px_rgba(15,23,42,0.35)]"
        >
          <MotionConfig reducedMotion="user">
            {/* Hero header */}
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#0a2e5c] via-[#0b3364] to-[#14497f] px-5 pb-3.5 pt-4 text-white sm:px-6">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/15 blur-3xl"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -bottom-24 left-10 h-48 w-48 rounded-full bg-[#67B239]/25 blur-3xl"
                aria-hidden="true"
              />

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Title and description stay for screen readers; the visible header text is removed */}
              <div className="sr-only">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>
                  {order.order_number} · {order.company_name}
                </DialogDescription>
              </div>

              {/* Tabs */}
              <div className="relative mt-3">
                <div
                  role="tablist"
                  aria-label="Project details"
                  className="flex flex-wrap gap-1 rounded-2xl bg-black/20 p-1 ring-1 ring-inset ring-white/10 backdrop-blur-md"
                >
                  {sections.map((key) => {
                    const { label, icon: Icon } = SECTION_META[key];
                    const isActive = active === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        id={`pd-tab-${key}`}
                        aria-selected={isActive}
                        aria-controls="pd-panel"
                        onClick={() => setSection(key)}
                        className={cn(
                          "relative flex min-w-28 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-medium transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                          isActive ? "text-[#0a2e5c]" : "text-white/80 hover:text-white",
                        )}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="pd-tab-pill"
                            className="absolute inset-0 rounded-xl bg-white shadow-md"
                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                            aria-hidden="true"
                          />
                        )}
                        <span className="relative inline-flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5" />
                          <span className="truncate">{label}</span>
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              done[key]
                                ? "bg-[#67B239]"
                                : isActive
                                  ? "bg-slate-300"
                                  : "bg-white/35",
                            )}
                            aria-label={done[key] ? "done" : "pending"}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Body */}
            <div
              id="pd-panel"
              role="tabpanel"
              aria-labelledby={`pd-tab-${active}`}
              className="flex-1 overflow-y-auto bg-slate-50/70 px-5 py-5 dark:bg-zinc-950 sm:px-7"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  {active === "final" ? (
                    <StageLinkPanel order={order} />
                  ) : active === "content" ? (
                    <BriefPanel
                      rows={contentRows(order)}
                      title="Content plan"
                      icon={SECTION_META.content.icon}
                      hint="The content plan shows up here once a Content Planner brief is saved for"
                      stageName={resolveOrderStatus("content-planner").name}
                      onEdit={() => openBriefEditor("content")}
                    />
                  ) : active === "shoot" ? (
                    <BriefPanel
                      rows={shootRows(order)}
                      title="Shoot"
                      icon={SECTION_META.shoot.icon}
                      hint="The shoot brief shows up here once a Videographer brief is saved for"
                      stageName={resolveOrderStatus("videographer").name}
                      onEdit={() => openBriefEditor("shoot")}
                    />
                  ) : active === "edit" ? (
                    <BriefPanel
                      rows={editRows}
                      title="Edit"
                      icon={SECTION_META.edit.icon}
                      hint="The edit brief shows up here once a Video Editor brief is saved for"
                      stageName={resolveOrderStatus("video-editor").name}
                      onEdit={() => openBriefEditor("edit")}
                    />
                  ) : active === "marketing" ? (
                    <BriefPanel
                      rows={marketingRows}
                      title="Marketing"
                      icon={SECTION_META.marketing.icon}
                      hint="The marketing brief shows up here once a Marketer brief is saved for"
                      stageName={resolveOrderStatus("marketer").name}
                      onEdit={() => openBriefEditor("marketing")}
                    />
                  ) : active === "developer" ? (
                    <BriefPanel
                      rows={developerRows}
                      title="Developer"
                      icon={SECTION_META.developer.icon}
                      hint="The developer brief shows up here once a Developer brief is saved for"
                      stageName={resolveOrderStatus("developer").name}
                      onEdit={() => openBriefEditor("developer")}
                    />
                  ) : !hasAnyData ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 px-6 py-14 text-center">
                      <div className="relative mb-5">
                        <div
                          className="absolute inset-0 -m-3 rounded-full bg-primary/10 blur-xl"
                          aria-hidden="true"
                        />
                        <div className="relative h-14 w-14 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 shadow-sm flex items-center justify-center text-slate-400 dark:text-zinc-500">
                          <ClipboardList className="h-6 w-6 stroke-[1.5]" />
                        </div>
                      </div>
                      <h3 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
                        No requirements yet
                      </h3>
                      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                        Add the creative brief — format, casting, brand links and key messages — so
                        the script writer can start.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={edit}
                        className="mt-5 h-9 rounded-full px-5 text-xs font-medium shadow-lg shadow-green-700/20 bg-[#67B239] text-white hover:bg-[#5aa030]"
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add requirements
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Spec rows: same mail-style list as the text details */}
                      {(req.videoRatio || hasRestriction || hasLinks) && (
                        <ul className="divide-y divide-slate-200 rounded-2xl bg-white px-5 ring-1 ring-inset ring-slate-200/80 dark:divide-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
                          {req.videoRatio && (
                            <li className="space-y-1 py-4 first:pt-4 last:pb-4">
                              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
                                <Video className="h-4 w-4 shrink-0 text-slate-400" /> Format
                              </span>
                              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                                {req.videoRatio}
                              </p>
                              <p className="flex items-center gap-1.5 text-[13px] text-slate-400 dark:text-zinc-500">
                                {ratio?.icons}
                                <span>{ratio?.label || "Custom ratio"}</span>
                              </p>
                            </li>
                          )}
                          {hasRestriction && (
                            <li className="space-y-1 py-4 first:pt-4 last:pb-4">
                              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
                                <UserCheck className="h-4 w-4 shrink-0 text-slate-400" /> Casting
                              </span>
                              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                                {req.modelRestrictions}
                              </p>
                              <p className="text-[13px] text-slate-400 dark:text-zinc-500">
                                Model & talent restriction
                              </p>
                            </li>
                          )}
                          {hasLinks && (
                            <li className="space-y-2 py-4 first:pt-4 last:pb-4">
                              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
                                <Globe className="h-4 w-4 shrink-0 text-slate-400" /> Brand channels
                                & assets
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {req.facebookPageLink && (
                                  <a
                                    href={formatExternalUrl(req.facebookPageLink)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200/80 transition hover:-translate-y-px hover:bg-white hover:shadow-sm dark:bg-zinc-800/60 dark:text-zinc-200 dark:ring-zinc-700"
                                  >
                                    <FacebookIcon className="h-3.5 w-3.5 text-[#1877F2]" /> Facebook
                                    <ExternalLink className="h-3 w-3 text-slate-400 transition group-hover:text-slate-600" />
                                  </a>
                                )}
                                {req.websiteLink && (
                                  <a
                                    href={formatExternalUrl(req.websiteLink)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200/80 transition hover:-translate-y-px hover:bg-white hover:shadow-sm dark:bg-zinc-800/60 dark:text-zinc-200 dark:ring-zinc-700"
                                  >
                                    <Globe className="h-3.5 w-3.5 text-emerald-600" /> Website
                                    <ExternalLink className="h-3 w-3 text-slate-400 transition group-hover:text-slate-600" />
                                  </a>
                                )}
                                {req.brandLogoUrl && (
                                  <a
                                    href={req.brandLogoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200/80 transition hover:-translate-y-px hover:bg-white hover:shadow-sm dark:bg-zinc-800/60 dark:text-zinc-200 dark:ring-zinc-700"
                                  >
                                    <img
                                      src={req.brandLogoUrl}
                                      alt=""
                                      className="h-4 w-4 rounded object-contain"
                                    />{" "}
                                    Brand logo
                                    <ExternalLink className="h-3 w-3 text-slate-400 transition group-hover:text-slate-600" />
                                  </a>
                                )}
                                {req.competitorReferences && (
                                  <div className="inline-flex max-w-full items-center gap-2 rounded-xl bg-slate-50 py-1 pl-3 pr-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200/80 dark:bg-zinc-800/60 dark:text-zinc-200 dark:ring-zinc-700">
                                    <Compass className="h-3.5 w-3.5 shrink-0 text-primary" />
                                    <span className="truncate">
                                      <Linkified text={req.competitorReferences} />
                                    </span>
                                    <CopyButton
                                      copied={copiedKey === "ref"}
                                      label="reference"
                                      onClick={() =>
                                        handleCopyText(req.competitorReferences, "ref", "Reference")
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                            </li>
                          )}
                        </ul>
                      )}

                      {/* Text sections */}
                      <ul className="divide-y divide-slate-200 rounded-2xl bg-white px-5 ring-1 ring-inset ring-slate-200/80 dark:divide-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
                        {TEXT_FIELDS.filter((f) => req[f.key].trim()).map((f, i) => (
                          <DetailRow
                            key={f.key}
                            index={i + 1}
                            icon={f.icon}
                            label={f.label}
                            value={req[f.key]}
                            warn={f.warn}
                            copied={copiedKey === f.key}
                            onCopy={() => handleCopyText(req[f.key], f.key, f.label)}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200/70 bg-white px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-950 sm:px-7">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-9 rounded-full px-4 text-xs font-medium text-slate-600 dark:text-zinc-300"
              >
                Close
              </Button>
              {onRequirements && hasAnyData && (
                <Button
                  type="button"
                  size="sm"
                  onClick={edit}
                  className="h-9 rounded-full px-5 text-xs font-medium shadow-lg shadow-green-700/20 bg-[#67B239] text-white hover:bg-[#5aa030]"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit requirements
                </Button>
              )}
              {isBriefTab && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openBriefEditor(active)}
                  className="h-9 rounded-full px-5 text-xs font-medium shadow-lg shadow-green-700/20 bg-[#67B239] text-white hover:bg-[#5aa030]"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit brief
                </Button>
              )}
            </div>
          </MotionConfig>
        </DialogContent>
      </Dialog>

      <ScriptWriterRequirementsDialog
        open={requirementsOpen}
        onOpenChange={setRequirementsOpen}
        order={order}
        initial={order.script_writer_brief}
        submitLabel="Save requirements"
        onSave={async (requirements) => {
          await saveScriptWriterRequirements(order.id, requirements);
          toast.success("Requirements saved");
          setRequirementsOpen(false);
        }}
      />

      <ContentPlannerBriefDialog
        open={editingBrief === "content"}
        onOpenChange={(next) => !next && closeBriefEditor()}
        order={order}
        initial={order.brief}
        submitLabel="Save brief"
        onSave={async (brief) => {
          await saveOrderBrief(order.id, brief);
          toast.success("Content plan saved");
          closeBriefEditor();
        }}
      />

      <VideographerBriefDialog
        open={editingBrief === "shoot"}
        onOpenChange={(next) => !next && closeBriefEditor()}
        order={order}
        initial={order.videographer_brief}
        submitLabel="Save brief"
        onSave={async (brief) => {
          await saveVideographerBrief(order.id, brief);
          toast.success("Shoot brief saved");
          closeBriefEditor();
        }}
      />

      {editBrief && (
        <StageBriefDialog
          open={editingBrief === "edit"}
          onOpenChange={(next) => !next && closeBriefEditor()}
          order={order}
          config={editBrief}
          initial={order.stage_briefs?.[editBrief.key] ?? null}
          submitLabel="Save brief"
          onSave={async (values) => {
            await saveStageBrief(order.id, editBrief.key, values);
            toast.success("Edit brief saved");
            closeBriefEditor();
          }}
        />
      )}

      {marketingBrief && (
        <StageBriefDialog
          open={editingBrief === "marketing"}
          onOpenChange={(next) => !next && closeBriefEditor()}
          order={order}
          config={marketingBrief}
          initial={order.stage_briefs?.[marketingBrief.key] ?? null}
          submitLabel="Save brief"
          onSave={async (values) => {
            await saveStageBrief(order.id, marketingBrief.key, values);
            toast.success("Marketing brief saved");
            closeBriefEditor();
          }}
        />
      )}

      {developerBrief && (
        <StageBriefDialog
          open={editingBrief === "developer"}
          onOpenChange={(next) => !next && closeBriefEditor()}
          order={order}
          config={developerBrief}
          initial={order.stage_briefs?.[developerBrief.key] ?? null}
          submitLabel="Save brief"
          onSave={async (values) => {
            await saveStageBrief(order.id, developerBrief.key, values);
            toast.success("Developer brief saved");
            closeBriefEditor();
          }}
        />
      )}
    </>
  );
}

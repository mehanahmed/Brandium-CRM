"use client";

import type { LucideIcon } from "lucide-react";
import {
  Files,
  FilePen,
  Send,
  Eye,
  MessagesSquare,
  RefreshCw,
  Trophy,
  XCircle,
} from "lucide-react";

export interface QuotationStats {
  total: number;
  draft: number;
  sent: number;
  underReview: number;
  negotiation: number;
  revised: number;
  accepted: number;
  rejected: number;
  acceptanceRate: string;
}

interface QuotationStatCardProps {
  label: string;
  value: number | string;
  hint?: string | undefined;
  icon: LucideIcon;
  colorScheme:
    | "pastelPurple"
    | "pastelTeal"
    | "pastelEmerald"
    | "pastelPeach"
    | "pastelYellow"
    | "pastelBlue"
    | "pastelIndigo"
    | "pastelRose";
  isSelected: boolean;
  onClick: () => void;
}

function QuotationStatCard({
  label,
  value,
  hint,
  icon: Icon,
  colorScheme,
  isSelected,
  onClick,
}: QuotationStatCardProps) {
  const styles = {
    pastelPurple: {
      cardBg: "bg-[#F1E8FF] dark:bg-purple-950/40",
      iconText: "text-[#8B5CF6] dark:text-purple-400",
    },
    pastelTeal: {
      cardBg: "bg-[#E1F1F0] dark:bg-teal-950/40",
      iconText: "text-[#0D9488] dark:text-teal-400",
    },
    pastelEmerald: {
      cardBg: "bg-[#E3F2E1] dark:bg-emerald-950/40",
      iconText: "text-[#059669] dark:text-emerald-400",
    },
    pastelPeach: {
      cardBg: "bg-[#FCE8E2] dark:bg-rose-950/40",
      iconText: "text-[#EA580C] dark:text-orange-400",
    },
    pastelYellow: {
      cardBg: "bg-[#FBF3D5] dark:bg-amber-950/40",
      iconText: "text-[#D97706] dark:text-amber-400",
    },
    pastelBlue: {
      cardBg: "bg-[#E0F2FE] dark:bg-sky-950/40",
      iconText: "text-[#0284C7] dark:text-sky-400",
    },
    pastelIndigo: {
      cardBg: "bg-[#E0E7FF] dark:bg-indigo-950/40",
      iconText: "text-[#4F46E5] dark:text-indigo-400",
    },
    pastelRose: {
      cardBg: "bg-[#FFE4E6] dark:bg-rose-950/40",
      iconText: "text-[#E11D48] dark:text-rose-400",
    },
  }[colorScheme];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative block w-full text-left overflow-hidden rounded-xl py-2 px-2.5 sm:py-2.5 sm:px-3 shadow-md transition-all duration-200 select-none cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none ${styles.cardBg} ${
        isSelected ? "shadow-lg scale-[1.02]" : "opacity-90 hover:opacity-100"
      }`}
    >
      <div className="relative z-10 flex items-center gap-2 sm:gap-2.5">
        <div className="size-8 xl:size-9 rounded-full bg-white dark:bg-card shadow-2xs flex items-center justify-center shrink-0">
          <Icon className={`size-4 xl:size-4.5 ${styles.iconText}`} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
            {label}
          </p>
          <p className="text-base sm:text-lg xl:text-xl font-black text-slate-950 dark:text-white leading-tight tracking-tight truncate">
            {value}
          </p>
          {hint && (
            <p className="text-[9px] sm:text-[10px] font-medium text-slate-600 dark:text-slate-400 truncate leading-tight">
              {hint}
            </p>
          )}
        </div>
      </div>

      <div className="absolute -right-2 -bottom-2 opacity-[0.07] pointer-events-none transform rotate-12 scale-110 transition-transform group-hover:scale-120">
        <Icon className={`size-12 ${styles.iconText}`} />
      </div>
    </button>
  );
}

export function QuotationSummaryCards({
  stats,
  selectedStage,
  onSelectStage,
}: {
  stats: QuotationStats;
  selectedStage: string;
  onSelectStage: (stage: string) => void;
}) {
  const cards: {
    key: string;
    label: string;
    value: number | string;
    hint: string;
    icon: LucideIcon;
    colorScheme: QuotationStatCardProps["colorScheme"];
  }[] = [
    {
      key: "all",
      label: "All",
      value: stats.total,
      hint: "All quotations",
      icon: Files,
      colorScheme: "pastelPurple",
    },
    {
      key: "Draft",
      label: "Draft",
      value: stats.draft,
      hint: "In preparation",
      icon: FilePen,
      colorScheme: "pastelBlue",
    },
    {
      key: "Sent",
      label: "Sent",
      value: stats.sent,
      hint: "Sent to client",
      icon: Send,
      colorScheme: "pastelTeal",
    },
    {
      key: "Under Review",
      label: "Under Review",
      value: stats.underReview,
      hint: "Client reviewing",
      icon: Eye,
      colorScheme: "pastelYellow",
    },
    {
      key: "Negotiation",
      label: "Negotiation",
      value: stats.negotiation,
      hint: "Terms discussion",
      icon: MessagesSquare,
      colorScheme: "pastelIndigo",
    },
    {
      key: "Revised",
      label: "Revised",
      value: stats.revised,
      hint: "Updated quotes",
      icon: RefreshCw,
      colorScheme: "pastelRose",
    },
    {
      key: "Accepted",
      label: "Accepted",
      value: stats.accepted,
      hint: stats.acceptanceRate ? `Rate: ${stats.acceptanceRate}` : "Rate: 0.0%",
      icon: Trophy,
      colorScheme: "pastelEmerald",
    },
    {
      key: "Rejected",
      label: "Rejected",
      value: stats.rejected,
      hint: "Declined quotes",
      icon: XCircle,
      colorScheme: "pastelPeach",
    },
  ];

  return (
    <div className="grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
      {cards.map((card) => {
        const isSelected =
          card.key === "all"
            ? selectedStage === "all" || !selectedStage
            : selectedStage.toLowerCase() === card.key.toLowerCase();

        return (
          <QuotationStatCard
            key={card.key}
            label={card.label}
            value={card.value}
            hint={card.hint}
            icon={card.icon}
            colorScheme={card.colorScheme}
            isSelected={isSelected}
            onClick={() => {
              if (isSelected && card.key !== "all") {
                onSelectStage("all");
              } else {
                onSelectStage(card.key);
              }
            }}
          />
        );
      })}
    </div>
  );
}

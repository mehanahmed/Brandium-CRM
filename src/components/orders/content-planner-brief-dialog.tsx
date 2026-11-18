"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_CONTENT_PLANNER_BRIEF, type ContentPlannerBrief, type CrmOrder } from "@/lib/orders";

interface ContentPlannerBriefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: CrmOrder;
  initial: ContentPlannerBrief | null;
  /** Saves the brief; resolves when it is stored, so the assign step can follow. */
  onSave: (brief: ContentPlannerBrief) => Promise<void>;
  submitLabel?: string | undefined;
}

const FIELDS: {
  key: Exclude<keyof ContentPlannerBrief, "shootingBrief" | "specialNotes">;
  label: string;
  placeholder: string;
}[] = [
  { key: "driveLink", label: "Script Drive Link", placeholder: "https://drive.google.com/..." },
  { key: "reference", label: "Reference", placeholder: "Reference video or link" },
  { key: "modelArtistNames", label: "Model/Artist Names", placeholder: "Names of model or artist" },
  { key: "location", label: "Location", placeholder: "Shooting location" },
  { key: "aspectRatio", label: "Aspect Ratio", placeholder: "16:9, 9:16, 1:1 ..." },
];

const inputClass = "h-10 text-sm";

/** Required before a Content Planner is assigned, like Motion Box's requirements popup. */
export function ContentPlannerBriefDialog({
  open,
  onOpenChange,
  order,
  initial,
  onSave,
  submitLabel = "Save & continue",
}: ContentPlannerBriefDialogProps) {
  const [brief, setBrief] = useState<ContentPlannerBrief>(initial ?? EMPTY_CONTENT_PLANNER_BRIEF);
  const [isSaving, setIsSaving] = useState(false);

  const setField = (key: keyof ContentPlannerBrief, value: string) =>
    setBrief((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!brief.driveLink.trim() || !brief.shootingBrief.trim()) {
      toast.error("Brief incomplete", {
        description: "Script Drive Link and Shooting Brief are required.",
      });
      return;
    }
    setIsSaving(true);
    try {
      const cleaned: ContentPlannerBrief = Object.fromEntries(
        Object.entries(brief).map(([key, value]) => [key, value.trim()]),
      ) as unknown as ContentPlannerBrief;
      await onSave(cleaned);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the brief");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b bg-slate-50/80 px-6 py-5 dark:bg-slate-900/60">
          <DialogTitle>Content Planner Brief</DialogTitle>
          <DialogDescription>
            Fill the brief for order{" "}
            <span className="font-semibold text-foreground">{order.order_number}</span> before
            assigning a Content Planner.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 pt-5">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`brief-${field.key}`} className="text-xs font-semibold">
                  {field.label}
                  {field.key === "driveLink" && <span className="text-[#EF1E1E]"> *</span>}
                </Label>
                <Input
                  id={`brief-${field.key}`}
                  value={brief[field.key]}
                  placeholder={field.placeholder}
                  onChange={(e) => setField(field.key, e.target.value)}
                  disabled={isSaving}
                  className={inputClass}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brief-shootingBrief" className="text-xs font-semibold">
              Shooting Brief <span className="text-[#EF1E1E]">*</span>
            </Label>
            <Textarea
              id="brief-shootingBrief"
              value={brief.shootingBrief}
              placeholder="What to shoot, scenes, pace, product focus"
              onChange={(e) => setField("shootingBrief", e.target.value)}
              disabled={isSaving}
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brief-specialNotes" className="text-xs font-semibold">
              Special Notes
            </Label>
            <Textarea
              id="brief-specialNotes"
              value={brief.specialNotes}
              placeholder="Anything else the Content Planner should know"
              onChange={(e) => setField("specialNotes", e.target.value)}
              disabled={isSaving}
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          <DialogFooter className="-mx-6 gap-2 border-t bg-slate-50/80 px-6 py-4 dark:bg-slate-900/60">
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
              disabled={isSaving}
              className="bg-[#67B239] text-white hover:bg-[#5aa030]"
            >
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

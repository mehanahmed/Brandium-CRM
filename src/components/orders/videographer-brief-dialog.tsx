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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_VIDEOGRAPHER_BRIEF, type CrmOrder, type VideographerBrief } from "@/lib/orders";

interface VideographerBriefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: CrmOrder;
  initial: VideographerBrief | null;
  /** Saves the brief; resolves when stored, so the assign step can follow. */
  onSave: (brief: VideographerBrief) => Promise<void>;
  submitLabel?: string | undefined;
}

const FIELDS: {
  key: keyof VideographerBrief;
  label: string;
  placeholder: string;
}[] = [
  {
    key: "scriptForDirector",
    label: "1. Script for Director",
    placeholder: "Script or shot list for the director",
  },
  { key: "cameraSetup", label: "2. Camera Setup", placeholder: "Camera, lens, lighting, movement" },
  {
    key: "shootingLocation",
    label: "3. Shooting Spot / Location",
    placeholder: "Where the shoot happens",
  },
  { key: "artistTalent", label: "4. Artist / Talent", placeholder: "Who appears on camera" },
  {
    key: "specialNotes",
    label: "5. Special Notes",
    placeholder: "Anything else the videographer should know",
  },
];

/** Shown before a Videographer is assigned: the shooting brief for the director and camera crew. */
export function VideographerBriefDialog({
  open,
  onOpenChange,
  order,
  initial,
  onSave,
  submitLabel = "Next: Assign Videographer",
}: VideographerBriefDialogProps) {
  const [values, setValues] = useState<VideographerBrief>(initial ?? EMPTY_VIDEOGRAPHER_BRIEF);
  const [isSaving, setIsSaving] = useState(false);

  const set = (key: keyof VideographerBrief, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const cleaned = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value.trim()]),
      ) as unknown as VideographerBrief;
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
          <DialogTitle>Videographer Brief</DialogTitle>
          <DialogDescription>
            Moving <span className="font-semibold text-foreground">{order.order_number}</span> to
            Videographer. Fill the shooting brief before assigning.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 pt-5">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div
                key={field.key}
                className={
                  field.key === "specialNotes"
                    ? "min-w-0 space-y-1.5 sm:col-span-2"
                    : "min-w-0 space-y-1.5"
                }
              >
                <Label htmlFor={`vg-${field.key}`} className="text-xs font-semibold">
                  {field.label}
                </Label>
                <Textarea
                  id={`vg-${field.key}`}
                  value={values[field.key]}
                  placeholder={field.placeholder}
                  onChange={(e) => set(field.key, e.target.value)}
                  disabled={isSaving}
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>
            ))}
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

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
import type { StageBriefConfig } from "@/components/orders/stage-brief-config";
import type { CrmOrder } from "@/lib/orders";

interface StageBriefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: CrmOrder;
  config: StageBriefConfig;
  initial: Record<string, string> | null;
  /** Saves the brief; resolves when stored, so the assign step can follow. */
  onSave: (values: Record<string, string>) => Promise<void>;
  submitLabel?: string | undefined;
}

/** Brief popup for a stage, driven by `STAGE_BRIEF_CONFIG`. All fields are optional text. */
export function StageBriefDialog({
  open,
  onOpenChange,
  order,
  config,
  initial,
  onSave,
  submitLabel,
}: StageBriefDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(config.fields.map((field) => [field.key, initial?.[field.key] ?? ""])),
  );
  const [isSaving, setIsSaving] = useState(false);

  const set = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const cleaned = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value.trim()]),
      );
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
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>
            Moving <span className="font-semibold text-foreground">{order.order_number}</span>. Fill
            the brief before assigning.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 pt-5">
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            {config.fields.map((field) => (
              <div
                key={field.key}
                className={
                  field.fullWidth ? "min-w-0 space-y-1.5 sm:col-span-2" : "min-w-0 space-y-1.5"
                }
              >
                <Label htmlFor={`brief-${field.key}`} className="text-xs font-semibold">
                  {field.label}
                </Label>
                {field.multiline ? (
                  <Textarea
                    id={`brief-${field.key}`}
                    value={values[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(e) => set(field.key, e.target.value)}
                    disabled={isSaving}
                    className="h-20 resize-none text-sm"
                  />
                ) : (
                  <Input
                    id={`brief-${field.key}`}
                    value={values[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(e) => set(field.key, e.target.value)}
                    disabled={isSaving}
                    className="h-10 text-sm"
                  />
                )}
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
              {submitLabel ?? config.submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

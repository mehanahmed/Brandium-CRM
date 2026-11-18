"use client";

import { useState, type FormEvent } from "react";
import { Loader2, UploadCloud, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uploadImageFile } from "@/lib/upload";
import {
  EMPTY_SCRIPT_WRITER_REQUIREMENTS,
  type CrmOrder,
  type ScriptWriterRequirements,
} from "@/lib/orders";

const VIDEO_RATIOS = [
  "9:16 — Reels / TikTok / Story (Vertical)",
  "16:9 — YouTube / Landscape",
  "1:1 — Square / Feed",
  "4:5 — Instagram Portrait",
  "Other",
];

const MODEL_RESTRICTIONS = ["No Restrictions", "Female Only", "Male Only", "Mixed Cast", "Other"];

interface ScriptWriterRequirementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: CrmOrder;
  initial: ScriptWriterRequirements | null;
  /** Saves the requirements; resolves when stored, so the assign step can follow. */
  onSave: (requirements: ScriptWriterRequirements) => Promise<void>;
  submitLabel?: string | undefined;
}

const textFields: {
  key: Exclude<keyof ScriptWriterRequirements, "videoRatio" | "modelRestrictions" | "brandLogoUrl">;
  label: string;
  placeholder: string;
  multiline?: boolean;
}[] = [
  { key: "facebookPageLink", label: "Facebook Page Link", placeholder: "https://facebook.com/..." },
  { key: "websiteLink", label: "Website Link", placeholder: "https://..." },
  {
    key: "competitorReferences",
    label: "Competitor / Reference Pages",
    placeholder: "Links or names",
  },
  {
    key: "productDetails",
    label: "Details of the Product / Service",
    placeholder: "What is being sold",
    multiline: true,
  },
  {
    key: "keyPoints",
    label: "Key Points You Want to Highlight",
    placeholder: "Main selling points",
    multiline: true,
  },
  {
    key: "painPoints",
    label: "Customer Pain Points",
    placeholder: "Problems the product solves",
    multiline: true,
  },
  {
    key: "targetAudience",
    label: "Target Audience Details",
    placeholder: "Age, location, interests",
    multiline: true,
  },
  {
    key: "messageDelivery",
    label: "Message Delivery (What message to deliver?)",
    placeholder: "Tone and message",
    multiline: true,
  },
  {
    key: "callToAction",
    label: "Call To Action (What should they do?)",
    placeholder: "Visit, call, order ...",
    multiline: true,
  },
  {
    key: "importantNotes",
    label: "Important Notes / Must Follow & Avoid",
    placeholder: "Models, product, colors, brand rules",
    multiline: true,
  },
];

/** Shown before a Script Writer is assigned: the requirements the writer needs for the script. */
export function ScriptWriterRequirementsDialog({
  open,
  onOpenChange,
  order,
  initial,
  onSave,
  submitLabel = "Next: Assign Script Writer",
}: ScriptWriterRequirementsDialogProps) {
  const [values, setValues] = useState<ScriptWriterRequirements>(
    initial ?? EMPTY_SCRIPT_WRITER_REQUIREMENTS,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const set = (key: keyof ScriptWriterRequirements, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    setIsUploading(true);
    const res = await uploadImageFile(file);
    setIsUploading(false);
    if (!res.success || !res.url) {
      toast.error("Upload failed", { description: res.error || "Could not upload the logo." });
      return;
    }
    set("brandLogoUrl", res.url);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.videoRatio || !values.modelRestrictions) {
      toast.error("Requirements incomplete", {
        description: "Video Ratio and Model Restrictions are required.",
      });
      return;
    }
    setIsSaving(true);
    try {
      const cleaned = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, String(value).trim()]),
      ) as unknown as ScriptWriterRequirements;
      await onSave(cleaned);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the requirements");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b bg-slate-50/80 px-6 py-5 dark:bg-slate-900/60">
          <DialogTitle>Script Writer Requirements</DialogTitle>
          <DialogDescription>
            Moving <span className="font-semibold text-foreground">{order.order_number}</span> to
            Script Writer. Fill the requirements before assigning.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 pt-5">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            {textFields.slice(0, 3).map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`sw-${field.key}`} className="text-xs font-semibold">
                  {field.label}
                </Label>
                <Input
                  id={`sw-${field.key}`}
                  value={values[field.key]}
                  placeholder={field.placeholder}
                  onChange={(e) => set(field.key, e.target.value)}
                  disabled={isSaving}
                  className="h-10 text-sm"
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Brand Logo</Label>
              <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-xs text-muted-foreground hover:border-[#67B239]">
                {isUploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UploadCloud className="size-4" />
                )}
                {values.brandLogoUrl ? "Logo uploaded" : "Upload Brand Logo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={isSaving || isUploading}
                  onChange={(e) => void uploadLogo(e.target.files?.[0])}
                />
              </label>
              {values.brandLogoUrl && (
                <button
                  type="button"
                  onClick={() => set("brandLogoUrl", "")}
                  className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" /> Remove logo
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Video Ratio Requirement <span className="text-[#EF1E1E]">*</span>
              </Label>
              <Select
                value={values.videoRatio}
                onValueChange={(value) => set("videoRatio", value)}
                disabled={isSaving}
              >
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue placeholder="Select ratio" />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_RATIOS.map((ratio) => (
                    <SelectItem key={ratio} value={ratio}>
                      {ratio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Model Restrictions <span className="text-[#EF1E1E]">*</span>
              </Label>
              <Select
                value={values.modelRestrictions}
                onValueChange={(value) => set("modelRestrictions", value)}
                disabled={isSaving}
              >
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue placeholder="Select restriction" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_RESTRICTIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {textFields.slice(3).map((field) => (
              <div key={field.key} className="space-y-1.5 sm:col-span-1">
                <Label htmlFor={`sw-${field.key}`} className="text-xs font-semibold">
                  {field.label}
                </Label>
                <Textarea
                  id={`sw-${field.key}`}
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
              disabled={isSaving || isUploading}
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

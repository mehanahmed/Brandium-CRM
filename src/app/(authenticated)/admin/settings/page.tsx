"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageIcon, Loader2, PowerOff, RotateCcw, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type AppSettings,
  DEFAULT_INVOICE_BG,
  DEFAULT_MAINTENANCE_MESSAGE,
  useAppSettings,
} from "@/lib/app-settings";
import { uploadImageFile } from "@/lib/upload";

type SettingsPayload = Pick<
  AppSettings,
  "invoice_bg_url" | "maintenance_mode" | "maintenance_message"
>;

async function putSettings(payload: SettingsPayload) {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  if (!json.success) throw new Error(json.error || "Could not save settings.");
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useAppSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [savingSection, setSavingSection] = useState<"bg" | "maintenance" | null>(null);

  useEffect(() => {
    if (!settings) return;
    setBgUrl(settings.invoice_bg_url);
    setMaintenanceMode(settings.maintenance_mode);
    setMaintenanceMessage(settings.maintenance_message);
  }, [settings]);

  // Each card saves its own fields and keeps the other card's saved values
  const save = async (section: "bg" | "maintenance", payload: Partial<SettingsPayload>) => {
    setSavingSection(section);
    try {
      await putSettings({
        invoice_bg_url: settings?.invoice_bg_url ?? null,
        maintenance_mode: settings?.maintenance_mode ?? false,
        maintenance_message: settings?.maintenance_message ?? "",
        ...payload,
      });
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Settings Updated", {
        description:
          section === "bg"
            ? "The invoice & quotation background has been saved."
            : payload.maintenance_mode
              ? "Maintenance mode is ON. Only admins can use the app."
              : "Maintenance mode is OFF.",
      });
    } catch (err) {
      toast.error("Update Failed", {
        description: err instanceof Error ? err.message : "Could not save settings.",
      });
    }
    setSavingSection(null);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(jpe?g|png)$/i.test(file.name)) {
      toast.error("Please choose a JPG or PNG image (the PDF can only use these).");
      return;
    }
    setIsUploading(true);
    const result = await uploadImageFile(file);
    setIsUploading(false);
    if (!result.success || !result.url) {
      toast.error(result.error || "Upload failed.");
      return;
    }
    setBgUrl(result.url);
  };

  const preview = bgUrl || DEFAULT_INVOICE_BG;
  const bgChanged = (settings?.invoice_bg_url ?? null) !== bgUrl;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Invoice &amp; quotation design and maintenance mode.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-xl border bg-card rounded-lg overflow-hidden flex flex-col justify-between">
          <div>
            <CardHeader className="border-b p-5">
              <CardTitle className="text-card-foreground text-xl flex items-center gap-2">
                <ImageIcon className="size-6 text-primary" /> Invoice &amp; Quotation Background
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm mt-0.5">
                The A4 letterhead behind every invoice and quotation, on screen and in the PDF.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex gap-4">
                {/* A4 ratio (210 x 297) preview */}
                <div className="w-40 shrink-0 aspect-210/297 overflow-hidden rounded-md border bg-muted">
                  {isLoading ? (
                    <div className="size-full animate-pulse bg-muted" />
                  ) : (
                    <img
                      src={preview}
                      alt="Current invoice background"
                      className="size-full object-fill"
                    />
                  )}
                </div>
                <div className="min-w-0 space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Use a full A4 page image, portrait, JPG or PNG (about 2480 × 3508 px). Keep the
                    top and bottom free for the logo and footer; the content sits in the middle.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {bgUrl ? "Custom background" : "Built-in Brandium background"}
                    {bgChanged && " (not saved yet)"}
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => {
                      void handleFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileRef.current?.click()}
                      disabled={isUploading || isLoading}
                    >
                      {isUploading ? (
                        <Loader2 className="mr-1.5 size-4 animate-spin" />
                      ) : (
                        <Upload className="mr-1.5 size-4" />
                      )}
                      Upload Image
                    </Button>
                    {bgUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setBgUrl(null)}
                        disabled={isUploading}
                      >
                        <RotateCcw className="mr-1.5 size-4" /> Use Default
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
          <CardFooter className="border-t p-5 flex justify-end">
            <Button
              onClick={() => void save("bg", { invoice_bg_url: bgUrl })}
              disabled={!bgChanged || isUploading || savingSection !== null}
            >
              {savingSection === "bg" ? "Saving..." : "Save Background"}
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-xl border bg-card rounded-lg overflow-hidden flex flex-col justify-between">
          <div>
            <CardHeader className="border-b p-5">
              <CardTitle className="text-card-foreground text-xl flex items-center gap-2">
                <PowerOff className="size-6 text-primary" /> Maintenance Mode
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm mt-0.5">
                Temporarily restrict access for non-admin users and display a maintenance message.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between space-x-2 p-3 rounded-md border border-border/30 hover:bg-muted/50 transition-colors">
                <Label
                  htmlFor="maintenanceModeSwitch"
                  className="flex flex-col space-y-1 cursor-pointer"
                >
                  <span>Enable Maintenance Mode</span>
                  <span className="font-normal leading-snug text-muted-foreground text-xs">
                    When enabled, only admins can sign in and use the app. Others see the
                    maintenance page.
                  </span>
                </Label>
                <Switch
                  id="maintenanceModeSwitch"
                  checked={maintenanceMode}
                  onCheckedChange={setMaintenanceMode}
                  disabled={savingSection !== null || isLoading}
                  aria-label="Toggle maintenance mode"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maintenanceMessage">Maintenance Message</Label>
                <Textarea
                  id="maintenanceMessage"
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  placeholder={DEFAULT_MAINTENANCE_MESSAGE}
                  disabled={savingSection !== null || isLoading}
                  rows={3}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  This message will be shown to users when maintenance mode is active.
                </p>
              </div>
            </CardContent>
          </div>
          <CardFooter className="border-t p-5 flex justify-end">
            <Button
              onClick={() =>
                void save("maintenance", {
                  maintenance_mode: maintenanceMode,
                  maintenance_message: maintenanceMessage.trim(),
                })
              }
              disabled={savingSection !== null || isLoading}
            >
              {savingSection === "maintenance" ? "Saving..." : "Save Maintenance Settings"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

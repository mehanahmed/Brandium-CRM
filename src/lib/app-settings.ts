import { queryOptions, useQuery } from "@tanstack/react-query";

export type AppSettings = {
  /** Uploaded letterhead (`/uploads/...jpg|png`), or null for the built-in one. */
  invoice_bg_url: string | null;
  maintenance_mode: boolean;
  maintenance_message: string;
  updated_at: string | null;
};

export const DEFAULT_INVOICE_BG = "/brandium_invoice_bg.jpg";
export const DEFAULT_MAINTENANCE_MESSAGE =
  "Brandium CRM is down for maintenance. We'll be back shortly.";

/** Letterhead for the invoice / quotation sheets and their PDFs. */
export const invoiceBgUrl = (settings: AppSettings | undefined) =>
  settings?.invoice_bg_url || DEFAULT_INVOICE_BG;

/** Public settings (no login needed: the public track page uses the letterhead too). */
export const appSettingsQueryOptions = () =>
  queryOptions({
    queryKey: ["app-settings"],
    queryFn: async (): Promise<AppSettings> => {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const json = (await res.json()) as { success: boolean; data?: AppSettings; error?: string };
      if (!json.success || !json.data) throw new Error(json.error || "Failed to load settings.");
      return json.data;
    },
    staleTime: 30_000,
  });

export const useAppSettings = () => useQuery(appSettingsQueryOptions());

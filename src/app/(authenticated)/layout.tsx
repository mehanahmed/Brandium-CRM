"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, PowerOff } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MaintenanceScreen } from "@/components/maintenance/maintenance-screen";
import { Link } from "@/components/navigation-link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { DEFAULT_MAINTENANCE_MESSAGE, useAppSettings } from "@/lib/app-settings";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { session, loading, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const { data: settings } = useAppSettings();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30">
        <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  // Maintenance mode (Admin → Settings). The server also refuses non-admin data and sign-in;
  // this screen is what a user who was already signed in sees.
  if (settings?.maintenance_mode && !isAdmin) {
    return (
      <MaintenanceScreen
        message={settings.maintenance_message || DEFAULT_MAINTENANCE_MESSAGE}
        action={
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut className="mr-1.5 size-4" /> Sign out
          </Button>
        }
      />
    );
  }

  return (
    <AppShell>
      {settings?.maintenance_mode && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300"
        >
          <span className="flex items-center gap-2">
            <PowerOff className="size-4 shrink-0" />
            Maintenance mode is on. Only admins can use the app right now.
          </span>
          <Link href="/admin/settings" className="font-medium underline underline-offset-2">
            Turn it off
          </Link>
        </div>
      )}
      {children}
    </AppShell>
  );
}

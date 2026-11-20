"use client";

import { LogIn } from "lucide-react";
import { Link } from "@/components/navigation-link";
import { Button } from "@/components/ui/button";
import { MaintenanceScreen } from "@/components/maintenance/maintenance-screen";
import { DEFAULT_MAINTENANCE_MESSAGE, useAppSettings } from "@/lib/app-settings";

/** Public page: where sign-in sends non-admins while maintenance mode is on. */
export default function MaintenancePage() {
  const { data: settings } = useAppSettings();
  const isOver = settings ? !settings.maintenance_mode : false;

  return (
    <MaintenanceScreen
      live={!isOver}
      title={isOver ? "We're back!" : "We'll be right back"}
      message={
        isOver
          ? "Maintenance is finished. You can sign in again."
          : settings?.maintenance_message || DEFAULT_MAINTENANCE_MESSAGE
      }
      action={
        <Button asChild variant={isOver ? "default" : "outline"}>
          <Link href="/login">
            <LogIn className="mr-1.5 size-4" /> {isOver ? "Sign in" : "Try signing in"}
          </Link>
        </Button>
      }
    />
  );
}

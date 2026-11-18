"use client";

import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Red confirm button for irreversible or disruptive actions. */
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}

/** Styled confirmation for an action that changes data; the action runs only on confirm. */
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="cursor-pointer">
            Keep as is
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            className={cn(
              "cursor-pointer text-white",
              destructive
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-[#67B239] hover:bg-[#5aa030]",
            )}
          >
            {pending ? "Please wait..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

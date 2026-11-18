"use client";

import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
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
import { normalizeStageLink, resolveOrderStatus, type CrmOrder } from "@/lib/orders";

interface FootageLinkDialogProps {
  order: CrmOrder;
  /** Stage the order is moving into (Video Graphy Complete). */
  statusId: string;
  isSaving: boolean;
  onCancel: () => void;
  /** Receives the normalised Drive link (https:// added when missing). */
  onConfirm: (link: string) => void;
}

/** Asks for the footage Drive link before an order moves to Video Graphy Complete. */
export function FootageLinkDialog({
  order,
  statusId,
  isSaving,
  onCancel,
  onConfirm,
}: FootageLinkDialogProps) {
  const [link, setLink] = useState("");
  const to = resolveOrderStatus(statusId);
  const normalized = normalizeStageLink(link);
  const showError = link.trim().length > 0 && normalized === null;

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Footage link for {to.name}</DialogTitle>
          <DialogDescription>
            Add the Drive link for the shot footage of{" "}
            <span className="font-semibold text-foreground">
              {order.company_name || order.order_number}
            </span>
            . It is saved with the status change and shown in Project details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="footage-drive-link" className="text-sm font-medium">
            Drive link <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="footage-drive-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="h-10 pl-9 text-sm"
              autoFocus
              disabled={isSaving}
              aria-invalid={showError}
            />
          </div>
          {showError ? (
            <p className="text-xs text-destructive">
              Enter a valid link, for example drive.google.com/...
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Drive, Dropbox or any shareable link.</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={() => normalized && onConfirm(normalized)}
            disabled={!normalized || isSaving}
            className="bg-[#67B239] hover:bg-[#5aa030] text-white cursor-pointer"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Move to {to.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

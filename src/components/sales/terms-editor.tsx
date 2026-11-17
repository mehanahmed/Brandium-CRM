"use client";

import { RotateCcw, ScrollText } from "lucide-react";

import { BRANDIUM_TERMS } from "@/components/invoices/torn-paper-terms";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Stored terms (JSON array string or array) → list, or null when none are saved. */
export function parseTerms(raw: unknown): string[] | null {
  if (!raw) return null;
  try {
    const list = Array.isArray(raw) ? raw : JSON.parse(String(raw));
    return Array.isArray(list) && list.length ? list.map(String) : null;
  } catch {
    return null;
  }
}

/** The terms to print: the document's own list, else the default one. */
export const resolveTerms = (terms: string[] | null | undefined): string[] =>
  terms?.length ? terms : BRANDIUM_TERMS;

/** Lines to save; null when empty or identical to the default list (keeps following the default). */
export function termsToSave(text: string): string[] | null {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const isDefault =
    lines.length === BRANDIUM_TERMS.length && lines.every((line, i) => line === BRANDIUM_TERMS[i]);
  return lines.length === 0 || isDefault ? null : lines;
}

/** Per-document Terms & Conditions box used by the Edit Order and Edit Quotation dialogs. */
export function TermsEditor({
  id,
  value,
  onChange,
  disabled,
  documentLabel,
}: {
  id: string;
  /** One term per line. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
  /** e.g. "order" or "quotation", used in the help text. */
  documentLabel: string;
}) {
  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label
          htmlFor={id}
          className="flex items-center gap-1.5 text-base font-semibold text-foreground"
        >
          <ScrollText className="h-5 w-5 text-primary/80" aria-hidden />
          Terms &amp; Conditions
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(BRANDIUM_TERMS.join("\n"))}
          disabled={disabled || termsToSave(value) === null}
          className="h-8 gap-1.5 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reset to default
        </Button>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        disabled={disabled}
        aria-describedby={`${id}-help`}
        className="text-sm leading-relaxed"
      />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        One term per line. These print on this {documentLabel}&apos;s page and PDF only; leave it
        empty to use the default terms.
      </p>
    </div>
  );
}

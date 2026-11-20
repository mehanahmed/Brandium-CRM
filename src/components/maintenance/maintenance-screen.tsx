"use client";

import type { ReactNode } from "react";
import { Gamepad2, Wrench } from "lucide-react";
import { FlappyBird } from "@/components/maintenance/flappy-bird";

/** Full-page maintenance screen: the admin's message plus a game to pass the time. */
export function MaintenanceScreen({
  title = "We'll be right back",
  message,
  action,
  live = true,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
  /** False once maintenance is over: the status chip turns green. */
  live?: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-100 via-slate-50 to-[#67B239]/10 p-4 sm:p-6 dark:from-slate-950 dark:via-slate-950 dark:to-[#0a2e5c]/40">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:grid-cols-[1fr_auto] dark:border-slate-800 dark:bg-slate-900">
        <section className="flex flex-col justify-center gap-6 p-6 sm:p-10 lg:p-12">
          <img src="/logo.png" alt="Brandium" className="h-9 w-auto self-start object-contain" />

          <div className="space-y-4">
            <span
              className={
                live
                  ? "inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400"
                  : "inline-flex items-center gap-2 rounded-full bg-[#67B239]/10 px-3 py-1 text-xs font-semibold text-[#4f8a2b] dark:text-[#7ac142]"
              }
            >
              <span className="relative flex size-2">
                {live && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-60 motion-reduce:hidden" />
                )}
                <span
                  className={`relative inline-flex size-2 rounded-full ${live ? "bg-amber-500" : "bg-[#67B239]"}`}
                />
              </span>
              {live ? "Maintenance in progress" : "All systems running"}
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-[#0a2e5c] sm:text-4xl dark:text-slate-100">
              {title}
            </h1>
            <p className="max-w-md whitespace-pre-line text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {message}
            </p>
          </div>

          {action && <div>{action}</div>}

          <div className="flex items-start gap-3 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
            <Gamepad2 className="mt-0.5 size-5 shrink-0 text-[#67B239]" />
            <p>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                While you wait, how far can you fly?
              </span>{" "}
              Tap the game, or press Space or ↑ to flap.
            </p>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Wrench className="size-3.5" /> This page updates on its own when we&apos;re back.
          </p>
        </section>

        <section className="flex items-center justify-center bg-slate-50 p-6 sm:p-8 md:border-l md:border-slate-200 lg:p-10 dark:bg-slate-950/40 dark:md:border-slate-800">
          <FlappyBird />
        </section>
      </div>
    </main>
  );
}

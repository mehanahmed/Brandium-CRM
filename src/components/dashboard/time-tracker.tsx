"use client";

import { useEffect, useState } from "react";
import { Pause, Play, TimerReset } from "lucide-react";

import { cn } from "@/lib/utils";

const WORKDAY_SECONDS = 8 * 60 * 60;
const RADIUS = 72;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type TimerState = { elapsed: number; startedAt: number | null };

// shortcut: kept in this browser only (per user); store sessions in MySQL if time must be reported
const storageKey = (userId: string) => `brandium:work-timer:${userId}`;

function readTimer(userId: string): TimerState {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) || "null") as unknown;
    if (parsed && typeof parsed === "object" && "elapsed" in parsed) {
      const { elapsed, startedAt } = parsed as Record<string, unknown>;
      return {
        elapsed: typeof elapsed === "number" ? elapsed : 0,
        startedAt: typeof startedAt === "number" ? startedAt : null,
      };
    }
  } catch {
    // Storage blocked or bad value: start from zero
  }
  return { elapsed: 0, startedAt: null };
}

function writeTimer(userId: string, state: TimerState) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // Storage blocked: the timer still works for this page view
  }
}

const pad = (value: number) => String(value).padStart(2, "0");

const formatClock = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

const ICON_BUTTON =
  "inline-flex size-11 items-center justify-center rounded-full bg-white text-stone-600 shadow-sm transition-colors duration-200 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67B239] disabled:pointer-events-none disabled:opacity-40 sm:size-9 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700";

/** Personal work timer: start, pause and reset, with an 8-hour day as the full ring. */
export function TimeTracker({ userId }: { userId: string }) {
  const [timer, setTimer] = useState<TimerState>({ elapsed: 0, startedAt: null });
  const [now, setNow] = useState(() => Date.now());

  // Load after mount so the server render and the first client render match
  useEffect(() => {
    if (userId) setTimer(readTimer(userId));
  }, [userId]);

  const running = timer.startedAt !== null;

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const update = (next: TimerState) => {
    setTimer(next);
    writeTimer(userId, next);
  };

  const seconds = timer.elapsed + (timer.startedAt ? (now - timer.startedAt) / 1000 : 0);
  const progress = Math.min(1, seconds / WORKDAY_SECONDS);
  const clock = formatClock(seconds);

  return (
    <section
      aria-labelledby="time-tracker-heading"
      className="relative overflow-hidden rounded-[28px] border border-amber-100/80 bg-linear-to-br from-stone-50 via-[#fffdec] to-[#fff8d6] p-5 text-stone-800 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 dark:text-zinc-100"
    >
      <h2 id="time-tracker-heading" className="text-sm font-medium tracking-tight">
        Time tracker
      </h2>

      <div
        className="relative mx-auto my-3 w-full max-w-55"
        role="timer"
        aria-label={`Work time ${clock}`}
      >
        <svg viewBox="0 0 184 184" className="w-full" aria-hidden="true">
          <circle
            cx="92"
            cy="92"
            r={RADIUS}
            fill="none"
            stroke="#78716c"
            strokeWidth="5"
            strokeDasharray="1 6"
            opacity="0.65"
          />
          <circle cx="92" cy="92" r="64" className="fill-[#fffef5] dark:fill-zinc-950" />
          <circle
            cx="92"
            cy="92"
            r={RADIUS}
            fill="none"
            stroke="#ffda62"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            transform="rotate(-90 92 92)"
            className={cn(
              "transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none",
              progress === 0 && "opacity-0",
            )}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="text-[28px] leading-none font-normal tracking-tight tabular-nums sm:text-[30px]">
            {clock}
          </span>
          <span className="text-[11px] text-stone-500 dark:text-zinc-400">Work Time</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Start work timer"
            disabled={running}
            onClick={() => {
              const startedAt = Date.now();
              setNow(startedAt);
              update({ elapsed: timer.elapsed, startedAt });
            }}
            className={ICON_BUTTON}
          >
            <Play className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Pause work timer"
            disabled={!running}
            onClick={() => update({ elapsed: seconds, startedAt: null })}
            className={ICON_BUTTON}
          >
            <Pause className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          aria-label="Reset work timer"
          disabled={seconds === 0}
          onClick={() => update({ elapsed: 0, startedAt: null })}
          className="inline-flex size-11 items-center justify-center rounded-full bg-stone-800 text-white shadow-sm transition-colors duration-200 hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67B239] disabled:pointer-events-none disabled:opacity-50 sm:size-10 dark:bg-zinc-100 dark:text-zinc-900"
        >
          <TimerReset className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";

const REFRESH_DELAY_MS = 400;

/**
 * Keeps every open page in step with the database: when any signed-in user writes, the server
 * pushes a change event and the active queries refetch (debounced, so a burst makes one refetch).
 */
export function RealtimeSync() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId || typeof EventSource === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const source = new EventSource("/api/realtime");

    source.onmessage = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({ type: "active" });
      }, REFRESH_DELAY_MS);
    };

    return () => {
      clearTimeout(timer);
      source.close();
    };
  }, [userId, queryClient]);

  return null;
}

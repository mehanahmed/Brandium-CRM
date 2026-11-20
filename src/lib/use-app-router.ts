"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Page filter state (search, stage, date range, page...). Kept in memory, not in the URL, so
 * the address bar stays clean; filters reset when the page is reloaded.
 * A link may still open a page pre-filtered (e.g. `/prospects?search=Follow-up`): those values
 * are read once on load and then removed from the address bar.
 * `undefined`, `null` and `""` remove a key.
 */
export function useAppFilters<T extends Record<string, any>>(defaultFilters: T = {} as T) {
  const [filters, setState] = useState<T>(defaultFilters);

  // After mount (not in the initial state) so the server and client first render match
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length === 0) return;
    const fromLink: Record<string, any> = {};
    params.forEach((value, key) => {
      fromLink[key] = key === "page" || key === "pageSize" ? Number(value) || 1 : value;
    });
    setState((current) => ({ ...current, ...fromLink }));
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, []);

  const setFilters = useCallback(
    (updater: Record<string, any> | ((prev: T) => Record<string, any>)) => {
      setState((current) => {
        const updates = typeof updater === "function" ? updater(current) : updater;
        const merged: Record<string, any> = { ...current, ...updates };
        for (const key of Object.keys(merged)) {
          if (merged[key] === undefined || merged[key] === null || merged[key] === "") {
            delete merged[key];
          }
        }
        return merged as T;
      });
    },
    [],
  );

  return [filters, setFilters] as const;
}

/**
 * Direct MySQL API Client Bridge
 * Routes database operations securely through Next.js /api/mysql route handler.
 * Ensures 100% persistence to local MySQL database `brandium_crm`.
 */

export async function runMySQLQuery<T = unknown>(
  sql: string,
  params: unknown[] = [],
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const sanitizedParams = params.map((p) =>
      p === undefined || p === null
        ? null
        : typeof p === "number" || typeof p === "boolean"
          ? p
          : String(p),
    );

    if (typeof window !== "undefined" && typeof fetch !== "undefined") {
      const response = await fetch("/api/mysql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "query", sql, params: sanitizedParams }),
      });
      if (response.ok) {
        const result = (await response.json()) as { success: boolean; data?: T; error?: string };
        return result;
      }
      if (response.status === 401 && window.location.pathname !== "/login") {
        // Server session is missing or expired: drop the stored copy and sign in again
        localStorage.removeItem("brandium_user_session");
        localStorage.removeItem("brandium_dev_session");
        window.location.assign("/login");
      }
      const errJson = await response.json().catch(() => ({}));
      return { success: false, error: (errJson as { error?: string }).error || "Query failed." };
    }

    // On server during SSR/prerender
    const baseUrl = process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/mysql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "query", sql, params: sanitizedParams }),
      cache: "no-store",
    });
    const result = (await response.json()) as { success: boolean; data?: T; error?: string };
    return result;
  } catch (err: unknown) {
    const errObj = err as { message?: string };
    return { success: false, error: errObj?.message || "Database connection error" };
  }
}

/**
 * Runs an INSERT / UPDATE / DELETE and throws when the database rejects it, so callers can
 * never show "saved" for a write that did not happen. Returns the number of rows matched.
 */
export async function runMySQLWrite(sql: string, params: unknown[] = []): Promise<number> {
  const res = await runMySQLQuery<{ affectedRows?: number }[]>(sql, params);
  if (!res.success) throw new Error(res.error || "Database write failed.");
  return Number(res.data?.[0]?.affectedRows ?? 0);
}

/** Like runMySQLWrite, but 0 rows is an error too (row gone, or not the caller's to change). */
export async function runMySQLWriteOne(sql: string, params: unknown[] = []): Promise<number> {
  const changed = await runMySQLWrite(sql, params);
  if (changed === 0) throw new Error("Not found, or you do not have access to change it.");
  return changed;
}

/**
 * Generates a standard RFC 4122 v4 UUID directly from the MySQL database engine.
 */
export async function fetchDbUUID(): Promise<string> {
  try {
    const res = await runMySQLQuery<Record<string, unknown>[]>("SELECT UUID() AS uuid;");
    if (res.success && Array.isArray(res.data) && res.data[0]?.["uuid"]) {
      return String(res.data[0]["uuid"]);
    }
  } catch (err) {
    console.warn("fetchDbUUID fallback:", err);
  }
  // Client-side fallback only if database connection is completely down
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

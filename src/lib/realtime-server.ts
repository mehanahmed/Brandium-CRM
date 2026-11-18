/**
 * Live change feed for every signed-in page (Server-Sent Events). Subscribers live on globalThis so
 * `next dev` hot reloads keep one registry. This only reaches clients of the same Node process.
 */
type Subscriber = { id: number; send: (chunk: string) => void };

const registry = globalThis as typeof globalThis & {
  __brandiumRealtime?: { subscribers: Map<number, Subscriber>; nextId: number };
};

const state = () => (registry.__brandiumRealtime ??= { subscribers: new Map(), nextId: 1 });

export function subscribe(send: (chunk: string) => void): () => void {
  const current = state();
  const id = current.nextId++;
  current.subscribers.set(id, { id, send });
  return () => {
    current.subscribers.delete(id);
  };
}

/** Tells every open page that data changed. Clients refetch their active queries. */
export function broadcastChange(tables: string[]): void {
  const current = state();
  const payload = `data: ${JSON.stringify({ tables })}\n\n`;
  for (const subscriber of current.subscribers.values()) {
    try {
      subscriber.send(payload);
    } catch {
      current.subscribers.delete(subscriber.id);
    }
  }
}

/** Tables a write statement changes (best effort; clients only use it as a hint). */
export function tablesWrittenBy(sql: string): string[] {
  const tables = new Set<string>();
  const pattern =
    /\b(?:insert\s+(?:ignore\s+)?into|update|replace\s+into|delete\s+from)\s+`?([a-z_][a-z0-9_]*)`?/gi;
  for (const match of sql.matchAll(pattern)) tables.add(String(match[1]).toLowerCase());
  return [...tables];
}

export const isWriteSql = (sql: string) => /^\s*(insert|update|delete|replace)\b/i.test(sql);

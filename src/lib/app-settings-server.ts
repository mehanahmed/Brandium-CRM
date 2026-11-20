// Server only: app settings (invoice/quotation letterhead, maintenance mode).
import { getMySQLPool } from "@/lib/mysql-server";
import { ensureBootstrapped } from "@/lib/crm.functions";
import type { AppSettings } from "@/lib/app-settings";

type Row = Record<string, unknown>;

const DEFAULTS: AppSettings = {
  invoice_bg_url: null,
  maintenance_mode: false,
  maintenance_message: "",
  updated_at: null,
};

// Read on every non-admin /api/mysql request for the maintenance check, so keep a short cache.
// On globalThis so `next dev` reloads share it.
const CACHE_MS = 10_000;
const store = globalThis as typeof globalThis & {
  __brandiumAppSettings?: { value: AppSettings; at: number };
  __brandiumSchemaLatch?: { done: boolean };
};

/**
 * Runs `fn` against `app_settings`. A server that bootstrapped its schema before this table
 * existed has its latch set and never creates it; on "no such table" the latch is reset and the
 * (idempotent) bootstrap runs once more.
 */
async function withSettingsTable<T>(fn: () => Promise<T>): Promise<T> {
  await ensureBootstrapped();
  try {
    return await fn();
  } catch (err) {
    if ((err as { code?: string }).code !== "ER_NO_SUCH_TABLE") throw err;
    if (store.__brandiumSchemaLatch) store.__brandiumSchemaLatch.done = false;
    await ensureBootstrapped();
    return fn();
  }
}

/**
 * Never throws: when the settings cannot be read, the app keeps running with the defaults
 * (maintenance off, built-in letterhead), so a settings problem cannot lock everyone out.
 */
export async function loadAppSettings(fresh = false): Promise<AppSettings> {
  const cached = store.__brandiumAppSettings;
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  let value = DEFAULTS;
  try {
    const pool = await getMySQLPool();
    const [rows] = await withSettingsTable(() =>
      pool.query(
        "SELECT invoice_bg_url, maintenance_mode, maintenance_message, updated_at FROM `app_settings` WHERE `id` = 'default' LIMIT 1",
      ),
    );
    const r: Row = (rows as Row[])[0] || {};
    value = {
      invoice_bg_url: r["invoice_bg_url"] ? String(r["invoice_bg_url"]) : null,
      maintenance_mode: Number(r["maintenance_mode"] ?? 0) === 1,
      maintenance_message: r["maintenance_message"] ? String(r["maintenance_message"]) : "",
      updated_at: r["updated_at"] ? String(r["updated_at"]) : null,
    };
  } catch (err) {
    console.error("App settings could not be read; using defaults:", err);
  }
  store.__brandiumAppSettings = { value, at: Date.now() };
  return value;
}

/** A copy was found on another domain: switch maintenance mode on with a lock message. */
export async function lockForUnlicensedCopy(host: string) {
  const pool = await getMySQLPool();
  const message = `Brandium CRM is locked: an unauthorised copy was found running on ${host}. Contact the administrator.`;
  await withSettingsTable(() =>
    pool.query(
      `INSERT INTO \`app_settings\` (\`id\`, \`maintenance_mode\`, \`maintenance_message\`, \`updated_by\`)
       VALUES ('default', 1, ?, 'license-lock')
       ON DUPLICATE KEY UPDATE maintenance_mode = 1, maintenance_message = VALUES(maintenance_message),
         updated_by = 'license-lock'`,
      [message],
    ),
  );
  delete store.__brandiumAppSettings;
  console.error(
    `LICENSE LOCK: unauthorised copy reported on ${host}; maintenance mode switched on.`,
  );
}

export async function saveAppSettings(
  input: Pick<AppSettings, "invoice_bg_url" | "maintenance_mode" | "maintenance_message">,
  userId: string,
) {
  const pool = await getMySQLPool();
  // UPSERT so a missing 'default' row is created rather than silently updating nothing
  await withSettingsTable(() =>
    pool.query(
      `INSERT INTO \`app_settings\` (\`id\`, \`invoice_bg_url\`, \`maintenance_mode\`, \`maintenance_message\`, \`updated_by\`)
       VALUES ('default', ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE invoice_bg_url = VALUES(invoice_bg_url),
         maintenance_mode = VALUES(maintenance_mode),
         maintenance_message = VALUES(maintenance_message), updated_by = VALUES(updated_by)`,
      [input.invoice_bg_url, input.maintenance_mode ? 1 : 0, input.maintenance_message, userId],
    ),
  );
  delete store.__brandiumAppSettings;
}

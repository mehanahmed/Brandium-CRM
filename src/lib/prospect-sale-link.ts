import { runMySQLQuery, runMySQLWrite } from "@/lib/mysql-api";
import { generateUUID, getMySQLTimestamp } from "@/lib/mysql-client";

/** Pipeline stage a sale moves its lead to (ids seeded in ensureMySQLTablesExist). */
const TARGETS = {
  order: { id: "sales-won", name: "sales won" },
  quotation: { id: "quotation-sent", name: "quotation sent" },
} as const;

export type SaleKind = keyof typeof TARGETS;
export type SaleLinkResult = "moved" | "logged" | "no-match";

/** Last 9 digits: the subscriber number, so +880 1XXX, 01XXX and 1XXX all match. */
export const phoneKey = (raw: string | null | undefined) =>
  (raw || "").replace(/\D/g, "").slice(-9);

const DIGITS = (column: string) =>
  `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${column}, ''), ' ', ''), '-', ''), '+', ''), '(', ''), ')', '')`;

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/[-_\s]+/g, " ")
    .trim();

/**
 * After an order or quotation is created: finds its lead (by `prospectId`, else by phone) and
 * moves it to Sales won (order) or Quotation Sent (quotation), with an activity row.
 * A quotation never moves a lead that is already won; it only adds the activity.
 * Reads go through `/api/mysql`, so a non-admin only reaches leads they can see.
 */
export async function linkSaleToProspect(input: {
  kind: SaleKind;
  prospectId?: string | null | undefined;
  phone?: string | null | undefined;
  note: string;
  userId?: string | null | undefined;
}): Promise<SaleLinkResult> {
  const key = phoneKey(input.phone);
  if (!input.prospectId && key.length < 9) return "no-match";

  const select = `SELECT p.id, p.stage_id, st.stage_group
     FROM \`prospects\` p
     LEFT JOIN \`stages\` st ON (p.stage_id = st.id OR p.stage_id = REPLACE(st.id, '-', '_') OR p.stage_id = st.name)
     WHERE (p.is_active = 1 OR p.is_active IS NULL) AND `;
  const found = input.prospectId
    ? await runMySQLQuery<Record<string, unknown>[]>(`${select}p.id = ? LIMIT 1;`, [
        input.prospectId,
      ])
    : await runMySQLQuery<Record<string, unknown>[]>(
        `${select}(${DIGITS("p.phone")} LIKE ? OR ${DIGITS("p.alternative_phone")} LIKE ?)
         ORDER BY p.created_at DESC LIMIT 1;`,
        [`%${key}`, `%${key}`],
      );
  if (!found.success) throw new Error(found.error || "Could not look up the prospect.");
  const lead = found.data?.[0];
  if (!lead) return "no-match";

  const target = TARGETS[input.kind];
  const stageRes = await runMySQLQuery<Record<string, unknown>[]>(
    "SELECT `id` FROM `stages` WHERE `id` = ? OR LOWER(TRIM(`name`)) = ? LIMIT 1;",
    [target.id, target.name],
  );
  const targetId = String(stageRes.data?.[0]?.["id"] || target.id);

  const prospectId = String(lead["id"]);
  const fromStageId = lead["stage_id"] ? String(lead["stage_id"]) : null;
  const alreadyThere = fromStageId !== null && norm(fromStageId) === norm(targetId);
  const wouldDowngrade = input.kind === "quotation" && lead["stage_group"] === "won";
  const move = !alreadyThere && !wouldDowngrade;
  const now = getMySQLTimestamp();

  if (move) {
    const changed = await runMySQLWrite(
      "UPDATE `prospects` SET `stage_id` = ?, `updated_at` = ? WHERE `id` = ?;",
      [targetId, now, prospectId],
    );
    if (changed === 0) return "no-match";
  }
  // The activity row: a stage transition when it moved, otherwise a note on the current stage
  await runMySQLWrite(
    `INSERT INTO \`prospect_stage_history\`
       (\`id\`, \`prospect_id\`, \`from_stage_id\`, \`to_stage_id\`, \`changed_by\`, \`note\`, \`changed_at\`)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      generateUUID(),
      prospectId,
      fromStageId,
      move ? targetId : fromStageId,
      input.userId || null,
      input.note,
      now,
    ],
  );
  return move ? "moved" : "logged";
}

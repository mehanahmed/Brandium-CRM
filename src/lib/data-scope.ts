/**
 * Per-role data access: for each data area a role sees either its own rows (default) or every
 * user's rows. "All" is the permission `perm-scope-all-<area>` in `role_permissions`.
 * Pages that read the same tables share one area, so their settings always match.
 */
export const DATA_SCOPE_AREAS = {
  leads: {
    label: "Leads",
    tables: ["prospects", "prospect_stage_history", "activities"],
    pages: ["/prospects", "/follow-ups"],
  },
  meetings: { label: "Meetings", tables: ["meetings"], pages: ["/meetings"] },
  quotations: {
    label: "Quotations",
    tables: ["quotations", "quotation_assignees"],
    pages: ["/quotations"],
  },
  orders: {
    label: "Orders & Projects",
    tables: ["orders", "order_comments", "projects", "project_assignees"],
    pages: ["/orders", "/projects"],
  },
  sms: { label: "SMS", tables: ["sms_logs"], pages: ["/sms/send", "/sms/logs"] },
  expenses: { label: "Expenses", tables: ["expenses"], pages: ["/expenses"] },
} as const;

export type DataScopeArea = keyof typeof DATA_SCOPE_AREAS;

export const scopeAllPermissionId = (area: DataScopeArea) => `perm-scope-all-${area}`;

export const SCOPE_ALL_PREFIX = "perm-scope-all-";

/** The area a sidebar page reads, or undefined when the page has no per-user data. */
export const dataScopeAreaForPage = (url: string): DataScopeArea | undefined =>
  (Object.keys(DATA_SCOPE_AREAS) as DataScopeArea[]).find((area) =>
    (DATA_SCOPE_AREAS[area].pages as readonly string[]).includes(url),
  );

/** Tables a role may read unscoped, from its `perm-scope-all-*` permission ids. */
export function unscopedTablesFor(permissionIds: readonly string[]): Set<string> {
  const tables = new Set<string>();
  for (const id of permissionIds) {
    if (!id.startsWith(SCOPE_ALL_PREFIX)) continue;
    const area = id.slice(SCOPE_ALL_PREFIX.length) as DataScopeArea;
    DATA_SCOPE_AREAS[area]?.tables.forEach((t) => tables.add(t));
  }
  return tables;
}

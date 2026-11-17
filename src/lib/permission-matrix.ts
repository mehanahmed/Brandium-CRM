/**
 * Extra permission rows for the Roles matrix. A page's Create, Edit, View and Delete boxes each
 * need their own permission id; the first box keeps the page's sidebar id (the sidebar and admin
 * pages check it), and later boxes use these `<base>-<action>` ids. Keep PAGE_ACTIONS in
 * `admin/roles/page.tsx` in step with this list. Seeded into `permissions` by auth.functions.
 */
export type MatrixPermission = {
  id: string;
  resource: string;
  action: string;
  description: string;
};

export const MATRIX_EXTRA_PERMISSIONS: MatrixPermission[] = [
  {
    id: "perm-prospects-write-edit",
    resource: "prospects",
    action: "write-edit",
    description: "Edit prospects",
  },
  {
    id: "perm-followups-manage-edit",
    resource: "follow_ups",
    action: "manage-edit",
    description: "Edit follow-ups",
  },
  {
    id: "perm-followups-manage-view",
    resource: "follow_ups",
    action: "manage-view",
    description: "View follow-ups",
  },
  {
    id: "perm-followups-manage-delete",
    resource: "follow_ups",
    action: "manage-delete",
    description: "Delete follow-ups",
  },
  {
    id: "perm-meetings-manage-edit",
    resource: "meetings",
    action: "manage-edit",
    description: "Edit meetings",
  },
  {
    id: "perm-meetings-manage-view",
    resource: "meetings",
    action: "manage-view",
    description: "View meetings",
  },
  {
    id: "perm-meetings-manage-delete",
    resource: "meetings",
    action: "manage-delete",
    description: "Delete meetings",
  },
  {
    id: "perm-quotations-write-edit",
    resource: "quotations",
    action: "write-edit",
    description: "Edit quotations",
  },
  {
    id: "perm-orders-manage-edit",
    resource: "orders",
    action: "manage-edit",
    description: "Edit orders",
  },
  {
    id: "perm-orders-manage-delete",
    resource: "orders",
    action: "manage-delete",
    description: "Delete orders",
  },
  {
    id: "perm-projects-manage-edit",
    resource: "projects",
    action: "manage-edit",
    description: "Edit projects",
  },
  {
    id: "perm-projects-manage-delete",
    resource: "projects",
    action: "manage-delete",
    description: "Delete projects",
  },
  {
    id: "perm-sms-send-view",
    resource: "sms",
    action: "send-view",
    description: "View the Send SMS page",
  },
  {
    id: "perm-expenses-manage-edit",
    resource: "expenses",
    action: "manage-edit",
    description: "Edit expenses",
  },
  {
    id: "perm-expenses-manage-delete",
    resource: "expenses",
    action: "manage-delete",
    description: "Delete expenses",
  },
  {
    id: "perm-admin-users-edit",
    resource: "users",
    action: "admin-edit",
    description: "Edit user accounts",
  },
  {
    id: "perm-admin-users-view",
    resource: "users",
    action: "admin-view",
    description: "View user accounts",
  },
  {
    id: "perm-admin-users-delete",
    resource: "users",
    action: "admin-delete",
    description: "Delete user accounts",
  },
  {
    id: "perm-admin-roles-edit",
    resource: "roles",
    action: "admin-edit",
    description: "Edit roles",
  },
  {
    id: "perm-admin-roles-view",
    resource: "roles",
    action: "admin-view",
    description: "View roles",
  },
  {
    id: "perm-admin-roles-delete",
    resource: "roles",
    action: "admin-delete",
    description: "Delete roles",
  },
  {
    id: "perm-services-manage-edit",
    resource: "services",
    action: "manage-edit",
    description: "Edit services",
  },
  {
    id: "perm-services-manage-delete",
    resource: "services",
    action: "manage-delete",
    description: "Delete services",
  },
  {
    id: "perm-admin-sms-gateway-view",
    resource: "sms_gateway",
    action: "admin-view",
    description: "View SMS Gateway settings",
  },
  {
    id: "perm-stages-manage-edit",
    resource: "stages",
    action: "manage-edit",
    description: "Edit pipeline stages",
  },
  {
    id: "perm-stages-manage-view",
    resource: "stages",
    action: "manage-view",
    description: "View pipeline stages",
  },
  {
    id: "perm-stages-manage-delete",
    resource: "stages",
    action: "manage-delete",
    description: "Delete pipeline stages",
  },
  {
    id: "perm-admin-backup-edit",
    resource: "backup",
    action: "admin-edit",
    description: "Edit backup settings",
  },
  {
    id: "perm-admin-backup-view",
    resource: "backup",
    action: "admin-view",
    description: "View database backups",
  },
  {
    id: "perm-admin-backup-delete",
    resource: "backup",
    action: "admin-delete",
    description: "Delete database backups",
  },
];

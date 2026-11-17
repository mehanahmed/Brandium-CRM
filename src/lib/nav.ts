import {
  LayoutDashboard,
  Users2,
  CalendarDays,
  MessageSquarePlus,
  MessagesSquare,
  RadioTower,
  ReceiptText,
  Activity,
  UserCog,
  Package,
  Workflow,
  ScrollText,
  DatabaseBackup,
  ShieldCheck,
  FolderKanban,
  FileSpreadsheet,
  ShoppingCart,
  PhoneCall,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: string;
};

export type NavGroup = {
  label: string;
  adminOnly?: boolean;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Prospects", url: "/prospects", icon: Users2, permission: "perm-prospects-read" },
      {
        title: "Follow UP",
        url: "/follow-ups",
        icon: PhoneCall,
        permission: "perm-followups-manage",
      },
      {
        title: "Meetings",
        url: "/meetings",
        icon: CalendarDays,
        permission: "perm-meetings-manage",
      },
      {
        title: "Quotations",
        url: "/quotations",
        icon: FileSpreadsheet,
        permission: "perm-quotations-read",
      },
      { title: "Orders", url: "/orders", icon: ShoppingCart, permission: "perm-orders-read" },
      { title: "Projects", url: "/projects", icon: FolderKanban, permission: "perm-projects-read" },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "Send SMS", url: "/sms/send", icon: MessageSquarePlus, permission: "perm-sms-send" },
      { title: "SMS Logs", url: "/sms/logs", icon: MessagesSquare, permission: "perm-sms-logs" },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Expenses", url: "/expenses", icon: ReceiptText, permission: "perm-expenses-read" },
    ],
  },
  {
    label: "Analytics",
    items: [
      {
        title: "Agent Activity",
        url: "/agent-activity",
        icon: Activity,
        permission: "perm-reports-view",
      },
    ],
  },
  {
    label: "Administration",
    adminOnly: true,
    items: [
      { title: "Users", url: "/admin/users", icon: UserCog, permission: "perm-admin-users" },
      {
        title: "Role Management",
        url: "/admin/roles",
        icon: ShieldCheck,
        permission: "perm-admin-roles",
      },
      {
        title: "Services",
        url: "/admin/services",
        icon: Package,
        permission: "perm-services-read",
      },
      {
        title: "SMS Gateway",
        url: "/admin/sms-gateway",
        icon: RadioTower,
        permission: "perm-admin-sms-gateway",
      },
      {
        title: "Agent Reports",
        url: "/admin/agent-reports",
        icon: Activity,
        permission: "perm-reports-view",
      },
      {
        title: "Stage Management",
        url: "/admin/stages",
        icon: Workflow,
        permission: "perm-stages-manage",
      },
      {
        title: "Stage History",
        url: "/admin/stage-history",
        icon: ScrollText,
        permission: "perm-stage-history-view",
      },
      {
        title: "Data Backup",
        url: "/admin/data-backup",
        icon: DatabaseBackup,
        permission: "perm-admin-backup",
      },
    ],
  },
];

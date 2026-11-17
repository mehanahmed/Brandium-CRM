"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Shield,
  Trash2,
  RefreshCw,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronRight,
  ArrowLeft,
  Lock,
  AlertTriangle,
  X,
  Minimize2,
  Link2,
  UserRound,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { navGroups } from "@/lib/nav";
import { dataScopeAreaForPage, scopeAllPermissionId, type DataScopeArea } from "@/lib/data-scope";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  rolesQueryOptions,
  permissionsQueryOptions,
  useSaveRoleMutation,
  useDeleteRoleMutation,
  type CrmRoleItem,
  type RolePermissionItem,
} from "@/lib/roles";

// One row per sidebar page, built from `navGroups` so this matrix always matches the sidebar.
interface ModuleDefinition {
  id: string;
  subModule: string;
  group: string;
  /** Data area for the Own / All users' data choice; pages sharing data share an area. */
  area?: DataScopeArea | undefined;
  createPermId?: string | undefined;
  editPermId?: string | undefined;
  viewPermId?: string | undefined;
  deletePermId?: string | undefined;
}

type PageActions = Pick<
  ModuleDefinition,
  "createPermId" | "editPermId" | "viewPermId" | "deletePermId"
>;

const all = (id: string): PageActions => ({
  createPermId: id,
  editPermId: id,
  viewPermId: id,
  deletePermId: id,
});

// Create / Edit / View / Delete permission per page; a page not listed only has View (its sidebar permission)
const PAGE_ACTIONS: Record<string, PageActions> = {
  "/prospects": {
    createPermId: "perm-prospects-write",
    editPermId: "perm-prospects-write",
    viewPermId: "perm-prospects-read",
    deletePermId: "perm-prospects-delete",
  },
  "/follow-ups": all("perm-followups-manage"),
  "/meetings": all("perm-meetings-manage"),
  "/quotations": {
    createPermId: "perm-quotations-write",
    editPermId: "perm-quotations-write",
    viewPermId: "perm-quotations-read",
    deletePermId: "perm-quotations-delete",
  },
  "/orders": {
    createPermId: "perm-orders-manage",
    editPermId: "perm-orders-manage",
    viewPermId: "perm-orders-read",
    deletePermId: "perm-orders-manage",
  },
  "/projects": {
    createPermId: "perm-projects-manage",
    editPermId: "perm-projects-manage",
    viewPermId: "perm-projects-read",
    deletePermId: "perm-projects-manage",
  },
  "/sms/send": { createPermId: "perm-sms-send", viewPermId: "perm-sms-send" },
  "/expenses": {
    createPermId: "perm-expenses-manage",
    editPermId: "perm-expenses-manage",
    viewPermId: "perm-expenses-read",
    deletePermId: "perm-expenses-manage",
  },
  "/admin/users": all("perm-admin-users"),
  "/admin/roles": all("perm-admin-roles"),
  "/admin/services": {
    createPermId: "perm-services-manage",
    editPermId: "perm-services-manage",
    viewPermId: "perm-services-read",
    deletePermId: "perm-services-manage",
  },
  "/admin/sms-gateway": {
    editPermId: "perm-admin-sms-gateway",
    viewPermId: "perm-admin-sms-gateway",
  },
  "/admin/stages": all("perm-stages-manage"),
  "/admin/data-backup": all("perm-admin-backup"),
};

const CRM_MODULE_DEFINITIONS: ModuleDefinition[] = navGroups.flatMap((group) =>
  group.items.map((item) => ({
    id: item.url,
    subModule: item.title,
    group: group.label,
    area: dataScopeAreaForPage(item.url),
    ...(PAGE_ACTIONS[item.url] ?? { viewPermId: item.permission }),
  })),
);

const rowPermIds = (m: ModuleDefinition) =>
  [m.createPermId, m.editPermId, m.viewPermId, m.deletePermId].filter(Boolean) as string[];

export default function AdminRolesPage() {
  const [activeView, setActiveView] = useState<"roles" | "permissions">("roles");
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<CrmRoleItem | null>(null);

  const [search, setSearch] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [addRoleModalOpen, setAddRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [editRoleModal, setEditRoleModal] = useState<{ open: boolean; role: CrmRoleItem | null }>({
    open: false,
    role: null,
  });
  const [editRoleName, setEditRoleName] = useState("");
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; role: CrmRoleItem | null }>({
    open: false,
    role: null,
  });

  const {
    data: roles = [],
    isLoading: isRolesLoading,
    refetch: refetchRoles,
  } = useQuery(rolesQueryOptions());
  const { data: permissions = [] } = useQuery(permissionsQueryOptions());

  const saveRoleMutation = useSaveRoleMutation();
  const deleteRoleMutation = useDeleteRoleMutation();

  const filteredRoles = useMemo(() => {
    if (!search.trim()) return roles;
    const q = search.toLowerCase().trim();
    return roles.filter((r) => r.name.toLowerCase().includes(q));
  }, [roles, search]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRoleIds(filteredRoles.map((r) => r.id));
    } else {
      setSelectedRoleIds([]);
    }
  };

  const handleToggleRoleSelect = (id: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id],
    );
  };

  const handleOpenEdit = (role: CrmRoleItem) => {
    setEditRoleName(role.name);
    setEditRoleModal({ open: true, role });
  };

  const handleOpenPermissions = (role: CrmRoleItem) => {
    setSelectedRoleForPerms(role);
    setActiveView("permissions");
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    await saveRoleMutation.mutateAsync({
      name: newRoleName.trim(),
      permission_ids: ["perm-prospects-read"],
    });
    setNewRoleName("");
    setAddRoleModalOpen(false);
  };

  const handleSaveEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoleModal.role || !editRoleName.trim()) return;
    await saveRoleMutation.mutateAsync({
      id: editRoleModal.role.id,
      name: editRoleName.trim(),
      description: editRoleModal.role.description,
      permission_ids: editRoleModal.role.permission_ids,
    });
    setEditRoleModal({ open: false, role: null });
  };

  const formatCrmsDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  // If in Permissions Matrix View
  if (activeView === "permissions" && selectedRoleForPerms) {
    return (
      <PermissionMatrixView
        role={selectedRoleForPerms}
        allPermissions={permissions}
        onBack={() => {
          setActiveView("roles");
          setSelectedRoleForPerms(null);
          refetchRoles();
        }}
        onSaveRole={async (payload) => {
          await saveRoleMutation.mutateAsync(payload);
          refetchRoles();
        }}
        isSaving={saveRoleMutation.isPending}
      />
    );
  }

  // Roles & Permissions List View (roles-permissions.html)
  return (
    <div className="space-y-4 font-sans text-slate-800 dark:text-slate-200">
      {/* Page Header matching Dreamstechnologies CRMS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Roles & Permissions
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              {roles.length}
            </span>
          </h4>
          <nav aria-label="breadcrumb" className="mt-1">
            <ol className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <li className="hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">
                Home
              </li>
              <ChevronRight className="size-3 text-slate-400" />
              <li className="font-semibold text-slate-700 dark:text-slate-300">
                Roles & Permissions
              </li>
            </ol>
          </nav>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-medium bg-white dark:bg-card border-slate-200 dark:border-slate-800 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer h-9 px-3"
              >
                <Download className="size-3.5 text-slate-500" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs w-40">
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => toast.info("Exporting as PDF...")}
              >
                <FileText className="size-3.5 text-red-500" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => toast.info("Exporting as Excel...")}
              >
                <FileSpreadsheet className="size-3.5 text-green-600" /> Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="icon"
            className="size-9 bg-white dark:bg-card border-slate-200 dark:border-slate-800 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer"
            onClick={() => {
              refetchRoles();
              toast.success("Refreshed roles list!");
            }}
            title="Refresh"
          >
            <RefreshCw className="size-3.5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="size-9 bg-white dark:bg-card border-slate-200 dark:border-slate-800 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer"
            title="Collapse"
          >
            <Minimize2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Card with exact CRMS table design */}
      <div className="bg-white dark:bg-card border border-slate-200/80 dark:border-slate-800 shadow-xs rounded-xl overflow-hidden">
        {/* Card Header: Search on Left, Add New Role on Right */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 text-xs h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <Button
            onClick={() => setAddRoleModalOpen(true)}
            className="gap-1.5 text-xs font-semibold bg-[#67B239] hover:bg-[#5aa030] text-white shadow-xs rounded-lg h-9 px-4 cursor-pointer"
          >
            <Plus className="size-4" /> Add New Role
          </Button>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#f8f9fa] dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">
                  <Checkbox
                    checked={
                      filteredRoles.length > 0 &&
                      filteredRoles.every((r) => selectedRoleIds.includes(r.id))
                    }
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="py-3 px-4 font-semibold text-xs">Role Name</th>
                <th className="py-3 px-4 font-semibold text-xs">Created</th>
                <th className="py-3 px-6 text-right font-semibold text-xs w-28">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {isRolesLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx}>
                    <td colSpan={4} className="py-4 px-4">
                      <div className="h-6 w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              ) : filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <Shield className="size-8 mx-auto text-slate-300 mb-2 opacity-60" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                      No roles found
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Try searching with a different term or add a new role.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role) => (
                  <tr
                    key={role.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 text-center">
                      <Checkbox
                        checked={selectedRoleIds.includes(role.id)}
                        onCheckedChange={() => handleToggleRoleSelect(role.id)}
                        aria-label={`Select ${role.name}`}
                      />
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <span>{role.name}</span>
                        {role.is_system && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] py-0 px-1.5 h-4 font-normal gap-1 text-slate-500 bg-slate-100 dark:bg-slate-800 border-none"
                          >
                            <Lock className="size-2.5 text-purple-600" /> System
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatCrmsDate(role.created_at)}
                    </td>
                    <td className="py-3.5 px-6 text-right whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7 rounded-lg border-slate-200 dark:border-slate-800 shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                          >
                            <MoreVertical className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="text-xs w-36 p-1 rounded-xl shadow-lg border-slate-200 dark:border-slate-800"
                        >
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer font-medium"
                            onClick={() => handleOpenEdit(role)}
                          >
                            <Pencil className="size-3.5 text-blue-600" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer font-medium"
                            onClick={() => handleOpenPermissions(role)}
                          >
                            <Shield className="size-3.5 text-slate-600 dark:text-slate-400" />{" "}
                            Permission
                          </DropdownMenuItem>
                          {!role.is_system && (
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer font-medium text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950/40"
                              onClick={() => setDeleteModal({ open: true, role })}
                            >
                              <Trash2 className="size-3.5 text-red-600" /> Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Role Modal matching CRMS modal design */}
      <Dialog open={addRoleModalOpen} onOpenChange={setAddRoleModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
              Add Role
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRole}>
            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Role Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="Enter role name"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="text-xs h-9 rounded-lg"
                  required
                />
              </div>
            </div>
            <DialogFooter className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 gap-2">
              <Button
                type="button"
                variant="outline"
                className="text-xs h-9 px-4 rounded-lg bg-white dark:bg-card border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                onClick={() => setAddRoleModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveRoleMutation.isPending || !newRoleName.trim()}
                className="text-xs h-9 px-5 font-semibold bg-[#67B239] hover:bg-[#5aa030] text-white rounded-lg shadow-xs cursor-pointer"
              >
                {saveRoleMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal matching CRMS modal design */}
      <Dialog
        open={editRoleModal.open}
        onOpenChange={(open) => setEditRoleModal({ open, role: null })}
      >
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
              Edit Role
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEditRole}>
            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Role Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={editRoleName}
                  onChange={(e) => setEditRoleName(e.target.value)}
                  className="text-xs h-9 rounded-lg"
                  required
                  disabled={editRoleModal.role?.is_system}
                />
                {editRoleModal.role?.is_system && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                    <Lock className="size-3" /> System role name cannot be modified.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 gap-2">
              <Button
                type="button"
                variant="outline"
                className="text-xs h-9 px-4 rounded-lg bg-white dark:bg-card border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                onClick={() => setEditRoleModal({ open: false, role: null })}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveRoleMutation.isPending || !editRoleName.trim()}
                className="text-xs h-9 px-5 font-semibold bg-[#67B239] hover:bg-[#5aa030] text-white rounded-lg shadow-xs cursor-pointer"
              >
                {saveRoleMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={deleteModal.open}
        onOpenChange={(open: boolean) => setDeleteModal({ open, role: null })}
      >
        <AlertDialogContent className="rounded-2xl border border-slate-200 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="size-5" /> Delete Role
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {deleteModal.role && deleteModal.role.user_count > 0 ? (
                <span className="block p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200">
                  <strong>Cannot delete role:</strong> Role{" "}
                  <strong className="underline">"{deleteModal.role.name}"</strong> currently has{" "}
                  <strong>{deleteModal.role.user_count}</strong> active user(s) assigned. Please
                  reassign those users in User Management first.
                </span>
              ) : (
                <>
                  Are you sure you want to delete role{" "}
                  <strong className="text-foreground">"{deleteModal.role?.name}"</strong>? This
                  action cannot be undone. All assigned permissions for this custom role will be
                  removed.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs rounded-lg cursor-pointer">
              Cancel
            </AlertDialogCancel>
            {deleteModal.role && deleteModal.role.user_count === 0 && (
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                disabled={deleteRoleMutation.isPending}
                onClick={async () => {
                  if (deleteModal.role) {
                    await deleteRoleMutation.mutateAsync(deleteModal.role);
                    setDeleteModal({ open: false, role: null });
                  }
                }}
              >
                {deleteRoleMutation.isPending ? "Deleting..." : "Confirm Delete"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// Permission Matrix Component (Matching permission.html from Dreamstechnologies CRMS)
// -------------------------------------------------------------------------------------------------
interface PermissionMatrixViewProps {
  role: CrmRoleItem;
  allPermissions: RolePermissionItem[];
  onBack: () => void;
  onSaveRole: (payload: {
    id: string;
    name: string;
    description: string | null;
    permission_ids: string[];
  }) => Promise<void>;
  isSaving: boolean;
}

function PermissionMatrixView({ role, onBack, onSaveRole, isSaving }: PermissionMatrixViewProps) {
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>(role.permission_ids || []);

  const allKnownPermIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of CRM_MODULE_DEFINITIONS) rowPermIds(m).forEach((id) => ids.add(id));
    return Array.from(ids);
  }, []);

  // Admins (by name or Role Management access, same rule as the server session) see everything
  const isAdminRole =
    role.name.trim().toLowerCase() === "admin" || selectedPermIds.includes("perm-admin-roles");

  const changeCount = useMemo(() => {
    const before = new Set(role.permission_ids || []);
    const after = new Set(selectedPermIds);
    let n = 0;
    before.forEach((id) => !after.has(id) && n++);
    after.forEach((id) => !before.has(id) && n++);
    return n;
  }, [role.permission_ids, selectedPermIds]);

  const isAllModulesAllowed =
    allKnownPermIds.length > 0 && allKnownPermIds.every((id) => selectedPermIds.includes(id));

  const handleToggleAllowAllModules = (checked: boolean) => {
    setSelectedPermIds((prev) =>
      checked
        ? Array.from(new Set([...prev, ...allKnownPermIds]))
        : prev.filter((id) => !allKnownPermIds.includes(id)),
    );
  };

  const handleToggleRowAllowAll = (moduleDef: ModuleDefinition, checked: boolean) => {
    const rowIds = rowPermIds(moduleDef);
    setSelectedPermIds((prev) =>
      checked
        ? Array.from(new Set([...prev, ...rowIds]))
        : prev.filter((id) => !rowIds.includes(id)),
    );
  };

  const toggleSinglePerm = (permId?: string) => {
    if (!permId) return;
    setSelectedPermIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId],
    );
  };

  const setDataAccess = (area: DataScopeArea, value: "own" | "all") => {
    const permId = scopeAllPermissionId(area);
    setSelectedPermIds((prev) =>
      value === "all" ? Array.from(new Set([...prev, permId])) : prev.filter((id) => id !== permId),
    );
  };

  const isRowAllAllowed = (m: ModuleDefinition) => {
    const rowIds = rowPermIds(m);
    return rowIds.length > 0 && rowIds.every((id) => selectedPermIds.includes(id));
  };

  const handleSave = async () => {
    await onSaveRole({
      id: role.id,
      name: role.name,
      description: role.description,
      permission_ids: selectedPermIds,
    });
    toast.success(`Permissions for role "${role.name}" updated successfully!`);
    onBack();
  };

  const checkboxClass =
    "size-4.5 data-[state=checked]:bg-[#67B239] data-[state=checked]:border-[#67B239]";

  const permCell = (id: string | undefined, label: string) => (
    // Plain call, not <PermCell />: a component defined in render remounts and drops focus
    <td key={label} className="px-2 py-2.5 text-center">
      {id ? (
        <Checkbox
          checked={selectedPermIds.includes(id)}
          onCheckedChange={() => toggleSinglePerm(id)}
          aria-label={label}
          className={checkboxClass}
        />
      ) : (
        <span className="text-slate-300 dark:text-slate-600" aria-label="Not applicable">
          –
        </span>
      )}
    </td>
  );

  let lastGroup = "";

  return (
    <div className="space-y-5 pb-24 font-sans text-slate-800 dark:text-slate-200">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-2 h-8 gap-1.5 px-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <ArrowLeft className="size-4" /> Roles
          </Button>
          <h1 className="mt-1 flex flex-wrap items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {role.name}
            <span className="rounded-full bg-[#67B239]/15 px-2.5 py-0.5 text-xs font-semibold text-[#55962e] dark:text-[#7ac142]">
              {isAdminRole ? "Full access" : `${selectedPermIds.length} permissions`}
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Choose what this role can do on each page, and whether it sees only its own records or
            everyone&apos;s.
          </p>
        </div>
        <label className="flex cursor-pointer select-none items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 sm:self-auto dark:border-slate-800 dark:bg-card dark:text-slate-300">
          <Checkbox
            checked={isAllModulesAllowed}
            onCheckedChange={(c) => handleToggleAllowAllModules(Boolean(c))}
            className={checkboxClass}
          />
          Allow every page action
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-card">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-200 border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-600 shadow-[inset_0_-1px_0_rgb(226_232_240)] dark:bg-slate-900 dark:text-slate-300 dark:shadow-[inset_0_-1px_0_rgb(30_41_59)]">
              <tr>
                <th scope="col" className="w-12 px-4 py-3 text-center">
                  <span className="sr-only">Allow all on row</span>
                </th>
                <th scope="col" className="px-2 py-3">
                  Page
                </th>
                <th scope="col" className="w-20 px-2 py-3 text-center">
                  Create
                </th>
                <th scope="col" className="w-20 px-2 py-3 text-center">
                  Edit
                </th>
                <th scope="col" className="w-20 px-2 py-3 text-center">
                  View
                </th>
                <th scope="col" className="w-20 px-2 py-3 text-center">
                  Delete
                </th>
                <th scope="col" className="w-56 px-4 py-3">
                  Data access
                </th>
              </tr>
            </thead>
            <tbody>
              {CRM_MODULE_DEFINITIONS.flatMap((m) => {
                const rows: React.ReactNode[] = [];
                if (m.group !== lastGroup) {
                  lastGroup = m.group;
                  rows.push(
                    <tr key={`group-${m.group}`} className="bg-white dark:bg-card">
                      <th
                        scope="rowgroup"
                        colSpan={7}
                        className="px-4 pb-1.5 pt-5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"
                      >
                        {m.group}
                      </th>
                    </tr>,
                  );
                }
                const isAlwaysOn = rowPermIds(m).length === 0;
                const rowAll = isAlwaysOn || isRowAllAllowed(m);
                const area = m.area;
                const scopeValue: "own" | "all" =
                  area && (isAdminRole || selectedPermIds.includes(scopeAllPermissionId(area)))
                    ? "all"
                    : "own";
                const linked = area
                  ? CRM_MODULE_DEFINITIONS.filter((o) => o.area === area && o.id !== m.id).map(
                      (o) => o.subModule,
                    )
                  : [];
                rows.push(
                  <tr
                    key={m.id}
                    className="border-t border-slate-100 transition-colors hover:bg-slate-50/70 dark:border-slate-800/80 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-2.5 text-center">
                      <Checkbox
                        checked={rowAll}
                        disabled={isAlwaysOn}
                        aria-label={`Allow every action on ${m.subModule}`}
                        onCheckedChange={(c) => handleToggleRowAllowAll(m, Boolean(c))}
                        className={checkboxClass}
                      />
                    </td>
                    <th
                      scope="row"
                      className="px-2 py-2.5 font-medium text-slate-900 dark:text-slate-100"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        {m.subModule}
                        {isAlwaysOn && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            Everyone
                          </span>
                        )}
                      </span>
                    </th>
                    {permCell(m.createPermId, `Create on ${m.subModule}`)}
                    {permCell(m.editPermId, `Edit on ${m.subModule}`)}
                    {permCell(m.viewPermId, `View ${m.subModule}`)}
                    {permCell(m.deletePermId, `Delete on ${m.subModule}`)}
                    <td className="px-4 py-2">
                      {area ? (
                        <div>
                          <Select
                            value={scopeValue}
                            onValueChange={(v) => setDataAccess(area, v as "own" | "all")}
                            disabled={isAdminRole}
                          >
                            <SelectTrigger
                              aria-label={`Data access for ${m.subModule}`}
                              className={cn(
                                "h-8 w-full rounded-lg text-sm",
                                scopeValue === "all" &&
                                  "border-[#67B239]/50 bg-[#67B239]/5 text-[#3f7a1f] dark:text-[#7ac142]",
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="own">
                                <span className="flex items-center gap-2">
                                  <UserRound className="size-4 text-slate-500" /> Own data
                                </span>
                              </SelectItem>
                              <SelectItem value="all">
                                <span className="flex items-center gap-2">
                                  <Users className="size-4 text-[#55962e]" /> All users&apos; data
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {linked.length > 0 && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                              <Link2 className="size-3" aria-hidden /> Linked with{" "}
                              {linked.join(", ")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400 dark:text-slate-500">
                          {isAlwaysOn ? "Own data" : "–"}
                        </span>
                      )}
                    </td>
                  </tr>,
                );
                return rows;
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isAdminRole && (
        <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Shield className="size-4 text-[#55962e]" aria-hidden /> This role manages roles, so it
          always sees every user&apos;s data.
        </p>
      )}

      {/* Sticky save bar: only while there are unsaved changes */}
      {changeCount > 0 && (
        <div
          role="region"
          aria-label="Unsaved changes"
          className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-xl items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {changeCount} unsaved {changeCount === 1 ? "change" : "changes"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelectedPermIds(role.permission_ids || [])}
              disabled={isSaving}
              className="h-9 text-sm cursor-pointer"
            >
              Discard
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="h-9 rounded-lg bg-[#67B239] px-5 text-sm font-semibold text-white hover:bg-[#5aa030] cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

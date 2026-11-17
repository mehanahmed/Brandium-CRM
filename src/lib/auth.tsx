"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

export type User = {
  id: string;
  email?: string;
  user_metadata: {
    full_name?: string;
    role?: string;
    roleName?: string;
    permissions?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type Session = {
  access_token: string;
  user: User;
  [key: string]: unknown;
};

export type AppRole = "admin" | "agent" | "artist" | string;

type Profile = { id: string; full_name: string | null; email: string | null };

export type AuthSession = {
  session: Session;
  user: User;
  profile: Profile;
  role: AppRole;
  permissions?: string[];
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  permissions: string[];
  loading: boolean;
  isAdmin: boolean;
  hasPermission: (resource: string, action?: string) => boolean;
  hasAnyPermission: (permissionIds: string[]) => boolean;
  signOut: () => Promise<void>;
  setAuthenticatedDbSession: (
    userId: string,
    name: string,
    email: string,
    role: AppRole,
    permissions?: string[],
    viewAs?: { adminName: string } | null,
  ) => void;
  signInAsDevUser: (name: string, email: string, role: AppRole) => void;
  /** Name of the admin who is viewing the app as another user; null otherwise. */
  viewAsAdminName: string | null;
  startViewAs: (userId: string) => Promise<void>;
  stopViewAs: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const SESSION_STORAGE_KEY = "brandium_user_session";

function buildAuthObjects(
  userId: string,
  name: string,
  email: string,
  role: AppRole,
  permissions: string[] = [],
): { user: User; session: Session; profile: Profile } {
  const user: User = {
    id: userId,
    app_metadata: { provider: "email" },
    user_metadata: { full_name: name, role, permissions },
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email,
    phone: "",
    role: "authenticated",
    updated_at: new Date().toISOString(),
  };

  const session: Session = {
    access_token: `jwt_${userId}_${Date.now()}`,
    token_type: "bearer",
    expires_in: 3600 * 24 * 30,
    refresh_token: `refresh_${userId}_${Date.now()}`,
    user,
  };

  const profile: Profile = { id: userId, full_name: name, email };

  return { user, session, profile };
}

const sameIdentity = (
  server: { id?: string; role?: string; admin?: boolean } | undefined,
  stored: { session: Session; role: AppRole; permissions?: string[] },
) =>
  server?.id === stored.session.user.id &&
  server.role === String(stored.role).toLowerCase() &&
  // A stored permission list cannot claim admin rights the server did not grant
  (server.admin || !(stored.permissions || []).includes("perm-admin-roles"));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [viewAsAdminName, setViewAsAdminName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const stored =
          localStorage.getItem(SESSION_STORAGE_KEY) || localStorage.getItem("brandium_dev_session");
        if (stored) {
          const parsed = JSON.parse(stored) as {
            session: Session;
            profile: Profile;
            role: AppRole;
            permissions?: string[];
            viewAs?: { adminName: string } | null;
          };
          if (parsed?.session && parsed?.role) {
            // The stored copy is for display only: the server's signed cookie decides who is
            // signed in. If they disagree (edited, expired, signed out), drop the stored copy.
            void fetch("/api/auth/login", { cache: "no-store" })
              .then(async (res) => {
                const body = res.ok ? await res.json() : null;
                if (res.status === 401 || (body && !sameIdentity(body.user, parsed))) {
                  localStorage.removeItem(SESSION_STORAGE_KEY);
                  localStorage.removeItem("brandium_dev_session");
                  setSession(null);
                  setProfile(null);
                  setRole(null);
                  setPermissions([]);
                }
              })
              .catch(() => {});
            setSession(parsed.session);
            setProfile(parsed.profile);
            setRole(parsed.role);
            setViewAsAdminName(parsed.viewAs?.adminName ?? null);
            setPermissions(
              Array.isArray(parsed.permissions)
                ? parsed.permissions
                : (parsed.session.user.user_metadata?.permissions as string[]) || [],
            );
          }
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const setAuthenticatedDbSession = (
    userId: string,
    name: string,
    email: string,
    userRole: AppRole,
    userPermissions: string[] = [],
    viewAs: { adminName: string } | null = null,
  ) => {
    const {
      user,
      session: sess,
      profile: prof,
    } = buildAuthObjects(userId, name, email, userRole, userPermissions);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            session: sess,
            user,
            profile: prof,
            role: userRole,
            permissions: userPermissions,
            viewAs,
          }),
        );
      } catch {
        // Ignore
      }
    }

    setSession(sess);
    setProfile(prof);
    setRole(userRole);
    setPermissions(userPermissions);
    setViewAsAdminName(viewAs?.adminName ?? null);
    setLoading(false);
  };

  const signInAsDevUser = (name: string, email: string, userRole: AppRole) => {
    setAuthenticatedDbSession(`usr_${Date.now()}`, name, email, userRole, []);
  };

  const isUserAdmin = role?.toLowerCase() === "admin" || permissions.includes("perm-admin-roles");

  const hasPermission = (resource: string, action?: string): boolean => {
    if (isUserAdmin) return true;
    if (!action) {
      return permissions.some(
        (p) =>
          p.startsWith(`perm-${resource}-`) || p === `perm-${resource}` || p.includes(resource),
      );
    }
    const targetA = `perm-${resource}-${action}`;
    const targetB = `perm-${resource}-manage`;
    const targetC = `perm-${resource}-write`;
    return (
      permissions.includes(targetA) ||
      (action === "read" && (permissions.includes(targetB) || permissions.includes(targetC))) ||
      permissions.includes(resource)
    );
  };

  const hasAnyPermission = (permissionIds: string[]): boolean => {
    if (isUserAdmin) return true;
    return permissionIds.some((p) => permissions.includes(p));
  };

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    role,
    permissions,
    loading,
    isAdmin: isUserAdmin,
    hasPermission,
    hasAnyPermission,
    signOut: async () => {
      void fetch("/api/auth/login", { method: "DELETE" }).catch(() => {});
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          localStorage.removeItem("brandium_dev_session");
          localStorage.removeItem("brandium_sid");
        } catch {
          // Ignore
        }
      }
      setSession(null);
      setProfile(null);
      setRole(null);
      setPermissions([]);
    },
    setAuthenticatedDbSession,
    signInAsDevUser,
    viewAsAdminName,
    startViewAs: async (userId: string) => {
      const res = await fetch("/api/admin/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const body = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        user?: { id: string; name: string; email: string; role: string; permissions: string[] };
      } | null;
      if (!res.ok || !body?.success || !body.user) {
        throw new Error(body?.error || "Could not view as this user.");
      }
      const u = body.user;
      setAuthenticatedDbSession(u.id, u.name, u.email, u.role, u.permissions, {
        adminName: profile?.full_name || session?.user.email || "Admin",
      });
      toast("Viewing Mode Active", { description: `You are now viewing as ${u.name}.` });
      window.location.href = "/dashboard";
    },
    stopViewAs: async () => {
      const res = await fetch("/api/admin/view-as", { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        user?: { id: string; name: string; email: string; role: string; permissions: string[] };
      } | null;
      if (!res.ok || !body?.success || !body.user) {
        throw new Error(body?.error || "Could not return to admin.");
      }
      const u = body.user;
      setAuthenticatedDbSession(u.id, u.name, u.email, u.role, u.permissions, null);
      toast("Returned to Account", { description: `Logged back in as ${u.name}.` });
      window.location.href = "/dashboard";
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

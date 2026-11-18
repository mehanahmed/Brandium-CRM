import { queryOptions } from "@tanstack/react-query";
import bcrypt from "bcryptjs";
import { runMySQLQuery, runMySQLWrite } from "@/lib/mysql-api";
import { generateUUID, getMySQLTimestamp } from "@/lib/mysql-client";

export type CrmUserRole = "ADMIN" | "AGENT" | "ARTIST" | "DEVELOPER" | string;
export type CrmUserStatus = "Active" | "Inactive" | "Deleted";

export type CrmUser = {
  id: string;
  name: string;
  email: string;
  role: CrmUserRole;
  status: CrmUserStatus;
  is_active?: boolean;
  avatar_url?: string | null | undefined;
  is_deleted?: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateCrmUserInput = {
  name: string;
  email: string;
  password: string;
  role: CrmUserRole;
  status: CrmUserStatus;
  avatar_url?: string | null | undefined;
};

export type UpdateCrmUserInput = {
  name: string;
  email: string;
  role: CrmUserRole;
  status: CrmUserStatus;
};

// Never falls back to storing the plain password: a hashing error must fail the save.
const hashPasswordBcrypt = (plaintext: string) => bcrypt.hashSync(plaintext, 10);

export async function fetchCrmUsers(search?: string): Promise<CrmUser[]> {
  let mapped: CrmUser[] = [];

  try {
    const dbRes = await runMySQLQuery<Record<string, unknown>[]>(
      "SELECT id, name, email, role, status, avatar_url, is_deleted, deleted_at, created_at, updated_at FROM `users` WHERE is_deleted = 0 ORDER BY name ASC;",
    );
    if (dbRes.success && Array.isArray(dbRes.data)) {
      mapped = dbRes.data.map((u) => {
        const userId = String(u["id"]);
        const avatarUrl = u["avatar_url"] ? String(u["avatar_url"]) : null;

        return {
          id: userId,
          name: String(u["name"] || "User"),
          email: String(u["email"] || ""),
          role: (u["role"] as CrmUserRole) || "AGENT",
          status: (u["status"] as CrmUserStatus) || "Active",
          avatar_url: avatarUrl,
          is_deleted: Boolean(Number(u["is_deleted"] ?? 0)),
          deleted_at: (u["deleted_at"] as string) || null,
          created_at: String(u["created_at"] || new Date().toISOString()),
          updated_at: String(u["updated_at"] || new Date().toISOString()),
        };
      });
    }
  } catch (err) {
    console.warn("fetchCrmUsers MySQL error:", err);
    mapped = [];
  }

  return applySearchToUsers(mapped, search);
}

function applySearchToUsers(list: CrmUser[], search?: string): CrmUser[] {
  let activeList = list.filter((u) => !u.is_deleted);
  if (search && search.trim() !== "") {
    const q = search.toLowerCase().trim();
    activeList = activeList.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.status.toLowerCase().includes(q),
    );
  }
  return activeList;
}

export async function fetchCrmUserById(id: string): Promise<CrmUser | null> {
  const users = await fetchCrmUsers();
  return users.find((u) => u.id === id) || null;
}

export async function createCrmUser(input: CreateCrmUserInput): Promise<CrmUser> {
  if (!input.email || !input.email.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }
  if (!input.name || !input.name.trim()) {
    throw new Error("User full name is required.");
  }

  const existing = await runMySQLQuery<Record<string, unknown>[]>(
    "SELECT id FROM `users` WHERE LOWER(email) = LOWER(?) AND is_deleted = 0 LIMIT 1;",
    [input.email.trim()],
  );
  if (existing.success && Array.isArray(existing.data) && existing.data.length > 0) {
    throw new Error(`A user account with email "${input.email}" already exists.`);
  }

  if (!input.password || input.password.length < 6) {
    throw new Error("Initial password must be at least 6 characters long.");
  }
  assertAvatarUrl(input.avatar_url);
  const hashedPassword = hashPasswordBcrypt(input.password);
  const now = getMySQLTimestamp();
  const userId = generateUUID();

  const insertRes = await runMySQLQuery(
    `INSERT INTO \`users\` (\`id\`, \`name\`, \`email\`, \`password_hash\`, \`role\`, \`status\`, \`avatar_url\`, \`is_deleted\`, \`created_at\`, \`updated_at\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
    [
      userId,
      input.name.trim(),
      input.email.toLowerCase().trim(),
      hashedPassword,
      input.role,
      input.status,
      input.avatar_url || null,
      now,
      now,
    ],
  );

  if (!insertRes.success) {
    throw new Error(insertRes.error || "Failed to create user in database.");
  }

  return {
    id: userId,
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    role: input.role,
    status: input.status,
    avatar_url: input.avatar_url || null,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
}

export async function updateCrmUser(id: string, input: UpdateCrmUserInput): Promise<CrmUser> {
  const inputEmail = input.email.toLowerCase().trim();
  const now = getMySQLTimestamp();

  const dupRes = await runMySQLQuery<Record<string, unknown>[]>(
    "SELECT id FROM `users` WHERE id != ? AND LOWER(email) = LOWER(?) AND is_deleted = 0 LIMIT 1;",
    [id, inputEmail],
  );
  if (dupRes.success && Array.isArray(dupRes.data) && dupRes.data.length > 0) {
    throw new Error(`Another user account with email "${input.email}" already exists.`);
  }

  await runMySQLQuery(
    "UPDATE `users` SET `name` = ?, `email` = ?, `role` = ?, `status` = ?, `updated_at` = ? WHERE `id` = ?;",
    [input.name.trim(), inputEmail, input.role, input.status, now, id],
  );

  const updated = await fetchCrmUserById(id);
  if (!updated) {
    throw new Error("Failed to load updated user.");
  }
  return updated;
}

export async function resetUserPassword(userId: string, newPlaintext: string): Promise<boolean> {
  if (!newPlaintext || newPlaintext.length < 6) {
    throw new Error("New password must be at least 6 characters long.");
  }

  const hashed = hashPasswordBcrypt(newPlaintext);
  const now = getMySQLTimestamp();
  await runMySQLQuery("UPDATE `users` SET `password_hash` = ?, `updated_at` = ? WHERE `id` = ?;", [
    hashed,
    now,
    userId,
  ]);
  return true;
}

export async function changeOwnPassword(
  userId: string,
  currentPlaintext: string,
  newPlaintext: string,
): Promise<boolean> {
  const res = await runMySQLQuery<Record<string, unknown>[]>(
    "SELECT password_hash FROM `users` WHERE id = ? AND is_deleted = 0 LIMIT 1;",
    [userId],
  );
  const hash = res.data?.[0]?.["password_hash"];
  if (!res.success || !hash) throw new Error("User account not found.");

  let isMatch = false;
  try {
    isMatch = bcrypt.compareSync(currentPlaintext, String(hash));
  } catch {
    // A stored value that is not a bcrypt hash can never match
  }
  if (!isMatch) {
    throw new Error("Current password entered is incorrect.");
  }

  return resetUserPassword(userId, newPlaintext);
}

export async function toggleUserStatus(userId: string, newStatus: CrmUserStatus): Promise<boolean> {
  const now = getMySQLTimestamp();
  await runMySQLQuery(
    "UPDATE `users` SET `status` = ?, `is_active` = ?, `updated_at` = ? WHERE `id` = ?;",
    [newStatus, newStatus === "Active" ? 1 : 0, now, userId],
  );
  return true;
}

export async function softDeleteCrmUser(userId: string): Promise<boolean> {
  const user = await fetchCrmUserById(userId);
  if (user?.email === "admin@example.com" || user?.email === "agent@brandium.com") {
    throw new Error("System default accounts cannot be deleted.");
  }
  // An admin account cannot be deleted by another admin (or by itself)
  if (user && String(user.role || "").toUpperCase() === "ADMIN") {
    throw new Error("Admin accounts cannot be deleted.");
  }

  const now = getMySQLTimestamp();
  await runMySQLQuery(
    "UPDATE `users` SET `is_deleted` = 1, `status` = 'Deleted', `deleted_at` = ?, `updated_at` = ? WHERE `id` = ?;",
    [now, now, userId],
  );
  return true;
}

/** An avatar is a short link (`/uploads/...` or https), never an inline base64 image. */
export function assertAvatarUrl(avatarUrl: string | null | undefined) {
  if (avatarUrl && avatarUrl.startsWith("data:")) {
    throw new Error("Upload the image first; inline images are too large to save.");
  }
}

export async function updateUserAvatar(userId: string, avatarUrl: string): Promise<boolean> {
  const newAvatar = avatarUrl.trim() || null;
  assertAvatarUrl(newAvatar);
  const now = getMySQLTimestamp();

  const matched = await runMySQLWrite(
    "UPDATE `users` SET `avatar_url` = ?, `updated_at` = ? WHERE `id` = ?;",
    [newAvatar, now, userId],
  );
  if (matched === 0) throw new Error("User not found.");
  // Most screens read the profile photo first, so keep it in step
  await runMySQLWrite("UPDATE `profiles` SET `avatar_url` = ? WHERE `id` = ?;", [
    newAvatar,
    userId,
  ]);
  return true;
}

export const crmUsersQueryOptions = (search?: string) =>
  queryOptions({
    queryKey: ["crm-users", search],
    queryFn: () => fetchCrmUsers(search),
  });

export const crmUserDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["crm-user", id],
    queryFn: () => fetchCrmUserById(id),
  });

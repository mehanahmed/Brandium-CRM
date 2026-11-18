import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { formatStageSlugOrName, parseNotesToItems, type StageNoteItem } from "@/lib/stages";
import { runMySQLQuery, runMySQLWrite, runMySQLWriteOne } from "@/lib/mysql-api";
import { getMySQLTimestamp } from "@/lib/mysql-client";
import { PROSPECT_IDS_SQL, PROSPECT_PHONE_MATCH_SQL } from "@/lib/trusted-sql";

export const prospectFiltersSchema = z.object({
  page: z.number().catch(1),
  pageSize: z.number().catch(12).optional(),
  search: z.string().optional(),
  stage: z.string().optional(),
  agent: z.string().optional(),
  service: z.string().optional(),
  sortBy: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type ProspectFilters = z.infer<typeof prospectFiltersSchema>;

export type Prospect = {
  id: string;
  contact_name: string;
  business_name: string | null;
  designation: string | null;
  phone: string | null;
  alternative_phone: string | null;
  email: string | null;
  address: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  source?: string | null;
  service_id: string | null;
  stage_id: string | null;
  assigned_to: string | null;
  assigned_artist_id?: string | null;
  created_by: string | null;
  notes: string | null;
  artist?: string | null | undefined;
  is_qualified?: number | boolean | null | undefined;
  created_at: string;
  updated_at: string;
  // Joined fields
  service_name?: string | undefined;
  stage_name?: string | undefined;
  stage_group?: string | undefined;
  stage_color?: string | null | undefined;
  stage_icon?: string | null | undefined;
  assigned_agent_name?: string | undefined;
  assigned_agent_avatar?: string | null | undefined;
  assigned_artist_name?: string | undefined;
  assigned_artist_avatar?: string | null | undefined;
  creator_name?: string | undefined;
  creator_avatar?: string | null | undefined;
};

export function getProspectArtistName(prospect: {
  artist?: string | null | undefined;
  assigned_artist_name?: string | null | undefined;
  notes?: string | null | undefined;
}): string {
  if (
    prospect.assigned_artist_name &&
    prospect.assigned_artist_name.trim() &&
    prospect.assigned_artist_name.toLowerCase() !== "none" &&
    prospect.assigned_artist_name.toLowerCase() !== "unknown"
  ) {
    return prospect.assigned_artist_name.trim();
  }

  if (prospect.artist && prospect.artist.trim() && prospect.artist.toLowerCase() !== "none") {
    return prospect.artist.trim();
  }

  if (prospect.notes) {
    const match = prospect.notes.match(/\[Artist:\s*([^\]]+)\]/i);
    if (match && match[1] && match[1].trim() && match[1].toLowerCase() !== "none") {
      return match[1].trim();
    }
  }

  return "Unassigned";
}

export function getProspectAgentName(prospect: {
  assigned_agent_name?: string | null | undefined;
  creator_name?: string | null | undefined;
  notes?: string | null | undefined;
}): string {
  if (prospect.notes) {
    const match = prospect.notes.match(/\[Agent:\s*([^\]]+)\]/i);
    if (match && match[1] && match[1].trim() && match[1].toLowerCase() !== "none") {
      return match[1].trim();
    }
  }

  if (
    prospect.assigned_agent_name &&
    prospect.assigned_agent_name.trim() &&
    prospect.assigned_agent_name.toLowerCase() !== "unknown" &&
    prospect.assigned_agent_name.toLowerCase() !== "agent"
  ) {
    return prospect.assigned_agent_name.trim();
  }

  if (
    prospect.creator_name &&
    prospect.creator_name.trim() &&
    prospect.creator_name.toLowerCase() !== "system"
  ) {
    return prospect.creator_name.trim();
  }

  return "Unassigned";
}

export function getProspectCreatorName(prospect: {
  creator_name?: string | null | undefined;
  assigned_agent_name?: string | null | undefined;
}): string {
  if (
    prospect.creator_name &&
    prospect.creator_name.trim() &&
    prospect.creator_name.toLowerCase() !== "system"
  ) {
    return prospect.creator_name.trim();
  }
  if (
    prospect.assigned_agent_name &&
    prospect.assigned_agent_name.trim() &&
    prospect.assigned_agent_name.toLowerCase() !== "unknown" &&
    prospect.assigned_agent_name.toLowerCase() !== "agent"
  ) {
    return prospect.assigned_agent_name.trim();
  }
  return "Agent / Admin";
}

export function getProspectCreatorAvatar(prospect: {
  creator_avatar?: string | null | undefined;
  assigned_agent_avatar?: string | null | undefined;
}): string | null {
  if (prospect.creator_avatar && prospect.creator_avatar.trim()) {
    return prospect.creator_avatar.trim();
  }
  if (prospect.assigned_agent_avatar && prospect.assigned_agent_avatar.trim()) {
    return prospect.assigned_agent_avatar.trim();
  }
  return null;
}

export function extractLatestProspectNote(
  prospectNotes?: string | null,
  prospectCreatedAt?: string | null,
  historyEntries?: { note: string; changed_at?: string | null }[],
): string {
  const allItems: StageNoteItem[] = [];

  if (prospectNotes) {
    const pItems = parseNotesToItems(prospectNotes, prospectCreatedAt);
    allItems.push(...pItems);
  }

  if (historyEntries && Array.isArray(historyEntries)) {
    for (const h of historyEntries) {
      if (h.note) {
        const hItems = parseNotesToItems(h.note, h.changed_at);
        allItems.push(...hItems);
      }
    }
  }

  if (allItems.length === 0) return "";

  // Sort by createdAt ascending so the newest note is at the end
  allItems.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return 0;
  });

  const latest = allItems[allItems.length - 1];
  return latest?.text?.trim() || "";
}

export function getProspectCleanNotes(notes?: string | null): string {
  if (!notes) return "";
  const items = parseNotesToItems(notes);
  if (items.length > 0) {
    // Return the text of the latest note item
    items.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
    const latestItem = items[items.length - 1];
    if (latestItem?.text) {
      return latestItem.text.trim();
    }
  }

  const cleaned = notes
    .replace(/\[Artist:\s*[^\]]+\]/gi, "")
    .replace(/\[Agent:\s*[^\]]+\]/gi, "")
    .trim();

  if (!cleaned) return "";

  const lines = cleaned
    .split(/\r?\n+/)
    .map((l) => l.replace(/^[\s*•\-–—\d.)]+/, "").trim())
    .filter(Boolean);

  if (lines.length > 0) {
    return lines[lines.length - 1] || "";
  }

  return cleaned;
}

export const prospectsQuery = (filters: ProspectFilters, userId: string, isAdmin: boolean) =>
  queryOptions({
    queryKey: ["prospects", filters, userId, isAdmin],
    queryFn: async () => {
      const pageSize = filters.pageSize || 12;
      const from = (filters.page - 1) * pageSize;
      let fetchedRows: Prospect[] = [];

      let mysqlSuccess = false;
      // 1. Fetch directly from local MySQL database `brandium_crm` via API bridge
      try {
        const res = await runMySQLQuery<Record<string, unknown>[]>(
          `SELECT 
            p.*,
            s.name AS service_name,
            COALESCE(st.name, p.stage_id, 'Prospect') AS stage_name,
            st.stage_group AS stage_group,
            st.color AS stage_color,
            st.icon AS stage_icon,
            COALESCE(prof_assign.full_name, u_assign.name) AS assigned_agent_name,
            COALESCE(prof_assign.avatar_url, u_assign.avatar_url) AS assigned_agent_avatar,
            COALESCE(prof_artist.full_name, u_artist.name) AS assigned_artist_name,
            COALESCE(prof_artist.avatar_url, u_artist.avatar_url) AS assigned_artist_avatar,
            COALESCE(prof_create.full_name, u_create.name, prof_assign.full_name, u_assign.name) AS creator_name,
            COALESCE(prof_create.avatar_url, u_create.avatar_url, prof_assign.avatar_url, u_assign.avatar_url) AS creator_avatar
          FROM \`prospects\` p
          LEFT JOIN \`services\` s ON p.service_id = s.id
          LEFT JOIN \`stages\` st ON (p.stage_id = st.id OR p.stage_id = REPLACE(st.id, '-', '_') OR p.stage_id = st.name)
          LEFT JOIN \`users\` u_assign ON p.assigned_to = u_assign.id
          LEFT JOIN \`profiles\` prof_assign ON p.assigned_to = prof_assign.id
          LEFT JOIN \`users\` u_artist ON p.assigned_artist_id = u_artist.id
          LEFT JOIN \`profiles\` prof_artist ON p.assigned_artist_id = prof_artist.id
          LEFT JOIN \`users\` u_create ON p.created_by = u_create.id
          LEFT JOIN \`profiles\` prof_create ON p.created_by = prof_create.id
          WHERE (p.is_active = 1 OR p.is_active IS NULL)
          ORDER BY p.created_at DESC;`,
        );

        if (res?.success && Array.isArray(res.data)) {
          mysqlSuccess = true;

          // Fetch all stage history notes for chronological resolution of the latest note
          const historyNotesMap: Record<string, { note: string; changed_at: string }[]> = {};
          try {
            const histRes = await runMySQLQuery<Record<string, unknown>[]>(
              `SELECT prospect_id, note, changed_at 
               FROM \`prospect_stage_history\` 
               WHERE note IS NOT NULL AND TRIM(note) != ''
               ORDER BY changed_at ASC;`,
            );
            if (histRes?.success && Array.isArray(histRes.data)) {
              for (const h of histRes.data) {
                const pid = String(h["prospect_id"] || "");
                const note = String(h["note"] || "");
                const changedAt = String(h["changed_at"] || "");
                if (pid && note) {
                  if (!historyNotesMap[pid]) historyNotesMap[pid] = [];
                  historyNotesMap[pid].push({ note, changed_at: changedAt });
                }
              }
            }
          } catch (e) {
            console.warn("history notes query notice:", e);
          }

          fetchedRows = res.data.map((p) => {
            const pId = String(p["id"]);
            const stId = String(p["stage_id"] || "");
            const prospectNotes = (p["notes"] as string) || null;
            const prospectCreatedAt = String(p["created_at"] || "");
            const historyEntries = historyNotesMap[pId] || [];

            // Resolve the latest note across all stage history transitions and prospect notes
            const latestCleanNote = extractLatestProspectNote(
              prospectNotes,
              prospectCreatedAt,
              historyEntries,
            );

            return {
              id: pId,
              contact_name: String(p["contact_name"] || "Client"),
              business_name: (p["business_name"] as string) || null,
              designation: (p["designation"] as string) || null,
              phone: (p["phone"] as string) || null,
              alternative_phone: (p["alternative_phone"] as string) || null,
              email: (p["email"] as string) || null,
              address: (p["address"] as string) || null,
              website_url: (p["website_url"] as string) || null,
              logo_url: (p["logo_url"] as string) || null,
              service_id: (p["service_id"] as string) || null,
              stage_id: stId || null,
              assigned_to: (p["assigned_to"] as string) || null,
              assigned_artist_id: (p["assigned_artist_id"] as string) || null,
              created_by: (p["created_by"] as string) || null,
              notes: latestCleanNote || prospectNotes,
              is_qualified: p["is_qualified"] ? 1 : 0,
              created_at: String(p["created_at"] || new Date().toISOString()),
              updated_at: String(p["updated_at"] || new Date().toISOString()),
              service_name: (p["service_name"] as string) || undefined,
              stage_name: String(p["stage_name"] || formatStageSlugOrName(stId) || "Prospect"),
              stage_group: (p["stage_group"] as string) || "new",
              stage_color: (p["stage_color"] as string) || null,
              stage_icon: (p["stage_icon"] as string) || null,
              assigned_agent_name: (p["assigned_agent_name"] as string) || undefined,
              assigned_agent_avatar: (p["assigned_agent_avatar"] as string) || null,
              assigned_artist_name: (p["assigned_artist_name"] as string) || undefined,
              assigned_artist_avatar: (p["assigned_artist_avatar"] as string) || null,
              creator_name: (p["creator_name"] as string) || undefined,
              creator_avatar: (p["creator_avatar"] as string) || null,
            } as Prospect;
          });
        }
      } catch (err) {
        console.warn("prospectsQuery API error:", err);
      }

      // User data scoping: regular user sees only their own assigned/created prospects; admin sees all
      let rows = fetchedRows;
      if (!isAdmin && userId) {
        rows = rows.filter(
          (p) =>
            p.assigned_to === userId || p.assigned_artist_id === userId || p.created_by === userId,
        );
      }

      // Apply in-memory filtering
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        rows = rows.filter(
          (p) =>
            p.contact_name.toLowerCase().includes(q) ||
            (p.business_name && p.business_name.toLowerCase().includes(q)) ||
            (p.phone && p.phone.includes(q)) ||
            (p.alternative_phone && p.alternative_phone.includes(q)) ||
            (p.email && p.email.toLowerCase().includes(q)) ||
            (p.designation && p.designation.toLowerCase().includes(q)) ||
            (p.address && p.address.toLowerCase().includes(q)) ||
            (p.service_name && p.service_name.toLowerCase().includes(q)) ||
            (p.stage_name && p.stage_name.toLowerCase().includes(q)) ||
            (p.notes && p.notes.toLowerCase().includes(q)) ||
            (p.assigned_agent_name && p.assigned_agent_name.toLowerCase().includes(q)) ||
            (p.assigned_artist_name && p.assigned_artist_name.toLowerCase().includes(q)) ||
            (p.creator_name && p.creator_name.toLowerCase().includes(q)),
        );
      }
      if (filters.stage && filters.stage !== "all") {
        const target = filters.stage.replace(/[-_]/g, " ").toLowerCase();
        rows = rows.filter((p) => {
          if (p.stage_id === filters.stage) return true;
          const sName = (p.stage_name || "").toLowerCase();
          if (target.includes("follow") && sName.includes("follow")) return true;
          if (target.includes("qualif") && (sName.includes("qualif") || Boolean(p.is_qualified)))
            return true;
          if (target.includes("opportunity") && sName.includes("opportunity")) return true;
          if (
            (target.includes("won") || target.includes("sales")) &&
            (sName.includes("won") || sName.includes("sales"))
          )
            return true;
          if (target.includes("meeting") && sName.includes("meeting")) return true;
          if (
            (target.includes("lost") ||
              target.includes("dnp") ||
              target.includes("switch") ||
              target.includes("invalid") ||
              target.includes("not interested")) &&
            (sName.includes("lost") ||
              sName.includes("dnp") ||
              sName.includes("switch") ||
              sName.includes("invalid") ||
              sName.includes("not interested") ||
              (p.stage_group && (p.stage_group === "lost" || p.stage_group === "unreachable")))
          )
            return true;
          if (target.includes("prospect") && sName.includes("prospect")) return true;
          return sName.includes(target) || target.includes(sName);
        });
      }
      if (filters.agent && filters.agent !== "all") {
        rows = rows.filter(
          (p) =>
            p.assigned_to === filters.agent ||
            p.assigned_artist_id === filters.agent ||
            p.created_by === filters.agent,
        );
      }
      if (filters.service && filters.service !== "all") {
        rows = rows.filter((p) => p.service_id === filters.service);
      }
      if (filters.from) {
        rows = rows.filter((p) => p.created_at >= filters.from!);
      }
      if (filters.to) {
        rows = rows.filter((p) => p.created_at <= filters.to!);
      }

      // Apply dynamic sorting
      if (filters.sortBy === "oldest") {
        rows.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      } else if (filters.sortBy === "name_asc") {
        rows.sort((a, b) => (a.contact_name || "").localeCompare(b.contact_name || ""));
      } else if (filters.sortBy === "name_desc") {
        rows.sort((a, b) => (b.contact_name || "").localeCompare(a.contact_name || ""));
      } else if (filters.sortBy === "updated") {
        rows.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
      } else {
        // default: newest first
        rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      }

      const totalCount = rows.length;
      const paginated = rows.slice(from, from + pageSize);
      return {
        data: paginated,
        count: totalCount,
        pageCount: Math.ceil(totalCount / pageSize) || 1,
      };
    },
  });

export const prospectsStatsQuery = (
  userId: string,
  isAdmin: boolean,
  filterUserId?: string | undefined,
  range?: { from?: string | undefined; to?: string | undefined } | undefined,
) =>
  queryOptions({
    queryKey: ["prospects-stats", userId, isAdmin, filterUserId, range],
    queryFn: async () => {
      let allProspects: Record<string, unknown>[] = [];
      try {
        const res = await runMySQLQuery<Record<string, unknown>[]>(
          `SELECT 
            p.id,
            p.stage_id,
            p.is_qualified,
            p.assigned_to,
            p.assigned_artist_id,
            p.created_by,
            p.created_at,
            COALESCE(st.name, p.stage_id, 'Prospect') AS stage_name,
            st.stage_group AS stage_group
          FROM \`prospects\` p
          LEFT JOIN \`stages\` st ON (p.stage_id = st.id OR p.stage_id = REPLACE(st.id, '-', '_') OR p.stage_id = st.name)
          WHERE (p.is_active = 1 OR p.is_active IS NULL) 
          ORDER BY p.created_at DESC;`,
        );
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          allProspects = res.data;
        }
      } catch (err) {
        console.warn("prospectsStatsQuery notice:", err);
      }

      // User data scoping: regular user sees only their own assigned/created prospects stats; admin sees all or filtered
      if (filterUserId) {
        allProspects = allProspects.filter(
          (p) =>
            p["assigned_to"] === filterUserId ||
            p["assigned_artist_id"] === filterUserId ||
            p["created_by"] === filterUserId,
        );
      } else if (!isAdmin && userId) {
        allProspects = allProspects.filter(
          (p) =>
            p["assigned_to"] === userId ||
            p["assigned_artist_id"] === userId ||
            p["created_by"] === userId,
        );
      }

      // Filter by date range (inclusive, compared on the yyyy-MM-dd part of created_at)
      if (range?.from || range?.to) {
        allProspects = allProspects.filter((p) => {
          const day = String(p["created_at"] ?? "").slice(0, 10);
          if (!day) return false;
          if (range.from && day < range.from) return false;
          if (range.to && day > range.to) return false;
          return true;
        });
      }

      const totalProspects = allProspects.length;
      let salesWon = 0;
      let activeProspects = 0;
      let pendingTasks = 0;
      let followUps = 0;
      let qualifiedLeads = 0;
      let notQualifiedLeads = 0;
      let prospectCount = 0;
      let meetingCount = 0;
      let lostDnpCount = 0;
      const stageCounts: Record<string, number> = {};

      for (const p of allProspects) {
        const rawStage = String(
          (p["stage_name"] as string) || (p["stage_id"] as string) || "Prospect",
        );
        const stageName = rawStage.toLowerCase();
        const stageGroup = String((p["stage_group"] as string) || "")
          .toLowerCase()
          .trim();
        const isQual = Boolean(p["is_qualified"]) || Number(p["is_qualified"]) === 1;

        const isWon = stageName.includes("won") || stageName.includes("sales won");
        const isFollowUp = stageName.includes("follow");
        const isMeeting = stageName.includes("meeting");
        const isLostOrDnp =
          stageGroup === "lost" ||
          stageGroup === "unreachable" ||
          stageName.includes("not-interested") ||
          stageName.includes("not interested") ||
          stageName.includes("dnp") ||
          stageName.includes("switched") ||
          stageName.includes("invalid") ||
          stageName.includes("lost");
        const isProspect =
          stageName.includes("prospect") ||
          stageGroup === "new" ||
          (!isWon && !isFollowUp && !isMeeting && !isLostOrDnp && !isQual);

        if (isWon) salesWon++;
        else activeProspects++;

        if (isFollowUp || isMeeting || stageName.includes("opportunity") || isProspect) {
          pendingTasks++;
        }
        if (isFollowUp) followUps++;
        if (isMeeting) meetingCount++;
        if (isLostOrDnp) {
          notQualifiedLeads++;
          lostDnpCount++;
        }
        if (isProspect) prospectCount++;

        if (
          isQual ||
          stageName.includes("qualif") ||
          stageName.includes("opportunity") ||
          stageName.includes("proposal")
        ) {
          qualifiedLeads++;
        }

        const trimmedKey = rawStage.trim();
        stageCounts[trimmedKey] = (stageCounts[trimmedKey] || 0) + 1;
      }

      const successRate =
        totalProspects > 0 ? ((salesWon / totalProspects) * 100).toFixed(1) + "%" : "0.0%";

      return {
        totalProspects,
        activeProspects,
        salesWon,
        pendingTasks,
        followUps,
        qualifiedLeads,
        notQualifiedLeads,
        prospectCount,
        meetingCount,
        lostDnpCount,
        stageCounts,
        successRate,
      };
    },
  });

export type CreateProspectInput = {
  contact_name: string;
  business_name?: string | null | undefined;
  designation?: string | null | undefined;
  phone?: string | null | undefined;
  alternative_phone?: string | null | undefined;
  email?: string | null | undefined;
  address?: string | null | undefined;
  website_url?: string | null | undefined;
  logo_url?: string | null | undefined;
  service_id?: string | null | undefined;
  stage_id?: string | null | undefined;
  assigned_to?: string | null | undefined;
  assigned_artist_id?: string | null | undefined;
  created_by?: string | null | undefined;
  notes?: string | null | undefined;
};

export function formatProspectId(id?: string | null): string {
  if (!id) return "0001";
  const trimmed = id.trim();
  // If already numeric like "0001", "12", "5"
  if (/^\d+$/.test(trimmed)) {
    return trimmed.padStart(4, "0");
  }
  // If format is like "prospect-1786569978392"
  const match = trimmed.match(/^prospect-(\d+)$/i);
  if (match && match[1]) {
    const last4 = match[1].slice(-4);
    return last4.padStart(4, "0");
  }
  return trimmed;
}

export async function generateNextProspectId(): Promise<string> {
  try {
    const res = await runMySQLQuery<Record<string, unknown>[]>(PROSPECT_IDS_SQL);
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      let maxNum = 0;
      for (const row of res.data) {
        const idStr = String(row["id"] || "");
        // Match pure numeric or 0001 format
        const numMatch = idStr.match(/^0*(\d+)$/);
        if (numMatch && numMatch[1]) {
          const n = parseInt(numMatch[1], 10);
          if (n > maxNum && n < 1000000) {
            maxNum = n;
          }
        }
      }

      if (maxNum > 0) {
        return String(maxNum + 1).padStart(4, "0");
      }

      // If existing IDs are all timestamps, compute count + 1
      const count = res.data.length;
      return String(count + 1).padStart(4, "0");
    }
    return "0001";
  } catch {
    return "0001";
  }
}

export async function createProspect(input: CreateProspectInput): Promise<Prospect> {
  // Check duplicate phone number before creating
  const rawPhone = (input.phone || input.alternative_phone || "").trim();
  if (rawPhone && rawPhone.length >= 6) {
    const dupCheck = await checkDuplicateProspectPhone(rawPhone);
    if (dupCheck.isDuplicate && dupCheck.match) {
      throw new Error("This phone number already exists!");
    }
  }

  const nextId = await generateNextProspectId();
  const now = getMySQLTimestamp();

  const newProspect: Prospect = {
    id: nextId,
    contact_name: input.contact_name,
    business_name: input.business_name || null,
    designation: input.designation || null,
    phone: input.phone || null,
    alternative_phone: input.alternative_phone || null,
    email: input.email || null,
    address: input.address || null,
    website_url: input.website_url || null,
    logo_url: input.logo_url || null,
    service_id: input.service_id || null,
    stage_id: input.stage_id || null,
    assigned_to: input.assigned_to || null,
    created_by: input.created_by || null,
    notes: input.notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    service_name: undefined,
    stage_name: "Prospect",
    stage_group: "new",
    assigned_agent_name: undefined,
    assigned_agent_avatar: null,
    assigned_artist_name: undefined,
    assigned_artist_avatar: null,
    creator_name: undefined,
    creator_avatar: null,
  };

  // 1. Direct INSERT query via API bridge into MySQL `brandium_crm.prospects` table
  const insertSql = `
    INSERT INTO \`prospects\` (
      \`id\`, \`contact_name\`, \`business_name\`, \`designation\`, \`phone\`,
      \`alternative_phone\`, \`email\`, \`address\`, \`website_url\`, \`logo_url\`,
      \`service_id\`, \`stage_id\`, \`assigned_to\`, \`assigned_artist_id\`,
      \`created_by\`, \`notes\`, \`is_active\`, \`created_at\`, \`updated_at\`
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);
  `;

  const insertParams = [
    nextId,
    input.contact_name,
    input.business_name || null,
    input.designation || null,
    input.phone || null,
    input.alternative_phone || null,
    input.email || null,
    input.address || null,
    input.website_url || null,
    input.logo_url || null,
    input.service_id || null,
    input.stage_id || null,
    input.assigned_to || null,
    input.assigned_artist_id || null,
    input.created_by || null,
    input.notes || null,
    now,
    now,
  ];

  // A plain INSERT: two prospects created at once with the same next id must not overwrite each other
  const res = await runMySQLQuery(insertSql, insertParams);
  if (!res?.success) throw new Error(res?.error || "The prospect could not be saved.");

  return newProspect;
}

export async function deleteProspect(prospectId: string): Promise<boolean> {
  if (!prospectId) return false;

  await runMySQLWriteOne("DELETE FROM `prospects` WHERE `id` = ?", [prospectId]);
  return true;
}

export async function updateProspect(
  prospectId: string,
  input: Partial<CreateProspectInput>,
): Promise<boolean> {
  if (!prospectId) return false;

  // Check duplicate phone number before updating (excluding current prospect)
  const rawPhone = (input.phone || input.alternative_phone || "").trim();
  if (rawPhone && rawPhone.length >= 6) {
    const dupCheck = await checkDuplicateProspectPhone(rawPhone, prospectId);
    if (dupCheck.isDuplicate && dupCheck.match) {
      throw new Error("This phone number already exists!");
    }
  }

  const now = getMySQLTimestamp();

  const updateSql = `
    UPDATE \`prospects\` SET
      \`contact_name\` = COALESCE(?, \`contact_name\`),
      \`business_name\` = ?,
      \`designation\` = ?,
      \`phone\` = ?,
      \`alternative_phone\` = ?,
      \`email\` = ?,
      \`address\` = ?,
      \`website_url\` = ?,
      \`logo_url\` = ?,
      \`service_id\` = ?,
      \`stage_id\` = ?,
      \`assigned_to\` = ?,
      \`assigned_artist_id\` = ?,
      \`created_by\` = ?,
      \`notes\` = ?,
      \`updated_at\` = ?
    WHERE \`id\` = ?
  `;

  const updateParams = [
    input.contact_name || null,
    input.business_name || null,
    input.designation || null,
    input.phone || null,
    input.alternative_phone || null,
    input.email || null,
    input.address || null,
    input.website_url || null,
    input.logo_url || null,
    input.service_id || null,
    input.stage_id || null,
    input.assigned_to || null,
    input.assigned_artist_id || null,
    input.created_by || null,
    input.notes || null,
    now,
    prospectId,
  ];

  await runMySQLWrite(updateSql, updateParams);
  return true;
}

export type DuplicatePhoneMatch = {
  isDuplicate: boolean;
  match?: {
    id: string;
    stage_name: string;
    assigned_agent_name: string;
    created_at: string;
  };
};

export async function checkDuplicateProspectPhone(
  rawPhone: string,
  excludeProspectId?: string,
): Promise<DuplicatePhoneMatch> {
  if (!rawPhone || typeof rawPhone !== "string") {
    return { isDuplicate: false };
  }

  const cleanDigits = rawPhone.replace(/\D/g, "");
  if (cleanDigits.length < 6) {
    return { isDuplicate: false };
  }

  // Extract core subscriber digits (last 9 digits) to match regardless of country codes or local prefixes
  const lastDigits = cleanDigits.slice(-9);

  try {
    // Fixed text so the server can run it unscoped (other agents' leads count as duplicates)
    const params: unknown[] = [`%${lastDigits}%`, `%${lastDigits}%`, excludeProspectId || ""];
    const res = await runMySQLQuery<Record<string, unknown>[]>(PROSPECT_PHONE_MATCH_SQL, params);
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      const match = res.data[0];
      if (match) {
        return {
          isDuplicate: true,
          match: {
            id: String(match["id"]),
            stage_name: String(match["stage_name"] || "Prospect"),
            assigned_agent_name: String(match["assigned_agent_name"] || "Unassigned"),
            created_at: String(match["created_at"] || ""),
          },
        };
      }
    }
    return { isDuplicate: false };
  } catch (err) {
    console.warn("checkDuplicateProspectPhone error:", err);
    return { isDuplicate: false };
  }
}

export async function toggleProspectQualified(
  prospectId: string,
  isQualified: boolean,
): Promise<boolean> {
  const now = getMySQLTimestamp();
  const sql = `
    UPDATE \`prospects\`
    SET \`is_qualified\` = ?, \`updated_at\` = ?
    WHERE \`id\` = ?;
  `;
  const res = await runMySQLQuery(sql, [isQualified ? 1 : 0, now, prospectId]);
  return Boolean(res.success);
}

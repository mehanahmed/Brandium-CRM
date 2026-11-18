import { addDays, format, isValid, startOfDay } from "date-fns";

import { resolveOrderStatus, type CrmOrder } from "@/lib/orders";

export type WorkDayStatus = "missed" | "late" | "onTime" | "assigned" | "gap";

export interface WorkDay {
  assigned: number;
  completed: number;
  status: WorkDayStatus | null;
}

/** One stage of one order that was assigned to the user. */
export interface StageAssignment {
  order: CrmOrder;
  start: Date;
  /** When the order left this assignment (next history entry); null while it is still open. */
  end: Date | null;
  /** True when the order moved on to a later stage (not re-assigned, cancelled or put on hold). */
  completed: boolean;
  deadline: Date | null;
}

// Deadline problems win on days with several events
const PRIORITY: Record<WorkDayStatus, number> = {
  missed: 5,
  late: 4,
  onTime: 3,
  assigned: 2,
  gap: 1,
};

// Written by useAssignStageMutation: `Order moved to "X" and assigned to Name.`
const ASSIGNED_TO = /assigned to (.+?)\.?\s*$/i;

const toDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return isValid(date) ? date : null;
};

/** The order sits in a stage of this user's role and is assigned to them right now. */
export const isOnMyStage = (order: CrmOrder, userId: string, role: string): boolean => {
  const stage = resolveOrderStatus(order.status);
  return (
    order.designer_id === userId &&
    Boolean(stage.role) &&
    stage.role?.toUpperCase() === role.trim().toUpperCase()
  );
};

/**
 * Every stage assignment of this user, read from `orders.status_history`. An entry is theirs when
 * it stores their user id; older entries without an id count when the note says "assigned to
 * <their name>", or when the entry opened the current stage and that stage is theirs now.
 */
export function collectAssignments(
  orders: CrmOrder[],
  userId: string,
  userName: string,
  role: string,
): StageAssignment[] {
  const me = userName.trim().toLowerCase();
  const result: StageAssignment[] = [];

  for (const order of orders) {
    const history = order.status_history;
    const ids = history.map((h) => resolveOrderStatus(h.status).id);
    const currentIndex = ids.lastIndexOf(resolveOrderStatus(order.status).id);
    const onMyStage = isOnMyStage(order, userId, role);

    history.forEach((entry, index) => {
      let isMine: boolean;
      if (entry.assignedToUserId) {
        isMine = entry.assignedToUserId === userId;
      } else {
        const named = ASSIGNED_TO.exec(entry.notes ?? "")?.[1]
          ?.trim()
          .toLowerCase();
        isMine = (me !== "" && named === me) || (index === currentIndex && onMyStage);
      }
      if (!isMine) return;

      const start = toDate(entry.timestamp);
      if (!start) return;

      // The work is complete when the order moves from this stage to any other stage.
      // A new assignment in the same stage (another user of the role, or this user again)
      // replaces this one, so it is not counted for this user. Notes and links are skipped.
      let end: Date | null = null;
      let completed = false;
      for (let later = index + 1; later < history.length; later += 1) {
        const laterEntry = history[later];
        if (!laterEntry) break;
        if (ids[later] !== ids[index]) {
          end = toDate(laterEntry.timestamp);
          completed = end !== null;
          break;
        }
        if (laterEntry.assignedToUserId || ASSIGNED_TO.test(laterEntry.notes ?? "")) return;
      }

      result.push({ order, start, end, completed, deadline: toDate(entry.deadline) });
    });
  }

  return result;
}

const dayKey = (value: Date): string => format(value, "yyyy-MM-dd");

/**
 * One entry per local day: assignment days, hand-off days (on time, or a commitment break when
 * after the stage deadline), missed deadlines of open assignments, and the days in between.
 */
export function buildWorkCalendar(
  assignments: StageAssignment[],
  now: number,
): Map<string, WorkDay> {
  const days = new Map<string, WorkDay>();
  // Counts are per order: the same order assigned or handed off twice on one day counts once
  const assignedOn = new Set<string>();
  const completedOn = new Set<string>();

  const mark = (date: Date, status: WorkDayStatus): WorkDay => {
    const key = dayKey(date);
    let day = days.get(key);
    if (!day) {
      day = { assigned: 0, completed: 0, status: null };
      days.set(key, day);
    }
    if (!day.status || PRIORITY[status] > PRIORITY[day.status]) day.status = status;
    return day;
  };

  for (const { order, start, end, completed, deadline } of assignments) {
    const startDay = mark(start, "assigned");
    const startKey = `${dayKey(start)}|${order.id}`;
    if (!assignedOn.has(startKey)) {
      assignedOn.add(startKey);
      startDay.assigned += 1;
    }

    if (end && completed) {
      const late = deadline !== null && end.getTime() > deadline.getTime();
      const endDay = mark(end, late ? "late" : "onTime");
      const endKey = `${dayKey(end)}|${order.id}`;
      if (!completedOn.has(endKey)) {
        completedOn.add(endKey);
        endDay.completed += 1;
      }
    } else if (!end && deadline && deadline.getTime() < now) {
      mark(deadline, "missed");
    }

    // Days spent on it between assignment and hand-off (or today)
    const stop = startOfDay(end ?? new Date(now));
    for (let day = addDays(startOfDay(start), 1); day < stop; day = addDays(day, 1)) {
      mark(day, "gap");
    }
  }

  return days;
}

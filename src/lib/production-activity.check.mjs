// Self-check for collectAssignments / buildWorkCalendar.
// Run: node src/lib/production-activity.check.mjs
// shortcut: jiti comes in through Next/Tailwind, not package.json; add it as a devDependency if it ever goes missing.
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const jitiPath = createRequire(path.join(root, "package.json")).resolve("jiti");
const { createJiti } = await import(pathToFileURL(jitiPath).href);
const jiti = createJiti(path.join(root, "x.js"), {
  alias: { "@": path.join(root, "src") },
  jsx: true,
});
const { collectAssignments, buildWorkCalendar } = await jiti.import("@/lib/production-activity.ts");

const me = "u-sw";
const base = { id: "o1", order_number: "ORD-1", status_history: [] };
// SW stage assigned to me (old note only), then moved to Video Graphy Complete with designer_id still me
const stale = {
  ...base,
  status: "video-graphy-complete",
  designer_id: me,
  status_history: [
    {
      id: "a",
      status: "order-submitted",
      timestamp: "2026-11-01T04:00:00Z",
      changedByUserName: "Admin",
    },
    {
      id: "b",
      status: "script-writer",
      timestamp: "2026-11-02T04:00:00Z",
      changedByUserName: "Admin",
      notes: 'Order moved to "Script Writer" and assigned to Sabbir Hossain.',
      deadline: "2026-11-05T04:00:00Z",
    },
    {
      id: "c",
      status: "video-graphy-complete",
      timestamp: "2026-11-06T04:00:00Z",
      changedByUserName: "Admin",
    },
  ],
};
// New-format entry with my id, still open and past deadline
const open = {
  ...base,
  id: "o2",
  status: "script-writer",
  designer_id: me,
  status_history: [
    {
      id: "d",
      status: "script-writer",
      timestamp: "2026-11-10T04:00:00Z",
      changedByUserName: "Admin",
      assignedToUserId: me,
      deadline: "2026-11-12T04:00:00Z",
    },
  ],
};
// Someone else's assignment by id must not count even with a matching name
const other = {
  ...base,
  id: "o3",
  status: "script-writer",
  designer_id: "u-x",
  status_history: [
    {
      id: "e",
      status: "script-writer",
      timestamp: "2026-11-11T04:00:00Z",
      changedByUserName: "Admin",
      assignedToUserId: "u-x",
      notes: "assigned to Sabbir Hossain.",
    },
  ],
};

const list = collectAssignments([stale, open, other], me, "Sabbir Hossain", "SW");
assert.equal(list.length, 2, "only my two assignments");
const s = list.find((a) => a.order.id === "o1");
assert.ok(s.completed, "hand-off to the next stage counts as completed");
assert.ok(s.end.getTime() > s.deadline.getTime(), "handed off after the deadline");
const o = list.find((a) => a.order.id === "o2");
assert.equal(o.end, null);

const days = buildWorkCalendar(list, Date.parse("2026-11-18T04:00:00Z"));
assert.equal(days.get("2026-11-06").status, "late", "late hand-off is a commitment break");
assert.equal(days.get("2026-11-12").status, "missed", "open assignment past deadline is missed");
assert.equal(days.get("2026-11-02").assigned, 1);

// Same order assigned to me twice on one day counts once on that day
const twice = {
  ...base,
  id: "o4",
  status: "script-writer",
  designer_id: me,
  status_history: [
    {
      id: "f",
      status: "script-writer",
      timestamp: "2026-11-15T04:00:00Z",
      changedByUserName: "Admin",
      assignedToUserId: me,
    },
    {
      id: "g",
      status: "script-writer",
      timestamp: "2026-11-15T06:00:00Z",
      changedByUserName: "Admin",
      assignedToUserId: me,
    },
  ],
};
const twiceList = collectAssignments([twice], me, "Sabbir Hossain", "SW");
assert.equal(twiceList.length, 1, "re-assigning to me in the same stage keeps one assignment");
assert.equal(
  buildWorkCalendar(twiceList, Date.parse("2026-11-18T04:00:00Z")).get("2026-11-15").assigned,
  1,
);
// Moving to any other stage completes the work, even cancel; a same-stage note does not end it
const moved = {
  ...base,
  id: "o5",
  status: "canceled",
  designer_id: me,
  status_history: [
    {
      id: "h",
      status: "script-writer",
      timestamp: "2026-11-01T04:00:00Z",
      changedByUserName: "Admin",
      assignedToUserId: me,
    },
    {
      id: "i",
      status: "script-writer",
      timestamp: "2026-11-02T04:00:00Z",
      changedByUserName: "Admin",
      notes: "Link: https://x",
    },
    { id: "j", status: "canceled", timestamp: "2026-11-03T04:00:00Z", changedByUserName: "Admin" },
  ],
};
const [m] = collectAssignments([moved], me, "Sabbir Hossain", "SW");
assert.ok(m.completed, "move to another stage completes");
assert.equal(m.end.toISOString(), "2026-11-03T04:00:00.000Z", "same-stage note is skipped");

// Re-assigned to someone else in the same stage: ended, not completed
const reassigned = {
  ...base,
  id: "o6",
  status: "script-writer",
  designer_id: "u-x",
  status_history: [
    {
      id: "k",
      status: "script-writer",
      timestamp: "2026-11-01T04:00:00Z",
      changedByUserName: "Admin",
      assignedToUserId: me,
    },
    {
      id: "l",
      status: "script-writer",
      timestamp: "2026-11-02T04:00:00Z",
      changedByUserName: "Admin",
      assignedToUserId: "u-x",
    },
  ],
};
assert.equal(
  collectAssignments([reassigned], me, "Sabbir Hossain", "SW").length,
  0,
  "re-assigned to another user of the role: the work is theirs, not mine",
);
// Legacy name notes: re-assigned to another name in the same stage
const reassignedByName = {
  ...base,
  id: "o7",
  status: "script-writer",
  designer_id: "u-x",
  status_history: [
    {
      id: "m",
      status: "script-writer",
      timestamp: "2026-11-01T04:00:00Z",
      changedByUserName: "Admin",
      notes: 'Order moved to "Script Writer" and assigned to Sabbir Hossain.',
    },
    {
      id: "n",
      status: "script-writer",
      timestamp: "2026-11-02T04:00:00Z",
      changedByUserName: "Admin",
      notes: 'Order moved to "Script Writer" and assigned to Rahim.',
    },
    {
      id: "o",
      status: "content-planner",
      timestamp: "2026-11-03T04:00:00Z",
      changedByUserName: "Admin",
    },
  ],
};
assert.equal(collectAssignments([reassignedByName], me, "Sabbir Hossain", "SW").length, 0);

console.log("production-activity self-check passed");

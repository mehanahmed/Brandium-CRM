/**
 * Brief popups shown before an order moves into a stage (Video Editor, Marketer, Developer).
 * Each stage saves under `orders.stage_briefs.<key>`.
 *
 * Passwords are deliberately NOT collected here. Client logins must be shared through a password
 * manager, never stored as plain text in the order.
 */
export type StageBriefField = {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  /** Spans both columns (used for a lone last field so the grid has no empty cell). */
  fullWidth?: boolean;
};

export type StageBriefConfig = {
  key: string;
  title: string;
  submitLabel: string;
  fields: StageBriefField[];
};

export const STAGE_BRIEF_CONFIG: Record<string, StageBriefConfig> = {
  "video-editor": {
    key: "videoEditor",
    title: "Editor Brief",
    submitLabel: "Next: Assign Video Editor",
    fields: [
      {
        key: "completeScriptLink",
        label: "1. Complete Script Link",
        placeholder: "https://drive.google.com/...",
      },
      {
        key: "rawFootageLink",
        label: "2. Raw Footage / Drive Link",
        placeholder: "https://drive.google.com/...",
      },
      { key: "referenceVideoLink", label: "3. Reference Video Link", placeholder: "https://..." },
      {
        key: "editingStyle",
        label: "4. Editing Style",
        placeholder: "Fast cuts, cinematic, minimal ...",
      },
      { key: "videoDuration", label: "5. Video Duration", placeholder: "30 sec, 60 sec ..." },
      {
        key: "voiceOverFile",
        label: "6. Voice-over File",
        placeholder: "Drive link to the voice-over",
      },
      {
        key: "requiredTextGraphics",
        label: "7. Required Text / Graphics",
        placeholder: "On-screen text, logos, lower thirds",
        multiline: true,
      },
      {
        key: "musicSfx",
        label: "8. Background Music / Sound Effects",
        placeholder: "Track name or link",
        multiline: true,
      },
      {
        key: "editingDeadline",
        label: "9. Editing Deadline",
        placeholder: "e.g. 25 Nov 2026, 6 PM",
      },
      {
        key: "exportFormat",
        label: "10. Final Export Format (Resolution / Aspect Ratio)",
        placeholder: "1080x1920, 9:16 ...",
      },
      {
        key: "specialInstructions",
        label: "11. Special Editing Instructions",
        placeholder: "Anything the editor must follow",
        multiline: true,
        fullWidth: true,
      },
    ],
  },
  marketer: {
    key: "marketer",
    title: "Digital Marketer Brief",
    submitLabel: "Next: Assign Marketer",
    fields: [
      {
        key: "platform",
        label: "1. Marketing Platform",
        placeholder: "Facebook, Google Ads, TikTok ...",
      },
      {
        key: "accountId",
        label: "2. Account Number / Account ID",
        placeholder: "Ad account or page ID",
      },
      { key: "username", label: "3. Username / Email", placeholder: "Login used for the account" },
      { key: "campaignLink", label: "4. Campaign / Project Link", placeholder: "https://..." },
      {
        key: "clientTestBrief",
        label: "5. Client Test Brief",
        placeholder: "Test campaign brief from the client",
        multiline: true,
      },
      {
        key: "clientNotes",
        label: "6. Client Notes",
        placeholder: "Notes from the client",
        multiline: true,
      },
      {
        key: "taskDescription",
        label: "7. Task Description (What to Do)",
        placeholder: "What to set up or run",
        multiline: true,
      },
      {
        key: "taskInstructions",
        label: "8. Task Instructions (How to Do)",
        placeholder: "Steps, targeting, budget rules",
        multiline: true,
      },
      {
        key: "referenceLink",
        label: "9. Reference Link",
        placeholder: "https://...",
        fullWidth: true,
      },
      {
        key: "additionalInstructions",
        label: "10. Additional Instructions",
        placeholder: "Anything else",
        multiline: true,
        fullWidth: true,
      },
    ],
  },
  developer: {
    key: "developer",
    title: "Developer Brief",
    submitLabel: "Next: Assign Developer",
    fields: [
      { key: "projectName", label: "1. Project / Task Name", placeholder: "Name of the task" },
      { key: "siteLink", label: "2. Website / Application Link", placeholder: "https://..." },
      {
        key: "technology",
        label: "3. Technology / Platform",
        placeholder: "Next.js",
      },
      { key: "adminPanelLink", label: "4. Admin Panel Link", placeholder: "https://.../admin" },
      {
        key: "username",
        label: "5. Login Username / Email",
        placeholder: "Login used for the admin panel",
      },
      { key: "referenceLink", label: "6. Reference Link", placeholder: "https://..." },
      {
        key: "requiredFiles",
        label: "7. Required Files / Assets",
        placeholder: "Drive link to assets",
      },
      { key: "deadline", label: "8. Deadline", placeholder: "e.g. 30 Nov 2026" },
      {
        key: "clientTaskBrief",
        label: "9. Client Task Brief",
        placeholder: "What the client asked for",
        multiline: true,
      },
      {
        key: "clientNotes",
        label: "10. Client Notes",
        placeholder: "Notes from the client",
        multiline: true,
      },
      {
        key: "taskDescription",
        label: "11. Task Description (What to Do)",
        placeholder: "Features or fixes to deliver",
        multiline: true,
      },
      {
        key: "technicalInstructions",
        label: "12. Technical Instructions (How to Do)",
        placeholder: "Steps, constraints, standards",
        multiline: true,
      },
      {
        key: "additionalInstructions",
        label: "13. Additional Instructions",
        placeholder: "Anything else",
        multiline: true,
        fullWidth: true,
      },
    ],
  },
};

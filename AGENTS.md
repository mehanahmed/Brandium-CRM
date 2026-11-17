# AGENTS.md

Welcome to the **Brandium CRM** repository.

## Repository Overview

- **Framework**: Next.js 15 (App Router) + React 19
- **Database**: MySQL (brandium_crm) / Direct Server API Route Handlers
- **Styling**: Tailwind CSS & Radix UI / Shadcn UI

## Universal AI Engineering Framework

- **Mission**: Build production-ready software using an inspect â†’ plan â†’
  implement â†’ verify workflow.
- **Core Rules**:
  - Never claim success without empirical evidence.
  - Prefer maintainable, secure, scalable solutions.
  - Preserve existing working code and maintain state resilience.
  - Validate all external input and enforce server-side authorization.
  - Run build, lint, typecheck, and tests when available.
  - Report verified, assumed, untested, and blocked items separately.
- **Completion Gate**:
  - Implementation finished & Build succeeds.
  - Relevant tests pass & Documentation updated.
  - Zero critical errors remain.

## Interaction Guidelines

- **Premium UI**: Always prioritize high-end design. Use Radix UI components,
  smooth transitions, and curated color palettes.
- **Banglish Summary**: Provide a concise summary of the work performed in
  **Banglish** (Bengali written in Latin/English script) after completing
  each task. **NEVER use direct Bengali Unicode characters (e.g., à¦¬à¦¾à¦‚à¦²à¦¾)** â€”
  always write Bengali phonetically in English letters only (e.g., "Ami kaj
  shesh korlam").
- **Summary of Actions**: After the Banglish summary, provide a clear,
  bulleted "Summary of Actions" in English to detail the specific technical
  steps taken.
- **Benefit Comparison Table**: Always provide a comparison table in
  **Banglish** (using Latin/English script, never Unicode Bengali) showing
  the **Previous State/Implementation** vs. the **Recent State/Benefits** of
  your changes at the end of each task.
- **Git Push Policy**: NEVER push code to GitHub automatically after
  completing a task. Only run `git push` when the user explicitly
  requests/commands to push to GitHub.
- **Automatic Error-Fix Rule Recording**:
  - Whenever an error, bug, or issue is resolved during a task, immediately
    document and append the exact resolution pattern & prevention rule to
    `AGENTS.md` so that future turns and tasks never repeat the same mistake.

## Code Quality & Zero-Error Formatting Rules

- **Strict Prettier & ESLint Code Formatting**:
  - Always surround Markdown headings and lists with blank lines (enforce
    `MD022` and `MD032`).
  - Always declare variables with `const` unless reassigned (enforce ESLint
    `prefer-const`).
  - Never leave double blank lines anywhere in TypeScript/TSX code files.
  - Automatically wrap long string properties, function parameters, state
    updaters, and JSX `cn(...)` calls across newlines per Prettier
    line-length rules.
  - Always include trailing commas in multiline objects, arrays, parameter
    lists, and arrow function calls.
- **Tailwind CSS Utility Standards**:
  - Prefer standard Tailwind CSS utility classes over arbitrary brackets
    wherever available.
- **Database & State Fallback Resilience**:
  - Provide fail-safe default values and demo fallback data for all queries
    and state hooks to ensure components never render empty or broken text
    lines.
- **Direct MySQL Database Persistence Policy & Automatic Schema Bootstrapping**:
  - Always save and persist all data entities (prospects, users, stages,
    services, invoices, activity logs, follow-ups, meetings, sales, etc.)
    directly into the local MySQL database (`brandium_crm`).
  - Do NOT rely on browser `localStorage` or client-side mock memory for
    primary data storage.
  - Execute all mutations and reads via server-side functions
    (`createServerFn`) connecting directly to MySQL.
  - Automatically create all database tables (`users`, `profiles`, `user_roles`,
    `services`, `stages`, `prospects`, `prospect_stage_history`, `sales`,
    `activities`, `meetings`, `opportunities`, `invoices`,
    `payments`) with `CREATE TABLE IF NOT EXISTS` schema bootstrapping during
    connection (modeled after `C:\Transfer\Running Projects\erpapp`).

## Resolved Patterns & Prevention Rules

- **Index Signature & Unknown Dynamic Data Property Access (TS4111 & TS2322)**:
  - When accessing query results or dynamic records with index signatures
    (`Record<string, unknown>`), always use bracket notation
    `record["property_name"]` instead of dot notation.
  - Cast the result explicitly using `(record["property_name"] as string)`
    or wrap with `String(...)` to ensure safe string type assignment
    without leaving `unknown` or `{}` types.

- **Markdown Bare URL / Email Format Warnings (MD034)**:
  - Enclose email addresses or bare unformatted URLs in backticks (e.g.,
    `user@example.com`) or proper angle bracket links
    (`<https://example.com>`) to satisfy markdown linter `MD034`.

- **Tailwind CSS v4 Utility Standard Conversions**:
  - Replace arbitrary bracket sizing like `min-w-[8rem]` with built-in
    Tailwind utilities like `min-w-32`.
  - Replace arbitrary pixel values with standard utilities (e.g.,
    `max-h-[380px]` $\rightarrow$ `max-h-95`, `sm:max-h-[420px]` $\rightarrow$ `sm:max-h-105`,
    `left-[17px]` $\rightarrow$ `left-4.25`).
  - Replace CSS variable bracket syntax like `max-h-[var(--name)]` with
    standard parenthetical syntax `max-h-(--name)`.
  - Replace explicit data attribute brackets like `data-[disabled]:...` with
    concise pseudo-variant syntax like `data-disabled:...`.

- **Dialog & Modal Sub-component Import Completeness**:
  - Whenever rendering nested modal components (such as `DialogHeader`,
    `DialogTitle`, `DialogDescription`, or `DialogFooter`), always verify and
    explicitly include them in the `@/components/ui/dialog` import list to
    prevent runtime `ReferenceError: DialogHeader is not defined` crashes.

- **Vite Client SPA Runtime & Node.js MySQL Direct Socket Access**:
  - In Vite client SPA mode (`vite dev`), browser JS cannot open direct TCP
    sockets to MySQL port 3306. Always route browser SQL operations through
    a Node.js Vite server middleware endpoint (`/api/mysql` configured via
    `viteMySQLPlugin` in `vite.config.ts`) using `runMySQLQuery()`, which
    executes queries inside Node.js and persists directly into local MySQL
    database `brandium_crm` visible in phpMyAdmin.

- **TanStack Start Server Function Serializability & Seroval Serialization**:
  - Server functions (`createServerFn`) require return types to be strictly serializable. Avoid returning raw `Record<string, unknown>[]` or non-plain MySQL class instances (e.g. `ResultSetHeader`, `Date` objects, `Buffer`) directly as they cause `Seroval Error (specific: 1)`. Always sanitize rows into pure primitive dictionaries (`Record<string, string | number | boolean | null>`) and normalize non-array execution headers into plain `{ affectedRows, insertId }` objects.

- **Pure Direct MySQL Database Persistence Policy**:
  - All data operations and entity mutations bypass client-side localStorage/mock stores completely and execute directly against the local MySQL database (`brandium_crm`) via Node.js `/api/mysql` endpoint and `createServerFn` server functions.

- **Supabase User Auth Profile Property Access & React Hook Memoization**:
  - `User` type from `@supabase/supabase-js` does not contain top-level `.name` property. Always access user full name via `profile?.full_name` or `user.user_metadata?.full_name`.
  - When creating computed dropdown list options inside dialog components, move raw query data resolution inside `useMemo` callbacks to prevent `react-hooks/exhaustive-deps` warnings.

- **Exact Optional Property Types Compatibility (TS2379)**:
  - When assigning objects with possible undefined fields to interfaces under `exactOptionalPropertyTypes: true`, always declare property types explicitly as `string | undefined` rather than purely optional `string` to prevent assignment incompatibility.

- **Raw SQL API Bridge Production Guardrail**:
  - Never expose a browser-callable endpoint that executes arbitrary SQL in production. Keep legacy raw SQL compatibility behind an explicit local-only flag such as `ENABLE_DEV_SQL_API=true`, return redacted database errors to clients, and route production mutations through validated TanStack Start server functions with server-only `MYSQL_*` credentials.

- **Dashboard Metric & Column List Filter Alignment**:
  - Ensure the statistical counts calculated in `dashboardMetricsQuery` match the exact boolean filter predicates used in the dashboard column category lists (`categoryLists` in `dashboard.tsx`). Specifically, `follow_up_stage` must strictly match prospects with `stage_name` containing "follow" rather than broadly matching all non-won or new prospects, preventing mismatch between top KPI summary cards and bottom category columns.

- **MySQL Table Schema Alignment & Automatic Column Migration**:
  - Ensure all database tables (`meetings`, `invoices`, `opportunities`, `payments`, `services`, `activities`) contain all entity attributes (e.g. `phone`, `location`, `meeting_type`, `meeting_date`, `meeting_time`, `due_amount`, `transaction_reference`, `icon`) defined in TypeScript models. When creating or bootstrapping schema tables, include all current entity fields and run safe column additions (`ALTER TABLE tbl ADD COLUMN IF NOT EXISTS`) to prevent runtime `Unknown column 'x' in 'field list'` SQL errors during insert/update mutations.

- **Vite Cloudflare Tunnel Host Blocking (`server.allowedHosts`)**:
  - When port forwarding via Cloudflare Tunnel (`*.trycloudflare.com`), Vite dev server blocks untrusted HTTP `Host` headers by default. Always configure `server: { allowedHosts: true }` in `vite.config.ts` so external tunnel hostnames render without `Blocked request. This host is not allowed` errors. Also point `cloudflared` directly to IPv4 `http://127.0.0.1:<port>` to avoid IPv6 `[::1]` connection refusal issues.

- **MySQL User Table Column Name Alignment (`users.name` vs `profiles.full_name`)**:
  - In local MySQL database `brandium_crm`, the user name column in table `users` is `name` (not `full_name`), whereas in table `profiles` it is `full_name`. When joining queries with `users` and `profiles`, always use `COALESCE(prof.full_name, u.name, u.email)` to avoid `Unknown column 'u.full_name' in 'field list'` SQL errors.

- **Stage Table Join Column Accuracy (`prospects.stage_id` vs non-existent `prospects.stage_name`)**:
  - In table `prospects`, stage linkage is stored strictly in `stage_id` (not `stage_name`). Never reference `p.stage_name` in `SELECT` or `ON` clauses. Always join via `LEFT JOIN stages st ON (p.stage_id = st.id OR p.stage_id = REPLACE(st.id, '-', '_') OR p.stage_id = st.name)` and use `COALESCE(st.name, p.stage_id, 'Prospect') AS stage_name` to prevent `Unknown column 'p.stage_name' in 'field list'` SQL exceptions.

- **Vite Dev MySQL Bridge Production Routing & 404 Error Prevention**:
  - In `src/lib/mysql-api.ts`, browser direct `fetch("/api/mysql")` must only execute when `import.meta.env.DEV` is `true`. In production builds or non-dev server environments where Vite dev middleware is omitted, calling `/api/mysql` results in HTTP 404 errors. Automatically auto-disable direct `/api/mysql` fetch when `import.meta.env.DEV` is `false` or when receiving HTTP 404/403 responses, falling back directly to TanStack Start server functions (`executeMySQLQueryFn`).

- **In-Memory Schema Bootstrapping Cache & Concurrency Latch**:
  - Centralized schema verification (`ensureMySQLTablesExist`) must be guarded by an in-memory lock (`isSchemaInitialized` & `initSchemaPromise`). This ensures the full table creation (`CREATE TABLE IF NOT EXISTS`), column migration (`INFORMATION_SCHEMA` $\rightarrow$ `ALTER TABLE`), and seeding routines execute safely once on server startup while eliminating all DDL latency overhead (100-300ms) on subsequent API and query requests.

- **Relational User ID Dropdown Option Matching & Dialog Pre-fill**:
  - When saving relational foreign keys (such as `assigned_artist_id` and `assigned_to`) as pure user IDs in MySQL (`prospects`), all UI dropdown `<SelectItem>` elements must use `art.id` / `ag.id` as their `value` property rather than names.
  - Dialog queries and form initialization hooks (`useEffect`) must map both `p.assigned_artist_id` and `p.assigned_to` by ID with regex fallback to legacy note tags, and user option queries (`fetchAgentOptions`, `fetchArtistOptions`) must query all active users joined with `profiles.full_name` so any assigned user ID matches and pre-selects correctly in the Radix UI Select component.

- **Real-Time Self-Healing Schema Auto-Migration (`executeMySQLQueryFn`)**:
  - Whenever an `INSERT`, `UPDATE`, or `SELECT` query fails with `Unknown column 'x' in 'field list'`, `executeMySQLQueryFn` automatically intercepts the SQL error, parses the missing column name and target table, dynamically infers the exact column data type (e.g. `TINYINT(1)`, `VARCHAR(36)`, `DECIMAL(12,2)`, `DATETIME`), executes `ALTER TABLE \`table\` ADD COLUMN \`col\` type` instantly on the database, and re-executes the original query. This guarantees zero downtime and zero schema mismatches across any environment.

- **Next.js 15 App Router & Server/Client Boundary Architecture**:
  - In Next.js App Router, client components marked with `"use client"` must NEVER directly or indirectly import Node.js native drivers (such as `mysql2`, `bcryptjs`, `fs`, `net`, `tls`).
  - Keep client-safe helpers (`generateUUID`, `getMySQLTimestamp`, `formatCrmDate`, `runMySQLQuery`) in `src/lib/mysql-client.ts` and `src/lib/mysql-api.ts`. Keep database connection pools (`getMySQLPool`, `createSingleMySQLConnection`) strictly in `src/lib/mysql-server.ts`.
  - Client components communicate with MySQL via Next.js Route Handlers (`/api/mysql`, `/api/auth/login`, `/api/upload`), ensuring complete persistence to local MySQL database `brandium_crm` with zero webpack bundling errors during `next build`.

- **Prospect Artist & Agent Assignment Separation**:
  - In `src/lib/prospects.ts`, `getProspectArtistName` must NEVER fall back to `assigned_agent_name`. If `assigned_artist_id` or `artist` is unassigned/empty, it must strictly return `"Unassigned"`.
  - In `prospectsQuery`, always join `users u_artist` and `profiles prof_artist` on `p.assigned_artist_id` to populate `assigned_artist_name` distinctly from `assigned_agent_name`.

- **Edit Modal Direct Prop Initialization & Key Remounting**:
  - In `EditProspectDialog`, pass `prospect` directly as a prop in addition to `prospectId` and mount with `key={editProspect?.id || "none"}`. This guarantees instant 0ms pre-fill of `service_id`, `assigned_artist_id`, and `assigned_to` in Radix UI Select components without async state flash or placeholder fallbacks.

- **Agent and Artist Dropdown Role Filtering**:
  - `fetchAgentOptions` must filter users with `LOWER(u.role) IN ('agent', 'admin')`, and `fetchArtistOptions` must filter users with `LOWER(u.role) = 'artist'`.
  - Always use `u.role` from table `users` (never `p.role` on `profiles`) as the `profiles` table schema only stores `id`, `full_name`, `email`, and `avatar_url`.

- **Next.js App Router Dynamic Runtime Upload Serving (`/uploads/[filename]` Route Handler)**:
  - In Next.js production mode (`next start`), files written to `public/uploads/` dynamically after `next build` are not included in Next.js's static build manifest and return 404 by default. Always create an App Router Route Handler at `src/app/uploads/[filename]/route.ts` that streams dynamic binary image files directly from the disk filesystem (`public/uploads`) with appropriate `Content-Type` and cache headers.

- **Next.js App Router Dynamic Runtime Upload Serving (`/uploads/[filename]` Route Handler)**:
  - In Next.js production mode (`next start`), files written to `public/uploads/` dynamically after `next build` are not included in Next.js's static build manifest and return 404 by default. Always create an App Router Route Handler at `src/app/uploads/[filename]/route.ts` that streams dynamic binary image files directly from the disk filesystem (`public/uploads`) with appropriate `Content-Type` and cache headers.

- **Dashboard Prospect List Service Relational Join & ScrollArea**:
  - In `src/lib/dashboard.ts`, `recentProspectsQuery` must explicitly `LEFT JOIN \`services\` srv ON (p.service_id = srv.id OR p.service_id = srv.name)`and select`COALESCE(srv.name, p.service_id) AS service_name`so service names populate rather than displaying`"No service"`.
  - In `src/app/(authenticated)/dashboard/page.tsx`, wrap category prospect column lists inside Radix `<ScrollArea className="h-125 pr-2.5">` to show 10 items comfortably per column with smooth vertical scrolling for overflow items.

- **Sales CRM Contact Card UI & Modern Typography Standardization**:
  - In `src/app/(authenticated)/prospects/page.tsx`, render prospect cards matching the Dreamstechnologies Sales CRM template with `Golos Text` typography, 40px circular profile avatars, 31px action button with clean dropdown menu (Edit, Preview/View Stage, Update Stage, Delete), email/phone/location rows with dark icons, dynamic soft pastel badges (`badge-soft-*`), quick circular communication action links (Mail, PhoneCall, WhatsApp, Website/Social), and assigned agent/artist avatar in the footer.
  - When importing external web fonts in Tailwind CSS (`src/styles.css`), always position `@import url(...)` at the very beginning of the stylesheet prior to `@import "tailwindcss"` to maintain CSS specification compliance.

- **Action Dropdown Menu Spec Standardization (Sales CRM Template)**:
  - In `src/app/(authenticated)/prospects/page.tsx`, format the action dropdown content to 160px width (`w-[160px] min-w-[160px]`), 5px border radius (`rounded-[5px]`), 4px padding (`p-1`), with box shadow (`shadow-[0_4px_4px_0_rgba(219,219,219,0.25)]`).
  - Style dropdown menu items with `px-[15px] py-[6.4px] rounded-[6px] text-[14px] font-normal leading-[21px] text-[#707070]`, paired with specific icon accent colors (Edit: `#1B84FF`, Delete: `#707070`, Preview: `#00c5fb`, Update Stage: `emerald-600`) to guarantee 100% visual match with Dreamstechnologies template.

- **Sales CRM Offcanvas Contact Form Drawer Standardization (`offcanvas_edit` & `offcanvas_add`)**:
  - In `src/components/edit-prospect-dialog.tsx` and `src/components/add-prospect-dialog.tsx`, implement slide-out drawers via Radix UI `Sheet` (`side="right"`, `w-full sm:max-w-[750px] lg:max-w-[800px]`) mirroring Bootstrap 5 `offcanvas-end` from Dreamstechnologies Sales CRM.
  - Structure forms into bordered accordion sections (`rounded-[5px] border-slate-200`) featuring `[30px]` badge headers in Brandium Green `bg-[#67B239]` and Brandium Navy `bg-[#0a2e5c]`, 80x80 dashed avatar preview with top-right trash button and Brandium Green "Upload file" button (`bg-[#67B239] hover:bg-[#5aa030]`), First Name / Last Name / Job Title / Company Name input rows (`h-[39px] rounded-[6px] text-[14px] text-[#707070]`), Email field with `Email Opt Out` toggle switch, and a sticky action footer with Cancel and Brandium Green Save Changes buttons (`bg-[#67B239] hover:bg-[#5aa030]`).

- **Brand Identity & Color Fidelity Policy**:
  - Always apply Brandium CRM's core brand color palette: Primary Navy (`#0a2e5c` / `#0b3364`) and Growth Green (`#67B239` / `#7ac142`, hover `#5aa030`) for badges, primary call-to-actions, active toggle states, and headers. Never retain external template primary colors (such as template red `#E41F07`) on brand UI elements.

- **Prospects Grid Density & Dynamic Pagination Standard**:
  - For responsive prospect card grids (1, 2, 3, or 4 columns), standard `pageSize` is 12 (replacing legacy 10 to ensure zero orphaned cards across 2, 3, and 4-column layouts).
  - Include an explicit "Show: [12] per page" Radix `Select` dropdown in the bottom pagination bar with options `12`, `24`, `36`, `48`, allowing users to adjust card density dynamically while persisting state via `useAppFilters`.

- **Prospect Creator Avatar & Name Rendering Standard**:
  - In `prospectsQuery` (`src/lib/prospects.ts`), select `creator_avatar` and `creator_name` via `COALESCE(prof_create.avatar_url, u_create.avatar_url, prof_assign.avatar_url, u_assign.avatar_url)` and `COALESCE(prof_create.full_name, u_create.name, prof_assign.full_name, u_assign.name)` joined by `p.created_by = u_create.id` to ensure every prospect retains the photo and name of the user who added it.
  - In `src/app/(authenticated)/prospects/page.tsx`, the bottom-right footer of each card renders both the creator's circular avatar image (`<img src={creatorAvatar} />`) and the creator's full name (`{creatorName}`) side-by-side with smooth initial fallback when an image is not uploaded.

- **Prospect Form Drawer Section Header Naming Standard**:
  - In `EditProspectDialog` (`src/components/edit-prospect-dialog.tsx`) and `AddProspectDialog` (`src/components/add-prospect-dialog.tsx`), the secondary accordion section housing Service selection and Notes/Requirements is titled **"Service & Notes"** (replacing the legacy "CRM & Assignment").

- **Prospect Form Phone Requirement & Email Opt-Out Simplification**:
  - In `AddProspectDialog` and `EditProspectDialog`, `phone` is a mandatory contact field. It must render with a visual red asterisk (`Phone <span className="text-[#EF1E1E]">*</span>`), have the `required` HTML attribute on its input, and be validated in `handleSubmit` (`if (!phone.trim()) { toast.error("Phone number is required."); return; }`).
  - The legacy `Email Opt Out` switch toggle and its state/imports are permanently removed from prospect creation and edit forms to streamline lead entry.

- **Prospect Card Creation Date & Time Display Standard**:
  - In `src/app/(authenticated)/prospects/page.tsx`, every prospect card displays its creation timestamp formatted with 12-hour AM/PM (e.g., `Sep 8, 2026, 7:47 PM`) directly underneath the Location row using `formatCrmDateTime(p.created_at)` from `@/lib/mysql-client` and paired with a `<CalendarIcon className="size-3.5 text-slate-800 dark:text-slate-200 shrink-0" />`.

- **Prospect Card Notes & Requirements Display Standard (Torn Paper / "Chira Kagoj" via SVG)**:
  - In `src/app/(authenticated)/prospects/page.tsx`, every prospect card displays its notes/requirements directly underneath the Creation Date & Time row and above the Soft Badges row. Notes are cleaned via `getProspectCleanNotes(p.notes)` (stripping internal `[Artist: ...]` and `[Agent: ...]` tags), styled inside an authentic ripped paper banner rendered via a precision `<svg viewBox="0 0 500 100" preserveAspectRatio="none">` path mirroring real torn paper silhouettes (ripped top and bottom edges, corner cuts, and downward tear spikes), styled with soft pastel yellow sticky note color palette (`fill-[#FEFCE8] dark:fill-[#1e1a0e] stroke-[#FDE68A]/60 dark:stroke-[#4a3f1d]`), paired with subtle amber typography (`<FileText className="size-3.5 text-amber-700 dark:text-yellow-400" /> Note:` in amber-800 / dark yellow-300), bottom paper shadow (`filter drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.12)]`), single-line truncated with `title={cleanNote || "No note"}` for full hover tooltip, and falls back to a muted italic `"No note"` when empty.
- **Projects Page Card Grid Layout Standard**:
  - On `/projects` (`src/app/(authenticated)/projects/page.tsx`), projects are presented in a responsive multi-column card grid (`grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`) replacing the legacy horizontal Kanban board.
  - Each project card features:
    - Top: Project Code badge, business title, and 3-dot dropdown action menu (View Details, Edit Project, Advance Stage, Delete).
    - Middle: Contact person, phone, email, creation date, stage soft badge (with dynamic color indicator), and service badge.
    - Footer: Assigned team member avatars and names (Artist & Agent overlapping avatar badges) and quick "Details" button.
  - Search and filter controls allow instant live filtering by text, stage, and assigned artist.

- **Dreamstechnologies Sales CRM Projects Page Reference Standard (`media_1789243032328.png` / `projects.html`)**:
  - In `src/app/(authenticated)/projects/page.tsx`, the Projects page strictly mirrors the Dreamstechnologies Sales CRM template and reference image:
    - **Header**: `Projects` title with soft red counter badge `125` (`bg-[#FEE2E2] text-[#EF1E1E] rounded-md px-2 py-0.5 text-xs font-semibold`) and Export dropdown (`ti ti-package-export`).
    - **Filter & Action Toolbar**: Clean row without outer card container:
      - Left: Filter button (`ti ti-filter` + chevron) opening a popover with Pipeline Stage, Priority, Artist dropdowns and Reset button, followed by Search input with leading `ti ti-search` icon and placeholder `Search`.
      - Right: Brandium Growth Green `+ Add New Project` button (`bg-[#67B239] hover:bg-[#5aa030] text-white`).
    - **Card Design (100% Reference Image Match)**:
      - Typography & Font: `font-['Golos_Text',sans-serif]`, padding `p-5`, border radius `rounded-[12px]`, subtle border `border border-slate-200/90`, shadow `shadow-[0_4px_4px_0_rgba(219,219,219,0.25)]`.
      - Row 1: Priority soft badge with dot (`● High` in `bg-[#FDE8E8] text-[#EF1E1E]`, Medium in `#FFF4E6`/`#FF9F43`, Low in `#E8F9ED`/`#28C76F`), Active badge (`bg-[#16A34A] text-white`), and golden star favorite icon (`ti ti-star-filled text-[#F59E0B] text-[17px]`).
      - Row 2: Light info box (`bg-[#F8F9FA] rounded-[8px] p-2.5 mb-3.5`), 40px circular logo avatar with vibrant SVG logos, project title (`font-semibold text-[14px] text-[#1F2020]`), service subtitle (`text-[12px] text-[#707070]`), and 30px 3-dots action button opening full management dropdown.
      - Row 3: 2-line truncated description (`Kofejob is a freelancers marketplace where you can post projects & get instant help.` or notes).
      - Row 4: 3 metadata rows styled with `text-[13px] text-[#707070] mb-2`:
        - Project ID: `ti ti-forbid-2` `Project ID : #12145`
        - Value: `ti ti-report-money` `Value : $03,50,000`
        - Due Date: `ti ti-calendar-exclamation` `Due Date : 15 Oct 2023`
      - Row 5: Overlapping assigned team avatars (Artist and Agent) resolved dynamically by user ID (`usersMap.get(project.assigned_artist_id)` / `agent_id`), paired with 32px circular Project Creator avatar on the right resolved by user ID (`created_by`), replacing legacy static mock counters and decorative badges.
      - Row 6 (Footer): `border-t border-[#F1F5F9] pt-3` with Total Hours badge (`bg-[#EBF5FF] text-[#2563EB] rounded-[5px] px-2.5 py-1 text-[12px] font-medium` with `ti ti-clock-stop` `Total Hours : 100` / `80` / `75`) and communication counters: WeChat (`ti ti-brand-wechat` `02`) and Subtasks (`ti ti-subtask` `04`).
    - **Slide-Out Offcanvas Drawer (`offcanvas_add` & `offcanvas_edit`)**:
      - Slide-out Radix UI `Sheet` (`side="right"`, `w-full sm:max-w-[750px] lg:max-w-[800px]`, `bg-[#f8f9fa] dark:bg-slate-950`) divided into accordion cards with Brandium Green `#67B239` and Navy `#0a2e5c` badge headers: Basic Information, Stage & Financials, and Team Assignment & Specifications with sticky action footer.

- **Tabler Icons Local Hosting & Cross-Origin Font Blocking Prevention**:
  - Remote CDN / external template stylesheets (`crms.dreamstechnologies.com`) block webfonts (`.woff2`, `.woff`, `.ttf`) in modern browsers due to missing `Access-Control-Allow-Origin` CORS headers, rendering icons as blank squares.
  - Always host Tabler Icons locally in `public/tabler-icons/` (`tabler-icons.min.css` and `fonts/tabler-icons.woff2`), link it directly in `RootLayout` via `<link rel="stylesheet" href="/tabler-icons/tabler-icons.min.css" />`, and include explicit aliases for `.ti-star-filled:before` (`\eb2e`) and `.ti-square-rounded-plus-filled:before` (`\f63f`).

- **Workspace Scratch File Cleanup & Tailwind v4 Unknown At-Rule Inspection**:
  - Never retain temporary migration/fetch helper scripts (`.cjs`, `.js`) in workspace project root or `scratch/` folders inside the codebase; always remove them upon task completion to keep linter diagnostics 100% clean.

- **Prospect Stage History Vertical Tracking Timeline & Note Array Standard**:
  - In `src/components/view-stage-dialog.tsx`, prospect stage transitions are presented as a sleek, vertical logistics/tracking style timeline matching modern delivery/audit tracking interfaces:
    - **Date Column (Left)**: Renders short date (e.g. `10-26`, `09-26` via `format(new Date(item.date), "MM-dd")`). Topmost / active transition displays highlighted in purple (`text-purple-600 dark:text-purple-400 font-semibold`), while previous transitions render in neutral slate (`text-slate-400 dark:text-slate-500 font-normal`).
    - **Timeline Track & Node (Middle)**: A continuous dashed line (`border-l-2 border-dashed border-slate-200 dark:border-slate-800`) connects all steps. Topmost / latest step renders a glowing purple circular node with outer halo ring (`size-4 bg-purple-600 ring-4 ring-purple-100 dark:ring-purple-950/70 shadow-xs`), while completed/earlier steps render clean solid slate dots (`size-3 bg-slate-400 dark:bg-slate-500`).
    - **Stage Title & Time (Right Header)**: Topmost step title is styled in `text-purple-700 dark:text-purple-300 font-semibold`, while previous stages render in `text-slate-800 dark:text-slate-200 font-medium`. Time is right-aligned in `text-slate-400 font-normal` (`HH:mm`).
    - **Note Array Rendering (`parseNotesToArray`)**: Automatically parses single-string, multiline, bulleted, and JSON notes into a clean `string[]` array. Each note item is rendered as a clean description line (`text-slate-400 dark:text-slate-400 text-sm leading-relaxed`) underneath the title, with subtle actor attribution (`by [Name]`).
    - **Descending Chronological Order**: Timeline entries are sorted newest at the top (Index 0) down to initial prospect creation at the bottom.
  - In `src/lib/stages.ts`, `stageHistoryQuery` joins `users` and `profiles` tables on `psh.changed_by` to deliver `changed_by_name` and `changed_by_avatar` dynamically from MySQL.
  - Tailwind CSS v4 custom directives (`@source`, `@custom-variant`, `@theme`) trigger IDE CSS language server warnings by default. Configure `"css.lint.unknownAtRules": "ignore"` in `.vscode/settings.json` to silence false positive warnings.

- **Projects Assigned Team Members & Creator Avatar by User ID Standard**:
  - On `/projects` (`src/app/(authenticated)/projects/page.tsx`), Row 5 dynamically resolves both:
    - **Assigned Team Members** (Left): Looks up `project.assigned_artist_id` and `project.assigned_agent_id` via `usersMap` to display genuine user avatars (or colored initials) with role-specific tooltips (`Artist: [Name]`, `Agent: [Name]`). Eliminates static dummy counters (`+04`/`+05`).
    - **Project Creator Avatar** (Right): Replaces the arbitrary decorative company icon with a 32px circular avatar of whoever created/added the project (`created_by`), resolved by user ID via `usersMap` and MySQL database joins (`users u_creator` & `profiles prof_creator`).
  - Automatically migrates table `projects` with `ADD COLUMN created_by VARCHAR(36) NULL` and persists `created_by: user.id` upon project creation via `ProjectOffcanvasDrawer`.

- **Projects Brand Color UI Standardization**:
  - Primary call-to-actions on `/projects` (`src/app/(authenticated)/projects/page.tsx`), specifically the `+ Add New Project` button, strictly use Brandium Growth Green (`bg-[#67B239] hover:bg-[#5aa030] text-white`).
  - Active filter indicators and interactive reset links follow the same brand palette (`bg-[#67B239]`, `text-[#67B239] hover:text-[#5aa030]`), and the header project counter badge renders in soft green (`bg-[#67B239]/15 text-[#55962e] dark:bg-[#67B239]/25 dark:text-[#7ac142]`) ensuring complete visual alignment with the Brandium CRM design system.

- **Color Hut / Radix Alert Delete Confirmation Dialog Specification**:
  - Across CRM entity deletion dialogs (e.g. `ProjectsPage` in `src/app/(authenticated)/projects/page.tsx` and `DeleteProspectDialog` in `src/components/delete-prospect-dialog.tsx`), implement the exact dialog layout, color, and CSS specifications:
    - **Container**: `w-full max-w-[512px] bg-[#EEEFF2] dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 rounded-[12px] p-6 shadow-lg gap-4 text-slate-900 dark:text-slate-100` (`box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)`).
    - **Header**: Left-aligned (`flex flex-col space-y-2 text-left sm:text-left`).
      - Title: `text-lg font-semibold flex items-center gap-2 text-[#0f1729] dark:text-slate-100` with Lucide `TriangleAlert` (`size-6 text-[#dc2626] stroke-[2]`).
      - Text: `"Are you absolutely sure?"`
      - Subtitle: `text-sm text-[#94a3b8] dark:text-slate-400 text-left mt-2 leading-5` -> `"This action cannot be undone. This will permanently delete the [entity] for \"[Name]\"."` with `font-semibold text-[#94a3b8] dark:text-slate-300` for the entity title/name.
    - **Footer**: `flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-0` (or `gap-2`).
      - **Cancel Button**: `h-10 px-4 py-2 mt-2 sm:mt-0 bg-[#EEEFF2] dark:bg-slate-800 border border-[#E1E7EF] dark:border-slate-700 text-[#0f1729] dark:text-slate-200 hover:bg-[#E1E7EF]/80 dark:hover:bg-slate-700 rounded-[10px] text-sm font-medium shadow-none cursor-pointer`.
      - **Delete Button**: `h-10 px-4 py-2 bg-[#dc2626] hover:bg-[#dc2626]/90 text-[#fafafa] rounded-[10px] text-sm font-medium shadow-none cursor-pointer border-0` with label `"Yes, delete [entity]"`.

- **Projects Prospect Integration & Auto-Fill Standard**:
  - In `ProjectOffcanvasDrawer` (`src/app/(authenticated)/projects/page.tsx`), project creation integrates a dedicated **Select Prospect / Lead** selector at the top of Basic Information.
  - Selecting a prospect automatically populates `client_name`, `client_phone`, `client_email`, `service_id`, `assigned_artist_id`, `assigned_agent_id`, `notes`, auto-suggests project title, links `prospect_id` in the database, and provides fallback to custom projects when unlinked.

- **ERPAPP Add/Edit Project Dialog UI Standard (`ProjectFormDialog`)**:
  - In `src/app/(authenticated)/projects/page.tsx`, the Add/Edit Project interface uses a centered modal dialog (`Dialog`) strictly mirroring the layout, dimensions, UX conventions, and aesthetics of ERPAPP's `create-order-dialog.tsx` and `edit-order-dialog.tsx`:
    - **Modal Container**: `<DialogContent className="w-[95vw] sm:w-full max-w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-3xl xl:max-w-4xl max-h-[92vh] sm:max-h-[90vh] p-3.5 sm:p-6 overflow-hidden flex flex-col">`.
    - **Header**: Compact `DialogHeader` (`pb-1 sm:pb-2 pr-8 sm:pr-0`), `DialogTitle` (`text-base sm:text-lg`) showing "Create New Project" or `Edit Project: <span className="font-normal">{title}</span>`, and `DialogDescription` (`text-xs sm:text-sm`).
    - **Scrollable Form Body**: `<div className="grid gap-3 sm:gap-4 py-2 sm:py-4 max-h-[68vh] sm:max-h-[70vh] overflow-y-auto overflow-x-hidden w-full max-w-full min-w-0 pr-1 sm:pr-2 custom-scrollbar">`.
    - **Prospect / Lead Quick Autofill (Create Mode)**: Minimal search combobox at the top showing company logo/avatar and business name only (`show business name & logo only`). Selecting automatically populates Client Name, Phone, Email, Service Category, Assigned Artist, and Account Agent with an active "✓ Autofilled from lead" indicator.
    - **Row 1**: Project Code & Project Name / Title (grid-cols-1 sm:grid-cols-2).
    - **Row 2**: Client / Company Name & Phone Number (grid-cols-1 sm:grid-cols-2).
    - **Row 3**: Client Email, Delivery Date (Calendar popover with `CalendarDays` icon), and interactive ERPAPP 5-star Priority Rating component (supporting half and full amber stars synced with High/Medium/Low priority).
    - **Row 4 & 5**: Service Category, Production Stage, Responsible Artist, and Account Agent selectors.
    - **Row 6**: Total Budget, Advance / Paid Amount, and Progress % inputs.
    - **ERPAPP Financial Summary Box**: Compact summary card (`p-3.5 sm:p-4 border rounded-md bg-muted/30 space-y-2`) displaying Total Budget, Advance / Paid Amount, production completion progress bar, and Remaining Due amount (highlighted in rose for positive due or emerald for zero balance).
    - **Footer**: `DialogFooter` (`pt-3 sm:pt-4 border-t flex flex-col-reverse sm:flex-row gap-2 sm:gap-0`) with Cancel (`variant="outline"`) and Brandium Growth Green submit button (`bg-[#67B239] hover:bg-[#5aa030] text-white`) featuring a `Loader2` spinning indicator during mutation saving.

- **ERPAPP Order Items Table Standard for Project Dialog (`Order Items *`)**:
  - In `src/app/(authenticated)/projects/page.tsx`, the single `Service Category` dropdown is transformed into an itemized *_"Order Items *"*_ table mirroring ERPAPP's `create-order-dialog.tsx`:
    - **Header**: Section label `Order Items *`.
    - **Table Columns**:
      - `Service *` (width ~45%): Dropdown populated with services from the database and creative models (`Select service...`).
      - `Quantity *` (width ~15%): Numeric input defaulting to `1`, minimum `1`.
      - `Charge *` (width ~20%): Number input for item unit charge / price (`placeholder="0"`).
      - `Total Price` (width ~15%, text-right): Real-time calculated line item total price (`৳${quantity * charge}`) or `N/A`.
      - Delete action button (width ~5%): Red `Trash2` button (`text-rose-500`) to remove item rows.
    - **Add Another Item**: `+ Add Another Item` button with `PlusCircle` icon.
    - **Auto-Sync Budget**: Entering item charges and quantities automatically calculates line totals and seamlessly syncs with `budget` if empty or 0.
    - **Persistence**: Order item collection is safely serialized and persisted into `project.notes` with `[Items: ...]` tag while syncing `orderItems[0].model` with `service_id` for backward database compatibility.
    - **Form Flow Simplification**: The redundant middle row containing `Production Stage`, `Responsible Artist`, and `Account Agent` dropdowns is removed from the dialog form per user request, flowing cleanly directly from the `Order Items *` table into the Financials Grid and Financial Summary box.

- **Projects Card Data Accuracy & Presentation Standardization**:
  - In `src/app/(authenticated)/projects/page.tsx`:
    - **Project Notes Priority & Prospect Fallback**: In Row 3 of each project card, strictly display the actual project notes (`cleanNotes`), stripping internal `[Items: ...]` JSON payloads and tag markers. When standalone project notes are empty or only contained serialized order items, fallback dynamically to the linked prospect's notes (`project.prospect_notes` joined in `projectsQuery`). Row 3 strictly displays clean project notes or a muted `"No project notes provided."` fallback, completely eliminating the redundant `Items: ...` fallback (since items are already summarized in the footer `{count} Item` badge and service subtitle).
    - **Currency & Budget Formatting**: Format project value with Bangladeshi Taka `৳` (`৳{formatProjectValue(project.budget)}`) without foreign `$` dollar signs or artificial leading zeros.
    - **Dynamic Stage Soft Badges**: Replace static solid green badges with dynamic soft color palettes via `getProjectStageBadgeStyle(stage_name)` (e.g. indigo for CR Clearance, sky blue for On Design, amber for CO Clearance, rose for On Hold, emerald for Delivered).
    - **Due Date Resilience**: When `deadline` is null, display `"Not set"` instead of legacy template default dates.
    - **Card Footer Real Data**: Replace dummy static metrics (`Total Hours : 100`, `WeChat : 02`, `Subtasks : 04`) with genuine project metrics: real production completion progress badge (`Progress : {progress}%`), dynamic outstanding due badge (`Due : ৳...`) or emerald `Paid` badge, and order items count badge (`{count} Items` with `ti ti-box` icon).
    - **Dynamic Client Logo**: Display client/prospect business logo in the 40px avatar via `project.prospect_logo_url` with dynamic fallback to creative geometric agency logos.

- **Payment History Table in Project / Order Dialog Standard**:
  - In `src/app/(authenticated)/projects/page.tsx` within `ProjectFormDialog`, render an interactive **Payment History** table directly above `Special Client Discount` and below `<Separator className="my-4" />` whenever `existingAdvancePayments.length > 0`:
    - Displays `Date`, `Amount` (formatted BDT currency), `Method` (badge), `Reference/Notes`, and `Actions`.
    - Double-click or click `Pencil` allows inline editing of amount, payment method dropdown, and notes with `Check` and `X` action buttons.
    - `Trash2` action button allows removing individual payment records with instant recalculation of total advance paid and amount due in Order Summary.
    - When existing payments exist, the advance payment input label dynamically switches to `"New Advance Payment"`, and entering a new payment seamlessly appends to the payment collection upon saving.
    - Automatically parses payment history from `project.notes` (`[Payments: [...]]`) with graceful fallback to single legacy advance payment (`project.paid_amount`) and cleans technical tags from the user's notes field.

- **Exact Optional Property Types Compatibility (TS2379 & sonner toast)**:
  - In interfaces like `ExistingPaymentRecord` or `AdvancePaymentRecord`, always declare optional properties as `field?: type | undefined` to satisfy `exactOptionalPropertyTypes: true`.
  - When importing `toast` from `sonner`, ensure it is only imported once per file to avoid TS2300 duplicate identifier errors.

- **Native Multi-Installment Advance Payment Persistence (`projects.advance_payments` JSON Column)**:
  - Table `projects` in MySQL stores multi-installment advance payments directly in dedicated column `advance_payments LONGTEXT NULL`.
  - Schema bootstrapping in `src/lib/auth.functions.ts` automatically provisions and maintains `{ table: "projects", column: "advance_payments", def: "LONGTEXT NULL" }`.
  - TypeScript interface `AdvancePaymentRecord` in `src/lib/projects.ts` standardizes payment installments across the application:
    `{ id: string; amount: number; date: string; paymentMethod: string; notes?: string | null | undefined; recordedByUserId?: string | null | undefined; recordedByUserName?: string | null | undefined; documentUrl?: string | null | undefined; status?: "Pending" | "Approved" | "Declined" | undefined; }`.
  - In `projectsQuery` and `/projects/[invoiceid]/page.tsx`, queries select `prj.advance_payments` directly with layered fallback parsing: first `project.advance_payments`, second `[Payments: [...]]` tag in `notes`, and third single legacy `paid_amount`.
  - In `useSaveProjectMutation`, mutations persist `advance_payments: payload.advance_payments ? JSON.stringify(payload.advance_payments) : null` in both `UPDATE` and `INSERT` SQL statements, while syncing the total sum into `paid_amount`.
  - In `ProjectFormDialog`, `parseProjectPayments` loads existing installments into the interactive editable Payment History table, and `handleSubmit` adds new payments and updates `advance_payments` seamlessly.

- **ERPAPP 100% Identical Payment Section & Order Summary Standard**:
  - In `src/app/(authenticated)/projects/page.tsx` within `ProjectFormDialog`, the payment and order summary section strictly matches ERPAPP's `edit-order-dialog.tsx` (lines 970-1219):
    - **Separator**: Clean horizontal separator `<Separator className="my-4" />`.
    - **Row 1 - Discounts & Shipping**: Grid `grid grid-cols-1 md:grid-cols-2 gap-4`:
      - Left: `Special Client Discount` input with `Percent` icon inside (`pl-7`).
      - Right: `Shipping Charge` numeric input (`min="0" step="0.01" placeholder="0"`).
    - **Row 2 - Payment History Table** (renders when `existingAdvancePayments.length > 0`):
      - Header: `<ReceiptText className="mr-2 h-5 w-5 text-primary/80" />Payment History`.
      - Styled table (`border rounded-md overflow-hidden bg-background`):
        - Column widths: `Date` (w-[180px]), `Amount` (w-[140px]), `Method`, `Reference/Notes`, and `Actions` (w-[90px] text-right).
        - Date rendered via `formatDateForDialogInput(p.date)` using `format(date, "PPP")` (e.g. "Sep 15th, 2026").
        - Amount rendered via `formatCurrencyBdt(p.amount)`.
        - Method and Notes rendered as plain text (no badges).
        - Inline editing on double click or pencil click with focused amount input (`amountInputRef`), select dropdown for payment method, input for reference/notes, and green check (`Check`) / muted cancel (`X`) buttons.
        - Delete trash button (`group-hover:opacity-100`) sets `paymentToDelete` triggering the ERPAPP `AlertDialog` confirmation ("This action will permanently delete the payment of {amount} made on {date}.").
    - **Row 3 - Adjustment / Advance Payment Input** (`mt-4 border-t border-border pt-4`):
      - Label: `{existingAdvancePayments.length > 0 ? "Adjustment Payment" : "Advance Payment"}`.
      - Input: `Amount (BDT)` with step 0.01.
      - When an amount is entered (`isAdvancePaymentEntered`):
        - `Payment Method *` with search combobox popover (`Popover`, `Command`, `CommandInput`, `CommandList`, `Check`, `ChevronsUpDown`).
        - "Specify Other Method *" input when "Other" is selected.
        - `Reference/Notes *` input (`placeholder="Reference or Transaction ID"`).
    - **Row 4 - Order Summary Box** (`p-4 border rounded-md bg-muted/40 space-y-2 mt-4`):
      - `Order Items Total:`, `Gift Value:` (when any), `Discount:` (`- BDT ...` in text-destructive), `Net Payable:`, `Shipping Charge:` (`+ BDT ...`), `Total Paid:` (`- BDT ...` with top dashed border in text-green-600), and `Amount Due:` (`BDT ...` in text-base font-bold text-primary).
- **Persistent Payment History Section & Eager State Initialization Standard**:
  - In both `ProjectFormDialog` (Edit Order Dialog) and `ProjectDetailModal` (View Details Modal), Payment History is always rendered in the UI with a persistent header and counter (`Payment History (n)`).
  - When no advance payments exist yet, it displays a friendly dashed placeholder (`No payment history recorded yet. Add an advance payment below.`) instead of hiding the entire section.
  - All modal payment states (`existingAdvancePayments`, `totalExistingAdvancePaid`, `specialClientDiscount`, `shippingCharge`, `orderNotes`) are eagerly initialized directly from `project` props via lazy `useState` callbacks, combined with dynamic `key` remounting on the dialog container to guarantee 0ms instant display without depending on asynchronous `useEffect` re-render cycles.
  - In `parseProjectPayments`, supports both parsed array, raw JSON string (`typeof advancePayments === "string"`), multiple legacy note tags (`[Payment: Method, Ref: Ref]`), and legacy `paid_amount` fallbacks.

- **Order Notes Payment Tag Sanitization & Redundant Injection Prevention**:
  - Technical payment tags (`[Payment: ...]`, `[Payments: ...]`) must NEVER be injected into the `Order Notes (Optional)` textarea or saved into the `notes` column, as all installment payments are natively stored in the dedicated MySQL column `projects.advance_payments`.
  - In `handleSubmit` in `src/app/(authenticated)/projects/page.tsx`, `notesPayload` must only combine cleaned order notes (`cleanProjectNotes(orderNotes)`), `[Discount: ...]`, `[Shipping: ...]`, and `[Items: ...]`, completely omitting any `[Payment: ...]` or `[Payments: ...]` injection.
  - In `cleanProjectNotes`, use `[Payments?:\s*\[[\s\S]*?\]\]` and `[Payments?:\s*[^\]]+\]` with `gis` flags to sanitize any legacy tags from existing database records, ensuring the user's notes textarea displays only clean, human-readable creative instructions.

- **Over-Amount Detection & Toast-Only Notification Standard**:
  - In `ProjectFormDialog` (both Create and Edit Order dialogs in `src/app/(authenticated)/projects/page.tsx`), total payments (`totalAdvanceAfterNew = totalExistingAdvancePaid + newAdvanceAmount`) must never exceed the order's grand total (`netPayable + shippingCharge`).
  - **Clean Dialog UI (No Intrusive Inline Red Clutter)**:
    - Never render inline red warning badges, red text paragraphs, or red borders inside the dialog form or Order Summary (`Total Paid` remains cleanly formatted in standard green text).
  - **Toast-Driven Warning Feedback**:
    - When an over-amount occurs (`isAdvPaymentOver`), trigger an informative Sonner toast alert (`toast.error("Advance Payment Limit Exceeded", { id: "advance-over-amount", description: ... })`) detailing the exact overpaid difference and grand total.
    - Automatically dismiss the toast via `toast.dismiss("advance-over-amount")` as soon as the amount is corrected or when the dialog closes.
    - On blur of the advance payment input or when attempting to save with an over-amount, block submission in `handleSubmit` and show the over-amount error toast immediately.
    - Also enforce boundary validation for `Special Client Discount` (cannot exceed `orderItemsTotal`) and inline payment edits in the Payment History table via Sonner toast alerts.

- **Project Form Order Items Service Resolution Standard**:
  - In `ProjectFormDialog` (`src/app/(authenticated)/projects/page.tsx`), the `Service *` selector inside `Order Items *` must strictly display and select real Brandium CRM services (`TVC`, `Graphics Design`, `Product Photography`, `Logo Design`, `Video Ads`, etc.) from the `services` table.
  - Never populate `modelOptions` with hardcoded print-shop models (such as `"Design Charge"`, `"Menu Book"`, or `"Pizza Box"`).
  - When editing a project, dynamically resolve its actual service from `project.service_name`, linked prospect (`prospect_id`), or system `services` map, automatically sanitizing any legacy dummy items so the combobox immediately shows the client's genuine service (e.g. `TVC` for `color hut`).
  - In `projectsQuery` (`src/lib/projects.ts`), join `services` on both `(prj.service_id = srv.id OR prj.service_id = srv.name)` and fallback to `p.service_id` to guarantee `service_name` is always accurately populated across views.

- **Project Card Direct Navigation & Detail Modal Removal Standard**:
  - In `src/app/(authenticated)/projects/page.tsx`, removed the legacy redundant `ProjectDetailModal` popup.
  - Clicking a project card, project title, or selecting "View Details" from the 3-dot dropdown now navigates directly to the dedicated full project & invoice page (`/projects/${project.project_code || project.id}`) via Next.js `useRouter`.
  - Eliminates intermediate popups, close button badge overlaps, and provides a seamless fullscreen project overview.

- **Next.js Dev Server `.next` Cache Invalidation During Concurrent Production Build (`ENOENT: routes-manifest.json`)**:
  - Running `npm run build` (`next build`) while a Next.js development server (`next dev`) is concurrently active in the background overwrites and deletes dev cache manifests (`.next/routes-manifest.json` and in-memory Webpack chunks like `./[chunkId].js`), causing the running dev server to return `500 Internal Server Error` on subsequent HTTP requests.
  - **Prevention / Resolution**: Always restart the background dev server process after running a production build or avoid running concurrent `next build` commands against the same `.next` directory to keep hot module replacement (HMR) and route manifests intact.

- **Project Invoice Status Header Card Standard (`/projects/[invoiceid]`)**:
  - In `src/app/(authenticated)/projects/[invoiceid]/page.tsx`, embedded the ERPAPP Status Header Card matching the user's HTML specification directly above the main invoice card.
  - Features the circular SVG Lottie status icon, dynamic stage color badge (using `resolveProjectStageColor(project.status)`), and relative update timestamp (`Last status update: {formatRelativeTime(project.updated_at || project.created_at)} by {creator_name}`).
  - Formatted with `print:hidden` so it renders seamlessly on screen while keeping invoice printouts and PDF downloads 100% clean.
  - Aligned table `prospects` address column to `p.address` (avoiding invalid `p.location`).

- **Project Order Status History Timeline Section Standard (`/projects/[invoiceid]`)**:
  - In `src/app/(authenticated)/projects/[invoiceid]/page.tsx`, implemented the authentic ERPAPP Status History card section (`text-card-foreground shadow-2xl border border-border/40 bg-card hover:shadow-primary/10 rounded-xl`) placed below the invoice card with `print:hidden`.
  - Displays the timeline of order progress with dynamic left border line (`border-l-2 border-zinc-400 dark:border-zinc-600`), circular status icons with contrasting badge backgrounds and rings, stage titles, formatted dates, changer names, and update notes.
  - Supports proof image detection with inline "View Proof Image" action button and image preview modal dialog.
  - Backed by local MySQL `prospect_stage_history` queries joined with `stages`, `profiles`, and `users` with fallback demo entries ensuring resilient display.

- **Project Real Status History Database Persistence & Elimination of Fake Future Stages**:
  - In `brandium_crm` MySQL database, table `projects` contains `status_history LONGTEXT NULL` storing serialized JSON entries for each stage advancement (`id`, `status`, `timestamp`, `changedByUserName`, `notes`, `proofUrl`).
  - In `src/app/(authenticated)/projects/[invoiceid]/page.tsx`, `statusHistoryList` dynamically prioritizes `project.status_history`, followed by `prospect_stage_history`, and falls back to `buildRealProjectHistory(project)` which dynamically slices the chronological stages up to `project.status`. This completely eliminates hardcoded dummy stages (e.g., showing `Logistics` or `Delivered` on projects that are only at `CO Clearance` or `On Design`).
  - In `src/lib/projects.ts`, `useUpdateProjectStatusMutation` appends a new chronological entry to `projects.status_history` on every stage mutation, and invalidates both `crm-projects-with-stages` and `project-invoice-details` query caches.

- **Brandium Invoice Background Letterhead Integration Standard (`brandium_invoice_bg.jpg`)**:
  - In `src/app/(authenticated)/projects/[invoiceid]/page.tsx`, the primary invoice card container (`.invoice-page`) renders the official `public/brandium_invoice_bg.jpg` letterhead background using `backgroundImage: "url('/brandium_invoice_bg.jpg')"`, `backgroundSize: "100% 100%"`, `backgroundRepeat: "no-repeat"`, and `backgroundPosition: "center top"`.
  - Includes a dark theme overlay (`hidden dark:block absolute inset-0 bg-slate-950/80 pointer-events-none print:hidden`) and `relative z-10` content wrapper, preserving pristine contrast and readability in both dark and light modes.
  - Table containers use `bg-background/85 backdrop-blur-xs` allowing the branding curves and textures to shine through gracefully.
  - Configured `@media print { .invoice-page { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }` in `src/styles.css` and removed `print:bg-transparent` so paper prints and PDF exports retain the full-resolution letterhead background.

- **Tailwind CSS v4 Utility Class Optimization & Formatting Standards**:
  - Replace arbitrary bracket sizing like `h-[30px]` with standard Tailwind scale `h-7.5` (4px basis).
  - Replace arbitrary margin brackets like `ml-[44px]` and `sm:ml-[56px]` with `ml-11` and `sm:ml-14`.
  - Replace arbitrary rem positions like `-left-[2.25rem]` and `sm:-left-[2.625rem]` with standard fractional/integer utilities `-left-9` and `sm:-left-10.5`.
  - Replace CSS transform degree brackets like `-rotate-[20deg]` with `rotate-[-20deg]`.
  - Prefer standard utility `shrink-0` instead of legacy `flex-shrink-0`.
- **runMySQLQuery API Response Unpacking Standard**:
  - In `src/lib/mysql-api.ts`, `runMySQLQuery<T>()` returns `{ success: boolean; data?: T; error?: string }` (modeled as an API response wrapper). Always unpack query rows via `const res = await runMySQLQuery<Record<string, unknown>[]>(sql, params); const rows = (res.data || []) as Record<string, unknown>[];` rather than assuming `runMySQLQuery` returns a bare array directly.

- **Qualified Leads, Follow Up, and Expenses Architecture Standard**:
  - **Qualified Leads** (`/qualified-leads`): Fetches vetted prospects where `is_qualified = 1` or stage contains `qualif`, `opportunity`, or `meeting`. Features KPI cards, dynamic contact cards with Golos Text, communication shortcuts, and fast qualification toggle.
  - **Follow Up** (`/follow-up`): Unifies `/follow-up` and `/follow-ups` routes so both singular and plural endpoints resolve cleanly.
  - **Expenses** (`/expenses`): Backed by MySQL table `expenses` with schema bootstrapping in `ensureMySQLTablesExist()`, KPI spend metrics (monthly, all-time, transaction count, top category), and full Add/Edit/Delete lifecycle with Radix Alert confirmation.
- **Fixed A4 Invoice Sizing & Print Layout Standard**:
  - In `src/app/(authenticated)/projects/[invoiceid]/page.tsx` and `src/styles.css`, invoice cards utilizing full-bleed A4 letterhead backgrounds (such as `/brandium_invoice_bg.jpg`) must have fixed A4 dimensions (`width: 210mm; min-height: 297mm; max-width: 210mm;`).
  - Wrap the invoice card in `<div className="w-full overflow-x-auto py-2 sm:py-4 flex justify-center print:p-0 print:overflow-visible print:block">` to ensure horizontal scrollability and perfect aspect ratio preservation across smaller mobile screens without clipping or stretching.
  - Set specific letterhead clearances: top padding `pt-[38mm]` to protect the header logo and artwork banner, and bottom padding `pb-[30mm]` to keep invoice totals and signatures above the footer contact details.
  - Structure inner content with `flex-1 flex flex-col justify-between` so that the bottom financial summary box anchors professionally toward the base of the A4 sheet.
  - In `@media print`, enforce `@page { size: A4 portrait; margin: 0; }` with `html, body { width: 210mm !important; height: 297mm !important; margin: 0 !important; }` and `.invoice-page { width: 210mm !important; height: 297mm !important; page-break-inside: avoid !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }` for pixel-perfect PDF export and printer output.
- **Project Invoice Page Real Data Query & Multi-Layer Identifier Fallback (`/projects/[invoiceid]`)**:
  - In `src/app/(authenticated)/projects/[invoiceid]/page.tsx`, `queryFn` executes a 3-tier database lookup directly against MySQL database `brandium_crm`:
    1. Direct match on `prj.project_code = ? OR prj.id = ? OR prj.prospect_id = ? OR prj.project_code = CONCAT('PRJ-', ?) OR REPLACE(prj.project_code, 'PRJ-', '') = ? OR prj.project_code LIKE CONCAT('%', ?, '%')` joined with `prospects`, `services`, `users`, and `profiles`.
    2. Prospect table match if the parameter corresponds to an existing prospect without a dedicated `projects` row yet (`p.id = ? OR p.phone = ? OR p.email = ?`).
    3. Automatic fallback to the latest active project from table `projects` (`ORDER BY prj.updated_at DESC, prj.created_at DESC LIMIT 1`), guaranteeing authentic database records render even when visiting demo or placeholder URLs (such as `/projects/12145` or `/projects/id`).
  - Strict TypeScript interface `ProjectRecord` ensures all project attributes (`prospect_id`, `advance_payments`, `updated_at`, `status_history`) are strongly typed without `Record<string, unknown>` property errors.
  - In `prospect_stage_history` queries, select `psh.note AS note` (aligning with the single `note` column in table schema) rather than `COALESCE(psh.note, psh.notes)`.
- **Order Items Table Unit Price Input & Real-Time Calculation Standard (`ProjectFormDialog`)**:
  - In `src/app/(authenticated)/projects/page.tsx`, the `Order Items *` table in `ProjectFormDialog` must include an explicit **Unit Price \*** input column between `Quantity *` and `Total Price`:
    - Columns: `Service *` (w-[45%]), `Quantity *` (w-[15%]), `Unit Price *` (w-[18%]), `Total Price` (w-[18%]), and Delete action (w-[4%]).
    - Input: `<Input id={`unitPrice-${item.id}`} type="number" min="0" step="0.01" placeholder="0" required ... />` bound to `item.unitPrice`.
    - In `handleItemChange`, handle `field === "unitPrice"` by updating `updatedItem.unitPrice` and immediately re-calculating `updatedItem.lineItemTotalPrice = quantity * unitPrice`.
- **Node.js Heap Memory Allocation & Next.js OOM Prevention (`--max-old-space-size=4096`)**:
  - When compiling extensive Next.js App Router route modules in development mode on Windows, Node.js can exceed default 32-bit/64-bit semi-space heap limits (~800MB - 1.4GB) and trigger `RangeError: Failed to allocate memory` or `FATAL ERROR: Committing semi space failed. Allocation failed - JavaScript heap out of memory`.
  - Always allocate at least 4GB (4096MB) heap space in `package.json` scripts (`"dev": "node --max-old-space-size=4096 ./node_modules/next/dist/bin/next dev"` and `"build": "node --max-old-space-size=4096 ./node_modules/next/dist/bin/next build"`) to ensure seamless compilation across all dynamic route chunks without crashes.

- **Prospects 7-Card Pipeline Summary Cards Standard**:
  - In `src/app/(authenticated)/prospects/page.tsx` and `src/lib/prospects.ts`, summary cards represent the 7 core pipeline stages displayed in a responsive grid (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7`):
    1. **All**: `stats.data?.totalProspects`, purple scheme (`pastelPurple`), resets stage and text filters when clicked.
    2. **Prospect**: `stats.data?.prospectCount`, sky blue scheme (`pastelBlue`), filters to prospect/new lead stage when clicked.
    3. **Qualified**: `stats.data?.qualifiedLeads`, teal scheme (`pastelTeal`), filters to qualified leads when clicked.
    4. **Follow-Up**: `stats.data?.followUps`, amber scheme (`pastelYellow`), filters to follow-up stage when clicked.
    5. **Meeting**: `stats.data?.meetingCount`, indigo scheme (`pastelIndigo`), filters to meeting stage when clicked.
    6. **Won**: `stats.data?.salesWon`, emerald scheme (`pastelEmerald`), filters to sales won stage when clicked.
    7. **Lost/DNP**: `stats.data?.lostDnpCount`, peach scheme (`pastelPeach`), filters to lost, DNP, or unreachable stages when clicked.
  - The local `StatCard` preserves the exact visual aesthetic: circular 36-44px icon container, bold number count, label, hint subtext, faint rotated watermark icon in the bottom right, and smooth hover elevation (`hover:scale-[1.02]`).

- **Phantom Git Submodule Resolution & Agent Skill Integration**:
  - When a skill folder (e.g. `.agents/skills/ui-ux-pro-max`) was previously added as an unmapped gitlink (mode `160000`) without `.gitmodules`, git commands fail with `fatal: no submodule mapping found in .gitmodules for path '...'` or `fatal: Pathspec '...' is in submodule`.
  - Always clear the stale cached gitlink using `git rm --cached <path>` and add the files directly with `git add <path>` so the skill files and data tables (`data/`, `scripts/`, `references/`) are tracked cleanly as native workspace files.
  - Exclude Python bytecode (`__pycache__/`, `*.pyc`) in `.gitignore` to prevent generated execution artifacts from cluttering the working tree.
- **Prospects Page Dual View (Grid / Table), Dynamic Sorting & Export Standards**:
  - In `src/app/(authenticated)/prospects/page.tsx` and `src/lib/prospects.ts`, the prospects pipeline supports dual layout modes:
    - **Grid View**: Visually rich Dreamstechnologies card layout featuring avatars, torn paper notes, communication buttons, stage badges, and creator attribution.
    - **Table View**: High-density scanning table using Radix `<Table>` with contact details, business, phone/email links, service badge, stage badge with color dot, 1-click qualification status toggle, creator attribution, date, and 3-dot dropdown actions.
  - **Dynamic Sorting**: `sortBy` parameter supports `newest` (`created_at DESC`), `oldest` (`created_at ASC`), `name_asc` (`contact_name ASC`), `name_desc` (`contact_name DESC`), and `updated` (`updated_at DESC`).
  - **Service Filter & Dark Mode**: Service select filter connects directly to active database services (`servicesQueryOptions`). All input and select elements enforce clean dark mode backgrounds (`dark:bg-slate-900 dark:border-slate-800`).
  - **Actionable Empty State**: Per UI/UX Pro Max guidelines, empty states render a centered SearchX icon, clear explanation, a "Reset All Filters" action button, and a primary "Add Prospect" action button.
  - **1-Click Qualification**: Both card and table views provide a 1-click toggle to mark/unmark prospects as Qualified (`is_qualified = 1`), with soft emerald badges (`Star` icon) and instant cache invalidation for `prospects`, `prospects-stats`, and `qualified-leads`.
- **Stage History Unlimited Note Array & Footer Note Input Standard**:
  - In `src/components/view-stage-dialog.tsx` and `src/lib/stages.ts`, the stage activity timeline supports unlimited notes per stage:
    - **Footer Note Input Bar**: Embedded at the bottom of the dialog spanning the left side with a fast `<Input>` and purple "Add" / "Send" button (supports Enter key submission).
    - **Targeted Stage Notes**: By default, notes attach to the active/latest stage, or users can click the `+` icon on any specific timeline stage card to target that stage directly.
    - **Multiple Notes Array with Date, Time & Author**: Notes are parsed via `parseNotesToItems()` as structured `StageNoteItem` objects (`text`, `createdAt`, `createdByName`, `createdByAvatar`). Each note displays its creation date and time (`MM-dd h:mm a`) along with author attribution (`by Name`) directly below the note text.
    - **Note Removal**: Hovering over any note item reveals a subtle delete `X` button with an `AlertDialog` confirmation, enabling complete CRUD control over individual notes in the array.
    - **Database Sync & Timestamp Preservation**: Functions `addStageNote` and `deleteStageNote` persist updates directly to `prospect_stage_history.note` and sync with `prospects.notes` in MySQL. When notes are appended or modified, original stage transition `changed_at` timestamps and existing note `createdAt` timestamps are strictly preserved without being overwritten.

- **Follow-up Tasks Page Architecture & Management Standard**:
  - On `/follow-ups` (`src/app/(authenticated)/follow-ups/page.tsx`), follow-up tasks and client reminder calls are presented with Brandium CRM's premium design system:
    - **Top KPI Cards**: 5 pastel summary cards (Total Tasks, Pending Calls, Completed, Overdue, Cancelled) driven by `followUpSummaryQuery`.
    - **Dual Layout**: Seamless toggle between Cards Grid view (with prospect avatar, business, clickable phone, due datetime, "Chira Kagoj" torn paper note, and quick action buttons) and Table view (high-density scanning with Radix `<Table>`).
    - **Live Filters & Search**: Real-time filtering by text search, status dropdown (`pending`, `overdue`, `completed`, `cancelled`), agent selector, and single due date picker popover.
    - **Modal Integration**: Complete support for `FollowUpDialog` (scheduling new follow-ups) and `FollowUpDetailModal` (inspecting prospect timeline, making calls, updating status, and chaining next follow-ups).

- **Quotations Module Architecture (`/quotations` & `/quotations/[quotationid]`)**:
  - Cloned from `/projects` and `/projects/[invoiceid]`. Data lives in MySQL table `quotations` (code column `quotation_code`, prefix `QT-`) with team assignments in `quotation_assignees` (`quotation_id`), managed by `src/lib/quotations.ts` (query key `crm-quotations-with-stages`, detail key `quotation-details`).
  - Quotation workflow stages are `Draft`, `Sent`, `Under Review`, `Negotiation`, `Revised`, `Accepted` (won), and `Rejected` (lost) via `QUOTATION_WORKFLOW_STAGES` and `resolveQuotationStageColor`. The `deadline` column is shown as **Valid Until**.
  - **ERPAPP UI/UX clone** (`C:\Transfer\Running Projects\erpapp` `/quotation` & `/quotation/[quotationId]`): `/quotations` is a "Quotation Management" page with an "All Quotations" table card (Quotation ID, Contact Person, Company, solid-color Status badge, CRM Contact, Date Created, Actions dropdown with Edit / colored Change Status submenu / View-Print / Delete) and 25-per-page pagination. The detail sheet (on the Brandium letterhead) uses ERPAPP's header (placed-by line, `Quotation #`, date, CODE128 barcode), gray Bill To and CR Manager/Assigned Designer boxes, and Approved (`Accepted`), Cancelled (`Rejected`) or Paid stamps (`public/approved-stamp.png`, `public/cancelled-stamp.png`, `public/paid-stamp.png`).
  - **Create / Edit Quotation dialogs** are ERPAPP clones in `src/components/quotations/create-quotation-dialog.tsx` and `edit-quotation-dialog.tsx`, sharing `quotation-dialog-shared.tsx` (items table, payment method combobox, notes/items/discount/payment parsers). Field mapping: Contact Person → `client_name`, Company Name → `title`, Address → `client_address`, Quotation Date / Date Created → `order_date` + `created_at`, items + discount → `[Items: ...]` / `[Discount: ...]` tags in `notes`, payments → `advance_payments` (sum in `paid_amount`), Net Payable → `budget`. ERPAPP's Model/Lamination columns become Brandium `Service *` (from `services`) and a manual `Unit Price *` input. Mount `EditQuotationDialog` with a `key` so its lazy state initialises per quotation; payment inline-edit is admin-only (`useAuth().isAdmin`).
  - Pass MySQL `DATETIME` values as `yyyy-MM-dd HH:mm:ss` (`toMySQLDateTime`), never raw ISO strings with `T`/`Z`.
  - The 7-point **Terms & Conditions** (`QUOTATION_TERMS`) render in the ERPAPP torn-paper card `TornPaperTerms` (`src/components/quotations/torn-paper-terms.tsx`) beside the totals, above the footer. Unlike projects, the quotation detail page has **no Status History timeline card**, and quotation cards have **no team assignee avatars or "Assign Team" button** (only the creator avatar, right-aligned), both removed per user request.
  - The quotation detail page always renders the **Quotation Notes** box: cleaned `quotations.notes` (technical `[Items/Payments/Payment/Discount/Shipping/Artist/Agent]` tags stripped), falling back to the linked prospect's notes, else a muted `No notes provided.` placeholder that is `print:hidden`.
  - The detail page reuses the A4 letterhead (`brandium_invoice_bg.jpg`) and the `invoice-page` print class, so never rename those while refactoring the quotation copy.

- **Orders Module Architecture (`/orders` & `/track/[id]`, ERPAPP clone)**:
  - Reuses the pre-existing MySQL table `orders` (legacy rows keep `order_number`, `company_name`, `items_json`, `payments_json`, `status_history`); new columns `job_id`, `shipping_charge`, etc. are added through the column-migration list, and comments live in `order_comments` (`parent_id` for replies). Data layer: `src/lib/orders.ts` (query keys `crm-orders`, `order-detail`, `order-comments`).
  - Statuses follow the Brandium production workflow in `ORDER_STATUSES`: Order Submitted → Script Writer* → Content Planner* → Videographer* → Video Graphy Complete → Video Editor* → Marketer* → Developer* → Delivered (`*` = `assignable: true`). Choosing an assignable stage (Change Status or "Re-assign {stage}") opens `AssignStageDialog` (`src/components/orders/assign-stage-dialog.tsx`, any active user) and `useAssignStageMutation` stores the assignee in `designer_id` (shown as "Assigned To"); non-assignable stages change directly. Every change appends to `status_history`. `resolveOrderStatus()` still displays legacy values (`ready-for-design`, `Submitted`, `In Progress`).
  - Dialogs: `src/components/orders/create-order-dialog.tsx`, `edit-order-dialog.tsx`, `assign-stage-dialog.tsx`, sharing `src/components/sales/line-items-dialog-shared.tsx` with the quotation dialogs. `/track/[id]` is login-only (inside `(authenticated)`) and clones ERPAPP's core track sections: status header (`StatusInfoIcon`), invoice card with barcode, Bill To / CR Manager boxes, items, notes, payments, `TornPaperTerms terms={BRANDIUM_TERMS}` with totals and Paid stamp, status history, and comments with replies. Approvals, client payment-proof upload and Packzy courier status are intentionally not ported.
  - `/orders` has no Orders / Reorders / Pending Payment tabs (removed per user request). Its date filter is the ERPAPP clone `DateRangePicker3` (`src/components/dashboard/date-range-picker3.tsx`): presets All Time → Last Year plus a Custom Range submenu with a two-month calendar and Apply; it defaults to This Month and search ignores the date range.
  - Legacy `payments_json` entries use `createdAt` instead of `date`; `mapOrderRow` normalises this.
  - Next.js App Router `page.tsx` files may only export the page and route config; put shared helpers (e.g. `getContrastTextColor`) in `src/lib/*`.
  - Reply textareas prefilled with an `@mention` must move the caret to the end (`setSelectionRange(value.length, value.length)`) after focusing, or typed text lands before the mention.

- **Projects Kanban (`/projects`, ERPAPP clone)**: `/projects` is now the ERPAPP Kanban board (`src/components/projects/projects-kanban-board.tsx`, `kanban-column.tsx`, `project-card.tsx`). Cards are orders (not the `projects` table), columns are `ORDER_STATUSES`, legacy statuses land in Order Submitted. Drag-and-drop uses native HTML5 events (no `@dnd-kit`); dropping on an assignable stage opens `AssignStageDialog`. Cards show target date + stage SLA bar (delivery date split evenly across stages, else 48h per stage). The old card-grid page is only in git history; `/projects/[invoiceid]` is unchanged.
- **Unicode escapes in generated code**: the Write/Edit tools and `sed` turn `﻿` into the raw character (ESLint `no-irregular-whitespace`); use `String.fromCharCode(0xfeff)` instead.
- **JsBarcode on Async-Loaded Pages (barcode never renders)**:
  - When the barcode `<svg ref>` only mounts after a query finishes loading, an effect keyed only on the code string runs while the svg is absent and never reruns (the code, taken from the URL param, does not change). Include the loading flag in the effect deps (`[codeToRender, isLoading]`).

- **Theme `secondary` Token Is Brand Green**:
  - In Brandium, `bg-secondary` resolves to green. When porting ERPAPP markup that expects a gray `bg-secondary/40`, use neutral `bg-slate-100/80 dark:bg-slate-800/60` instead.

- **Pre-Existing Table Schema Drift (`CREATE TABLE IF NOT EXISTS` skipped)**:
  - If a table with the same name already exists (e.g. a legacy `quotations` table with `grand_total`/`items`), `CREATE TABLE IF NOT EXISTS` silently does nothing and new columns are missing. Always also register every required column in the `ALTER TABLE` column-migration list in `ensureMySQLTablesExist()` so older tables are upgraded.

- **Self-Healing Migration Alias-Qualified Column Bug (`prj.column`)**:
  - MySQL reports unknown columns with their alias (`Unknown column 'prj.assigned_artist_id'`). `executeMySQLQueryFn` previously created a column literally named `prj.assigned_artist_id`. `resolveMissingColumnTarget()` in `src/lib/crm.functions.ts` now splits `alias.column`, maps the alias back to its table via `FROM/JOIN <table> [AS] <alias>`, and skips auto-migration when the alias cannot be resolved.

- **Track Page Invoice Layout Alignment to Quotation Format (`/track/[id]`)**:
  - The order tracking page (`src/app/(authenticated)/track/[id]/page.tsx`) now uses the identical A4 fixed-dimension invoice layout (210mm × 297mm) and styling as the quotation detail page (`/quotations/[quotationid]/page.tsx`).
  - Invoice structure: Status Header Card (top, `print:hidden`) → Brandium letterhead (`brandium_invoice_bg.jpg`) → Bill To box (left) + Order Meta (right) → Order Items table (Quantity, Unit Price, Total Price columns) → Notes/Payments History (scrollable sections) → Terms & Conditions (left) + Financial Summary (right in flex row) → Status History card (print:hidden) → Comments card (print:hidden).
  - Bottom flex layout uses `flex flex-col sm:flex-row justify-between gap-6` with Terms in `sm:max-w-[55%]` left and Financial Summary in `sm:max-w-sm` right; responsive stacks vertically on mobile.
  - Letterhead background rendered via `backgroundImage: "url('/brandium_invoice_bg.jpg')"` with dark overlay on dark mode (`hidden dark:block absolute inset-0 bg-slate-950/80 pointer-events-none print:hidden`).
  - All relative sizing uses Tailwind `2.5px` basis (`size-X` for width/height, `h-7.5` = 30px, etc.) and avoids arbitrary brackets except for CSS variables or cross-browser incompatible sizes; standard utilities preferred.
  - Print stylesheet enforces exact A4 (210mm × 297mm) with `@media print { ... -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }` to preserve letterhead during PDF export without color stripping.

## Agent skills

### Issue tracker

Issues are tracked using local Markdown files under `.scratch/` and GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout with root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

- **SMS Gateway (MRAM Technologies) Server-Side Integration (`/admin/sms-gateway`)**:
  - Gateway config lives in the single-row MySQL table `sms_gateway_settings` (`id = 'default'`): `api_url`, `balance_url` (with `{API_KEY}` placeholder), `api_key`, `sender_id`, `label`, `is_enabled`.
  - All provider calls run on the server in `src/lib/sms-gateway-server.ts` via Route Handlers `/api/sms/gateway` (GET masked settings / PUT save), `/api/sms/balance` and `/api/sms/send`. Never send the API key to the browser: GET returns only `has_api_key` and `api_key_masked`, and a blank `api_key` on PUT keeps the saved key.
  - `sendSms()` in `src/lib/sms.ts` and `sendMeetingReminderSms()` in `src/lib/meetings.ts` must call `/api/sms/send` and throw when the gateway rejects the message; never mark an SMS as sent without a real gateway call.
  - Phones are normalised to `8801XXXXXXXXX` (`normalizeBdPhone`); `type` is `unicode` automatically for Bangla text.
  - SMS attempts are logged by the server in MySQL table `sms_logs` (phone, full message, `Sent`/`Failed`, `provider_response`, `sent_by`) inside `/api/sms/send`; `/sms/logs` (`src/app/(authenticated)/sms/logs/page.tsx`) reads that table. Never rebuild SMS logs from `activities`, which has no phone number or full message.

- **Routes Lost in the TanStack → Next.js Migration**:
  - `src/routes/_authenticated/sms.logs.tsx` was deleted in commit `5de6e7d` without a Next.js port, so the sidebar link returned 404. When a nav link 404s, check `git log --all -- src/routes/` for the old route and port it to `src/app/(authenticated)/...`.

- **Stage Group Values (`stages.stage_group`)**:
  - Valid groups are `new`, `in_progress`, `won`, `lost`, `denied` (seeded in `ensureMySQLTablesExist()` and read by `src/lib/dashboard.ts`). The Stage Management form previously saved `progress` and defaulted to `prospect`, so new stages dropped out of the dashboard's In Progress group and the Group select rendered blank. Always use these exact values in forms and badges.

- **Python Edit Scripts on Windows Write CRLF**:
  - `open(p, "w")` in text mode on Windows converts `\n` to `\r\n`, and ESLint then reports `Delete ␍` (prettier) on every line. Open files with `newline=""` or run `npx eslint --fix <file>` after scripted edits.

- **Data Backup Covers Every Table Except Secrets**:
  - `generateBackupPayload()` in `src/lib/data-backup.ts` exports every MySQL table listed by `INFORMATION_SCHEMA` except `EXCLUDED_BACKUP_TABLES` (`sessions`, `sms_gateway_settings`), and strips columns matching `/pass(word)?|secret|token|api_key/i` from every row. The old hand-written table list silently skipped orders, quotations, projects, stage history and SMS logs; never go back to a fixed list.
  - It throws when any table cannot be read, so an empty or partial file is never downloaded as a backup.
  - CSV export (`downloadCsvExport(table)`) writes one real table with a UTF-8 BOM (for Bangla in Excel), RFC 4180 quoting and a formula-injection guard (`toCsv`). It previously downloaded 4 hard-coded fake rows.

- **Dashboard User Selector & No Fake Minimum Counts**:
  - Admins pick a user in `src/app/(authenticated)/dashboard/page.tsx`; the choice is passed as `agentFilter` to `dashboardMetricsQuery`, which matches `assigned_to`, `assigned_artist_id` or `created_by`. Non-admins never see the selector and stay scoped to themselves.
  - The top cards previously used `Math.max(real, 12)`-style floors and a fake `$7260,00` revenue, which hid real numbers and made per-user filtering look broken. Show the real value (0 when empty).
  - The dashboard date filter is `DateRangePicker3` (defaults to This Month). `dashboardMetricsQuery` takes `{ from, to }` as `yyyy-MM-dd` strings and compares them with the date part of `prospects.created_at`. The old string filter silently ignored "Last Month", so that option showed all-time numbers.

- **Dashboard Sales Summary Cards (ERPAPP definitions)**:
  - `computeFinanceSummary()` in `src/lib/dashboard-finance.ts` builds Total Sales, Invoice Due, Advance Paid, Cash Collection and Repeat Sales from `ordersQueryOptions` data; Expense comes from `dashboardExpenseQuery` (`expenses.expense_date`, `recorded_by`).
  - Sales, due and repeat use orders created in the range (`canceled` excluded). Advance Paid and Cash Collection use payments whose own date is in the range, on any order; Advance Paid skips COD/courier methods. Repeat Sales = orders whose Job ID appeared on an earlier non-cancelled order. The admin user filter matches `crm_user_id` or `designer_id`.
  - Project Overview and Pipeline Overview (ERPAPP `StatusTimeline` clone, `src/components/dashboard/status-timeline.tsx`) show orders per `ORDER_STATUSES` stage (`computeOrderStatusSteps`, legacy statuses count as Order Submitted) and active prospects per active stage (`prospectStageStepsQuery`), both for the selected date range and user. The highlighted stage rotates every 3 seconds.

- **framer-motion Cannot Animate 8-Digit Hex Colours**:
  - Animating `backgroundColor` between `#RRGGBB1A` and `#RRGGBB` left the active stage circle stuck at the tint (pale circle, invisible white number). Pass `rgba()` strings instead (see `rgba()` in `src/components/dashboard/status-timeline.tsx`), and give both box-shadow states the same number of layers.
  - The Project / Prospect Overview cards sit at the bottom of the Dashboard, after Scheduled follow-ups and Project assignments.
  - Count cards (`FinanceSummaryCard isCount`): Meeting Scheduled = non-cancelled meetings whose `meeting_date` is in the range; Total Quotation = active (`is_active = 1`, deleted quotations are soft-deleted) quotations whose `order_date` is in the range; Total Delivered = orders whose `status_history` has a Delivered entry in the range (`computeDeliveredCount`). All three follow the user filter.

- **Committed CRLF Breaks the Server Build**:
  - `next build` runs ESLint with prettier, so any file committed with Windows line endings fails the production build (`Delete ␍`) even though the local dev server runs fine. Before pushing, run `git ls-files --eol src | grep "i/crlf"`; it must print nothing. Convert with `sed -i 's/\r$//' <file>` and re-commit.
  - Local working copies may show CRLF (`w/crlf`) while the committed copy is LF (`i/lf`); only the `i/` column matters for the server. To reproduce the server build locally, build a clean `git worktree` of the commit.

- **Expenses Page Income / Expenses Cards**:
  - `/expenses` shows Income (payments received in the date range, `computeFinanceSummary(...).cashCollection` from `ordersQueryOptions`) and Expenses (`dashboardExpenseQuery` for the range) in place of the old fixed This Month / All-Time cards. Both follow the header `DateRangePicker3`; non-admins see only their own orders and the expenses they recorded.

- **File Uploads Are Images or PDF Only, Served Without Scripts**:
  - `/api/upload` accepts only `.png .jpg .jpeg .webp .gif .avif .svg .pdf` (it previously saved any extension, so an `.html` upload could run as a page on the app's own domain). `next.config.ts` adds `X-Content-Type-Options: nosniff` and a sandboxed `Content-Security-Policy` to every `/uploads/*` response, because in dev and for files present at build time Next.js serves `public/uploads` directly and never reaches the route handler.
  - The Expenses form uploads receipts with `uploadImageFile()` (`src/lib/upload.ts`); PDF receipts open in a new tab from the preview dialog instead of an `<img>`.

- **Follow-ups Live in `prospect_stage_history` (No `follow_ups` Table)**:
  - Per user request, follow-ups are not stored in a separate table. `useCreateFollowUp()` (`src/lib/follow-ups.ts`) writes one `prospect_stage_history` row (stage = Follow-up) with `follow_up_due_at`, `follow_up_assigned_to`, `follow_up_status` and `changed_by` = creator. A follow-up is any stage history row where `follow_up_due_at IS NOT NULL`.
  - Store `follow_up_due_at` with `getMySQLTimestamp(new Date(due))` (Dhaka local). The old `follow_ups.due_at` used `toISOString()` (UTC), so pools with `dateStrings: true` showed it 6 hours early.
  - The legacy `follow_ups` table is no longer created; old rows stay in existing databases untouched. Never add new reads or writes to it.
  - `ensureMySQLTablesExist()` copies legacy `follow_ups` rows into stage history once (same id, `INSERT IGNORE`, due time +6h), so old follow-ups appear on the board.

- **Follow-ups Board (`/follow-ups`, ERPAPP `/follow-up` clone)**:
  - `src/components/follow-ups/follow-up-board.tsx` + `follow-up-card.tsx`: Kanban with columns from table `followup_stages` (`followUpStagesQueryOptions`), one card per prospect (its latest follow-up row, `followUpBoardQueryOptions`). Statuses match columns by normalised name, so legacy `pending` / `cancelled` land in Pending / Canceled; unknown values fall into the first column.
  - Native HTML5 drag-and-drop (no `@dnd-kit`). Dropping on another column opens the required-notes dialog, then `useUpdateFollowUp` sets `follow_up_status` and appends the note to that stage history row via `addStageNote()`, so the note also shows in the prospect's stage timeline. "Add Update" appends a note without a status change; "View Timeline" lists those notes; admin "Delete Record" (`useRemoveFollowUp`) clears the follow-up fields only, keeping stage history.
  - Admin "Columns" button opens `ManageFollowUpStagesDialog` (`src/components/follow-ups/manage-follow-up-stages-dialog.tsx`): add, rename/recolour, reorder (up/down, saves `position`) and delete `followup_stages`. A rename also rewrites `follow_up_status` of the cards in that column (by row id) so they stay in it. Delete is blocked while the column has cards and for the last column.
  - Note box on each card shows the newest stage note (`parseNotesToItems(note).at(-1)`).
  - The stage-change / Add Update dialog has an optional **Next Follow-up Schedule** (ERPAPP pipeline-style calendar popover with past days disabled, plus a time box; empty by default). `useUpdateFollowUp` saves it to `follow_up_due_at` only when a date is picked, and the card labels the date badge "Next Follow-up". Notes are stored exactly as typed (no "Status changed to X:" prefix); the outcome text only goes to `activities`.
  - Not ported from ERPAPP: CSV import, Job ID search and customer type badges (no matching Brandium data).

- **Stage Note Arrays Must Not Embed Base64 Avatars (TEXT Overflow)**:
  - `prospect_stage_history.note` is `TEXT` (65,535 bytes). Old note items stored `createdByAvatar` as a `data:` base64 image, so one note hit the limit, MySQL cut it off and the JSON no longer parsed; the follow-up timeline then printed raw JSON. `addStageNote()` now drops `data:` avatars, and `parseNotesToItems()` salvages every complete `"text"` entry from a truncated array.
  - Re-saving a note array also copied the fallback author avatar (base64) into old items, so a stage note grew to ~56 KB and every later note pushed it past 65,535: MySQL rejected the UPDATE, `addStageNote()` ignored the failed result and the dialog still said "Note added". All note writes in `src/lib/stages.ts` now go through `serializeNoteItems()` (drops `data:` avatars) and `runNoteWrite()` (throws when the query fails), and `ViewStageDialog` throws when `addStageNote` / `deleteStageNote` return `false`.
  - Do not use Radix `ScrollArea` around long wrapping text inside a dialog: its viewport child is `display: table`, so text grows past the dialog edge. Use a plain `overflow-y-auto` div with `wrap-anywhere` text.

- **Dashboard "Scheduled follow-ups" Card (replaces fake "Active deals")**:
  - `src/components/dashboard/scheduled-follow-ups-table.tsx` keeps the old Active deals table styling but shows real data from `followUpBoardQueryOptions`: open follow-ups (columns whose name matches complete/cancel/done/closed are hidden), upcoming only (date part of `follow_up_due_at` >= today; earlier dates hidden), soonest first, max 5; today's already-passed times show in rose. Status badges are filled with the card's follow-up board column colour (`followup_stages.color`, same as the board header), with `getContrastTextColor()` text. The user wants the board column colour, not the prospect pipeline's Follow-up stage colour. It follows the dashboard admin user filter (`assigned_to` or `created_by`) and the header date range (`range.from`/`range.to` compared with the date part of `follow_up_due_at`; default This Month). "View all" links to `/follow-ups`. The hard-coded `activeDeals` list and `active-deals-table.tsx` were removed.
  - Use `table-fixed` with column widths on dashboard tables; with the default auto layout, long names ignore `truncate` and the table scrolls sideways.

- **MySQL "Too many connections" in `next dev` (Pool Recreated on Hot Reload)**:
  - `getMySQLPool()` (`src/lib/mysql-server.ts`) kept its pool in a module-level variable. `next dev` re-evaluates that module on every hot reload and per route bundle, so each edit opened another pool (up to 20 connections each) and never closed the old ones; MySQL hit `max_connections` (151) and every save failed with "Too many connections".
  - The pool now lives on `globalThis.__brandiumMySQLPool`, with `maxIdle: 5` and `idleTimeout: 60000` so idle connections close. Never cache a pool, connection or other long-lived resource in a plain module variable in server code.
  - If it happens again, restart the dev server: stopping it frees the leaked connections. Other `next dev` processes still running older code (other worktrees) can still leak until they are restarted.

- **Dashboard "Project assignments" Card (replaces fake "Pending tasks")**:
  - `src/components/dashboard/project-assignments-list.tsx` keeps the old Pending tasks row styling but lists real stage assignments read from `orders.status_history` (from `ordersQueryOptions`, already loaded by the dashboard). An entry counts when its note matches `assigned to <name>` (written by `useAssignStageMutation`, plus legacy "Assigned to Designer Representative X."). Rows show assignee initials, assignee name, company, date and a stage badge in the `ORDER_STATUSES` colour; newest first, up to 50 rows inside a plain `max-h-90 overflow-y-auto` scroll box (not Radix `ScrollArea`, which breaks `truncate`). "View all" links to `/projects`.
  - It follows the dashboard date range (assignment date) and the admin user filter (`crm_user_id` or `designer_id`). The hard-coded `pendingTasks` list and `pending-tasks-list.tsx` were removed.

- **Dashboard "Sales and expenses" Card (was fake "Revenues and expenses")**:
  - `src/components/dashboard/revenue-expense-chart.tsx` keeps the old bar/pill chart look but takes real data: Sales = `computeFinanceSummary(...).totalSales` / `salesCount` (same rule as the Total Sales card), Expenses = `dashboardExpenseQuery` total/count, all shown in BDT (`৳`). The fake `$2523,00`, `+5.2%` / `-1.7%` badges and the hard-coded 30-day `DAYS_DATA` were removed; the badges now show order / expense counts.
  - Chart buckets come from `computeSalesExpenseSeries()` + `dashboardExpenseSeriesQuery()` in `src/lib/dashboard-finance.ts`: one bar per day when the range is 31 days or less, otherwise one per month (last 24). "All Time" uses the first and last day that has data. The y-axis scale is rounded from the tallest sales + expense bucket.

- **Dashboard "Your Performance" = Lead Conversion (was fake 88%)**:
  - The gauge shows `round(won_sales / total_prospects * 100)` from `dashboardMetricsQuery` (prospects created in the date range, user-filtered). The rows are Qualified leads (`qualified_leads/total`), Meetings scheduled (`dashboardActivityCountsQuery().meetings`) and Sales won (`won_sales/total`); a row shows ✓ when its count is above 0.
  - `PerformanceGauge` (`src/components/dashboard/performance-gauge.tsx`) used to draw the three coloured arcs at fixed lengths whatever the percentage. It now draws a grey track and fills the coloured segments only up to the percentage, and it has no fake default tasks.

- **Order / Project Stage Change Requires a Reason for Canceled and On Hold**:
  - `requiresStatusReason(statusId)` (`src/lib/orders.ts`) is true for `canceled` and `on-hold`. Both stage-change paths (Projects board drag-and-drop in `projects-kanban-board.tsx`, Orders page "Change Status" in `orders/page.tsx`) open `StatusReasonDialog` (`src/components/orders/status-reason-dialog.tsx`, required textarea, no from → to box) instead of moving the order directly.
  - `useUpdateOrderStatusMutation` also throws when the reason is missing for those stages, and saves it in `status_history` as `Order moved to "On Hold". Reason: ...`.

- **`/reports` Page Removed**:
  - Removed per user request: `src/app/(authenticated)/reports/page.tsx`, its only data source `src/lib/reports.ts`, and the sidebar "Reports" link. The dashboard "Your Performance" View all now links to `/prospects`. Admin "Agent Reports" (`/admin/agent-reports`) is separate and kept.
  - After deleting a route, `tsc` can still fail on stale `.next/types/validator.ts` (`Cannot find module '.../reports/page.js'`); restarting `next dev` (or running `next build`) regenerates it.

- **App-wide 404 Page (`src/app/not-found.tsx`)**:
  - Built from the user's reference image. The artwork (both 4s, the 0 and the newspaper reader) is cropped 1:1 from the reference into `public/404/404-artwork.webp` (770×430) and shown at most at that native width (`max-w-192.5`, `w-full h-auto` below it); the two text lines are live Open Sans text (`#222` 20px heading, `#444` 13px line, `#23a0b5` semibold underlined "homepage" link to `/`). Open Sans is loaded through the existing Google Fonts `@import` at the top of `src/styles.css`.
  - The image uses `unoptimized`: Next's default optimiser re-encoded it at q=75 and upscaled to 828px, which visibly softened the photo. Spacing matches the reference at 991×678 (artwork top 84px, heading top 564px, line top 621px, no scrollbar).
  - The page has a fixed white background on purpose (the artwork's background is white), including in dark mode.

- **Order Invoice & Quotation PDF (`@react-pdf/renderer`)**:
  - `/track/[id]` and `/quotations/[quotationid]` have **Print** and **Download PDF** buttons (`SalesPdfActions`, `src/components/sales/sales-pdf-actions.tsx`); the `/orders` "Invoice" action (`?print=1`) prints the PDF once. Both use one A4 layout, `SalesPdfDocument` (`src/components/sales/sales-pdf-document.tsx`): full-page letterhead (`brandium_invoice_bg.jpg`, explicit 595.28×841.89pt + `objectFit: "fill"`), Bill To box, code + dates + CODE128 barcode, items, notes, payments, terms and totals, Paid stamp when fully paid.
  - `src/lib/sales-pdf.ts` holds the `SalesPdfData` shape, `orderToPdfData()` (same totals rules as the track page), and `printSalesPdf` / `downloadSalesPdf`, which `import()` `@react-pdf/renderer` on click so it never lands in page bundles. The quotation page builds its data inline from its existing `useMemo` values.
  - Fonts are the built-in Helvetica, so amounts use `BDT` (not `৳`) and Bangla text would not render; register a Bangla-capable font with `Font.register` if that is needed.
  - Running `npm install` while `next dev` is running left the dev server with two loaded copies of `@tanstack/react-query` ("No QueryClient set, use QueryClientProvider" on pages compiled afterwards). Restart the dev server after installing packages.
  - When copying working-tree files in PowerShell, paths with `[id]` are wildcards: use `-LiteralPath` everywhere (or bash), or the copy silently skips those pages.

- **Second `next dev` Breaks the Running One (500 on every page)**:
  - Starting `npm run dev` while a dev server for this project already runs wipes the shared `.next` cache (`routes-manifest.json` goes missing) and the first server returns "Internal Server Error" on every page. Before starting, check port 3000 (`netstat -ano | grep ":3000 "`); if a server is already there, use it. If both ran, stop both and start one.

- **Server Session Cookie Guards Every API Route (`src/lib/session-server.ts`)**:
  - `/api/mysql`, `/api/upload` and `/api/sms/*` used to run for anyone with no login check, and "admin" was only a value in browser `localStorage`. Login now sets a signed httpOnly cookie (`brandium_session`, 7 days, key from `SESSION_SECRET` in `.env`); every Route Handler must start with `readSession(req)` and return `unauthorized()` without it, and admin-only actions return `forbidden()` unless `session.admin`.
  - Non-admins cannot run schema changes, touch `password_hash`, or write to `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `sms_gateway_settings` (`isAdminOnlySql`). New client SQL that an agent must run may not write to those tables.
  - The browser copy of the session is display only: `AuthProvider` checks it against `GET /api/auth/login` and signs out on mismatch; `runMySQLQuery` sends the user to `/login` on 401. Never trust a user id or role sent from the browser when the session has it (`session.id`).

- **No Fixed Passwords, No Password Hashes in the Browser**:
  - The login route used to switch `admin@example.com` / `agent@brandium.com` back to Active on every login attempt, the login page had demo buttons carrying their passwords, and the first-run seed created five accounts with fixed passwords. All removed: an empty `users` table now gets one admin whose password is `INITIAL_ADMIN_PASSWORD` or a random one printed once in the server log. Never write a password in source.
  - `fetchCrmUsers()` (`src/lib/admin-users.ts`) selects named columns, never `SELECT *`, and `CrmUser` has no `password_hash`. Only `changeOwnPassword()` reads one hash, for one user.
  - `createCrmUser()` takes `password` (plain, hashed inside). The create-user form used to pass the plain password as `password_hash`, so it was stored unhashed and the new user could never sign in; `hashPasswordBcrypt` also returned the plain text on error. Reset the password of any user created before this fix.

- **Writes Must Fail Loudly (`runMySQLWrite`) and Never Overwrite a Newer Save**:
  - `runMySQLQuery()` returns `{ success: false }` instead of throwing, so a mutation that ignores the result shows "saved" for a write that never happened (quotation save, order update and order stage change all did). Every INSERT / UPDATE / DELETE in a mutation must use `runMySQLWrite()` (`src/lib/mysql-api.ts`), which throws on failure and returns the rows matched.
  - Never build a unique code with `Math.random()` (`QT-` + 4 digits collided and the insert failed silently). `useSaveQuotationMutation` lets MySQL compute the next `QT-<n>` inside the `INSERT ... SELECT` and retries once on `Duplicate entry`.
  - `orders.payments_json`, `items_json` and `status_history` are whole-value overwrites. Order updates and stage changes carry the `updated_at` they loaded (`expected_updated_at` / `order.updated_at`) in the `WHERE`; 0 rows matched means someone else saved first and the user is told to reload. Keep this check on any new whole-value overwrite.
  - In Lead Details (`change-stage-dialog.tsx`) the trash icon deletes one note with `deleteStageNote({ historyId, noteIndex })`; it used to pass a made-up `rowId-noteId` to `deleteStageHistoryEntry`, which deleted nothing and still said "Activity removed". `deleteStageHistoryEntry` now throws on failure and no longer resets the lead to `prospect` when no history is left.

- **No Fixed Passwords, No Password Hashes in the Browser**:
  - The login route used to switch `admin@example.com` / `agent@brandium.com` back to Active on every login attempt, the login page had demo buttons carrying their passwords, and the first-run seed created five accounts with fixed passwords. All removed: an empty `users` table now gets one admin whose password is `INITIAL_ADMIN_PASSWORD` or a random one printed once in the server log. Never write a password in source.
  - `fetchCrmUsers()` (`src/lib/admin-users.ts`) selects named columns, never `SELECT *`, and `CrmUser` has no `password_hash`. Only `changeOwnPassword()` reads one hash, for one user.
  - `createCrmUser()` takes `password` (plain, hashed inside). The create-user form used to pass the plain password as `password_hash`, so it was stored unhashed and the new user could never sign in; `hashPasswordBcrypt` also returned the plain text on error. Reset the password of any user created before this fix.

- **Writes Must Fail Loudly (`runMySQLWrite`) and Never Overwrite a Newer Save**:
  - `runMySQLQuery()` returns `{ success: false }` instead of throwing, so a mutation that ignores the result shows "saved" for a write that never happened (quotation save, order update and order stage change all did). Every INSERT / UPDATE / DELETE in a mutation must use `runMySQLWrite()` (`src/lib/mysql-api.ts`), which throws on failure and returns the rows matched.
  - Never build a unique code with `Math.random()` (`QT-` + 4 digits collided and the insert failed silently). `useSaveQuotationMutation` lets MySQL compute the next `QT-<n>` inside the `INSERT ... SELECT` and retries once on `Duplicate entry`.
  - `orders.payments_json`, `items_json` and `status_history` are whole-value overwrites. Order updates and stage changes carry the `updated_at` they loaded (`expected_updated_at` / `order.updated_at`) in the `WHERE`; 0 rows matched means someone else saved first and the user is told to reload. Keep this check on any new whole-value overwrite.
  - In Lead Details (`change-stage-dialog.tsx`) the trash icon deletes one note with `deleteStageNote({ historyId, noteIndex })`; it used to pass a made-up `rowId-noteId` to `deleteStageHistoryEntry`, which deleted nothing and still said "Activity removed". `deleteStageHistoryEntry` now throws on failure and no longer resets the lead to `prospect` when no history is left.

- **Demo Quotations Removed (`DEMO_QUOTATIONS` → real data only)**:
  - `src/app/(authenticated)/quotations/page.tsx` no longer falls back to a hardcoded list when real quotations are absent. Users see an empty state; this shows the real state of their data.

- **Image Resizer Only Serves This App's Files**:
  - `next.config.ts` removed `images.remotePatterns` allowing arbitrary remote hosts. The `<Image>` component on project/quotation/track pages only serves files from `/public` and `/uploads`.

- **Login Errors Hide User Enumeration**:
  - `src/app/api/auth/login/route.ts` returns one message, "Invalid email or password," for both "no such user" and "wrong password", so the form cannot be used to find out which emails have accounts. Database details stay in the server log. All connections close in a `finally` block. Status checks (suspended, inactive) happen after the password check, so only the account owner learns it is suspended.

- **Dead Code Removed**:
  - Deleted `src/lib/prospects.functions.ts`, `src/lib/projects.functions.ts`, `src/lib/roles.functions.ts` (unused legacy TanStack Start server functions).
  - Trimmed `src/lib/auth.functions.ts` and `src/lib/crm.functions.ts`: removed Opportunity, Meeting, Invoice, Service server functions (unused, only the query versions are live). Removed the `authenticateXamppUser` function and the `AuthenticateUserResponse` type.


- **Follow-ups Board Columns = Prospect Pipeline Stages (supersedes `followup_stages`)**:
  - Per user request the follow-up board and the prospect stage are the same thing. `followUpStagesQueryOptions()` (`src/lib/follow-ups.ts`) reads the active rows of `stages` (ordered by `sort_order`, colour via `resolveStageColor`, plus `group` = `stage_group`), and a card's column is the prospect's current `prospects.stage_id` (`FollowUpBoardItem.status`), matched by `followUpStageFor()` on normalised id or name so legacy ids like `follow_up` still land in Follow-up.
  - Dragging a card (or "Move to Stage") runs `useUpdateFollowUp` with the target stage id: it updates `prospects.stage_id`, inserts a new `prospect_stage_history` transition row that carries the follow-up fields (due date, assignee), and adds the required note to that row. A stage change made anywhere else (Lead Details, prospects page) moves the card too.
  - The admin "Columns" button and `ManageFollowUpStagesDialog` were removed; columns are managed on the Stage Management page. The `followup_stages` table is no longer read.
  - The dashboard "Scheduled follow-ups" card hides prospects whose stage group is `won`, `lost`, `unreachable` or `denied` (was a Completed/Canceled name match).

- **Bulk SMS Audience Cards & Real Stage/Agent Filtering (`/sms/send`)**:
  - The Bulk SMS form shows three separate audience cards side by side (`AudienceCard` in `src/app/(authenticated)/sms/send/page.tsx`): Select Prospects (search + checklist), By Stage (real `stagesQuery()` stages) and By Agent. Each card shows its own recipient count; using anything inside a card makes it the broadcast audience (green border + tick).
  - By Stage and By Agent used to target every prospect with a phone and ignored the chosen stage or agent, so a "stage" broadcast went to everyone. `recipientsByMode` now filters by `prospects.stage_id` (normalised id or name) and `prospects.assigned_to`, and `fetchProspectOptions()` selects those columns. Never build a bulk recipient list without applying the chosen filter.
  - `src/lib/sms.ts` and `src/lib/meetings.ts` both cached prospect lists under `["prospects", "options"]` with different columns, so whichever loaded first won. The SMS list now uses `["prospects", "sms-options"]`. Give every query function its own key.

- **Role Permission Matrix Mirrors the Sidebar (`/admin/roles`)**:
  - The permission matrix rows are built from `navGroups` (`src/lib/nav.ts`): Page = item title, in sidebar order (no group column; a thicker line separates groups). Create / Edit / View / Delete ids per page come from `PAGE_ACTIONS` (keyed by page url) in `src/app/(authenticated)/admin/roles/page.tsx`; a page missing there gets only View = its sidebar `permission`. A page with no permission (Dashboard) shows as "Everyone" with disabled checkboxes.
  - When you add a sidebar page, it appears in the matrix automatically; add a `PAGE_ACTIONS` entry only if it needs separate create/edit/delete permissions. Never go back to a hand-written module list, which drifted (it had Billing, which has no page, and lacked Services, Agent Activity, Agent Reports and Dashboard).
  - Agent Activity and Agent Reports share `perm-reports-view`, so ticking one ticks both.

- **Agent Activity Audit Log Sources & Fixes (`/agent-activity`)**:
  - `fetchActivityLogs({ from, to })` (`src/lib/activity-logs.ts`) merges, per date range (`yyyy-MM-dd`, header `DateRangePicker3`, default This Month): `activities`, `prospect_stage_history`, `meetings`, every `orders.status_history` entry and `orders.payments_json` payment (JSON ISO timestamps converted with `getMySQLTimestamp`), `quotations`, `sms_logs`, `expenses`, and the legacy `invoices` / `payments` tables. Each source reads at most 500 rows in the range.
  - Stage history notes live in `prospect_stage_history.note` (a JSON note array, read with `parseNotesToItems`) and its time is `changed_at`. The page used to read `sh.notes`, an empty column the self-healing migration had created from that bad query, so stage notes never showed. When a query names a wrong column, the auto-migration silently adds it instead of failing: check `SHOW COLUMNS` before trusting a column name.
  - `activities.activity_type` values such as `follow_up_created` / `follow_up_updated` are normalised to the `followup` category (`normalizeEntityType`); the old exact match missed them in the filter, badge and Meetings & Follow-ups card.
  - Actor names use `COALESCE(profiles.full_name, users.name, users.email, 'System')`.

- **Agent Activity Page Layout (`/agent-activity`, redesigned)**:
  - Header (title, `DateRangePicker3` default This Month, icon-only Refresh with `aria-label`) → 4 `StatCard`s (Total events, Active agents, Stages & follow-ups, Orders & money) → two columns: filter card (search, agent select with avatars, Reset, category chips with counts using `aria-pressed`) above a day-grouped timeline feed (sticky day headers, category icon circle + sr-only label, full wrapping action text, prospect/business/phone line, actor avatar + time, Details button opening `ActivityLogMetadataModal`, "Show more" in pages of 50), and a sticky "Most active agents" panel that toggles the agent filter.
  - Categories live in one `CATEGORIES` map (label, Lucide icon, tint); `categoryOf()` maps `billing` to invoices and unknown types to Other. Chip counts follow the agent and search filters. Actor avatars: `fetchActivityLogs()` ends with `attachActorAvatars()`, which loads every user once (`COALESCE(profiles.avatar_url, users.avatar_url)`) and sets `user_avatar` on each log by `user_id` (any role, not only agents); order history and payment JSON entries that only hold a name are matched by name and also get their `user_id`. Initials show when a user has no photo.
  - The fake "Live Audit Stream" badge was removed: the page is not live.

- **User Avatars Are Uploaded Files, Never Inline Base64 (`Set Avatar` / `Create User`)**:
  - The Set Avatar and Create User dialogs used to save the picked image as a base64 `data:` URL. `users.avatar_url` is `TEXT` (64 KB) and MySQL here runs without strict mode, so a medium image was silently cut off (broken image) and a large one went over `max_allowed_packet` (1 MB) and was rejected. `updateUserAvatar()` ignored the failure, kept the picture in an in-memory map and said "updated successfully", so the avatar vanished after a reload.
  - Both dialogs now upload with `uploadImageFile()` (`/api/upload`) and store the short `/uploads/...` link. `assertAvatarUrl()` refuses `data:` URLs, `updateUserAvatar()` writes with `runMySQLWrite()` (throws on failure) to `users` and `profiles` (most screens read `profiles.avatar_url` first), and the in-memory avatar map was removed.
  - Non-strict MySQL truncates oversized values instead of failing: never store files or base64 in a TEXT column.

- **Project Stage Roles (SW, CP, VG, VE, MK, DEV)**:
  - Each assignable order/project stage has a short role in `ORDER_STATUSES` (`role`): Script Writer `SW`, Content Planner `CP`, Videographer `VG`, Video Editor `VE`, Marketer `MK`, Developer `DEV`. The roles are seeded as system roles (`role-stage-sw` … `role-stage-dev`) in `ensureMySQLTablesExist()` with View/Manage Projects, View Orders and View Services.
  - `AssignStageDialog` lists ONLY users whose `users.role` equals the stage's role (e.g. Script Writer shows only SW users); with none it shows "No user has the SW (Script Writer) role yet" and Assign stays disabled. Stages without a role list every active user. Matching is by role name: renaming one of these roles in Role Management breaks the match unless `ORDER_STATUSES` is updated too.

- **One Dashboard for Every Role (role-based dashboard removed)**:
  - Per user request the role-based dashboard was dropped: `/dashboard` (`src/app/(authenticated)/dashboard/page.tsx`) shows one layout to everyone (finance cards, pipeline cards, Project / Prospect overviews, Sales and expenses, Your Performance, Scheduled follow-ups, Project assignments). The admin user selector and expense data stay admin-only.
  - `getDashboardRoleGroup`, `ProductionDashboard`, the agent "today" view and the "Needs attention" cards (`TeamLeaderboard`, `StuckProjectsList`, `OverdueFollowUpsList`, `DueOrdersList`, `MyQuotationsCard`, `DashboardPanel`) no longer exist; their files (`dashboard-roles.ts`, `production-dashboard.tsx`, `role-sections.tsx`) went missing and the page failed with "Failed to read source code". Never import them again without recreating them.
  - The stage roles (SW, CP, VG, VE, MK, DEV), `AssignStageDialog` role filtering and `getStageStartedAt()` / `getStageDeadline()` in `src/lib/orders.ts` are unaffected and still used by the Projects board.

- **Per-Order Terms & Conditions (`orders.terms`)**:
  - Each order can have its own Terms & Conditions, edited in **Edit Order** below the Order Summary (`src/components/orders/edit-order-dialog.tsx`): one term per line, prefilled with the order's terms or the default `BRANDIUM_TERMS`, with "Reset to default".
  - Stored in `orders.terms` (`LONGTEXT NULL`, JSON string array, in the column-migration list). NULL means "use the default list": `termsToSave()` saves NULL when the box is empty or identical to `BRANDIUM_TERMS`, so changing the default later still reaches those orders.
  - `useSaveOrderMutation` updates it with `terms = IF(?, ?, terms)`: only when the payload has a `terms` key. Create Order and Create Quotation have the same box (starting from the default list); because their INSERTs are exact-text constants in `trusted-sql.ts`, the mutations store terms with a separate `UPDATE ... SET terms = ? WHERE id = ?` right after the insert, only when the list differs from the default. `resolveOrderTerms(order)` (`src/lib/orders.ts`) is the one place that picks the order's list or the default; the `/track/[id]` page and the order PDF (`orderToPdfData`) both use it.

- **Non-Admin `/api/mysql` Reads Are Row-Scoped on the Server (`src/lib/sql-scope.ts`)**:
  - Hiding cards was not access control: any signed-in Agent or production user could `SELECT` every order, payment, expense or prospect through `/api/mysql`. For non-admin sessions the route now passes the SQL through `scopeSqlForUser(sql, session.id)`, which rewrites every read of a company table (FROM / JOIN / comma join, at any depth, also inside writes) into a derived table holding only that user's rows, e.g. `FROM orders o` -> `FROM (SELECT * FROM orders WHERE crm_user_id = 'me' OR designer_id = 'me') o`. Admin SQL runs unchanged.
  - The row rules mirror the filters the pages already applied in the browser: orders (`crm_user_id` / `designer_id`), prospects (`assigned_to` / `assigned_artist_id` / `created_by`, plus prospects with a follow-up or meeting assigned to the user), stage history and activities (visible prospect, or own row), meetings, quotations / projects (+ assignee tables), order comments, expenses (`recorded_by`), sms_logs (`sent_by`) and the legacy invoices / payments / opportunities / sales. `sessions`, `refresh_tokens`, `sms_gateway_settings`, `audit_events`, `outbox_events` are refused. When you add a table holding per-user company data, add its rule to `scopeRules()`.
  - Fail closed: non-admins may only run SELECT / WITH / INSERT / UPDATE / DELETE / REPLACE; database-qualified names (`db.table`), MariaDB executable comments (`/*! */`) and unbalanced SQL are refused with 403. Comments are dropped. Write targets (`UPDATE t`, `INSERT INTO t`, `DELETE FROM t`) are not rewritten, so row-level WRITE checks are still open work.
  - Statements that must see every row (next prospect id, duplicate-phone check, the `INSERT ... SELECT MAX(...)` code generators for orders and quotations) live as exact-text constants in `src/lib/trusted-sql.ts` with a param check; the route runs them unscoped only on an exact text match. Never build such a statement with string concatenation, or it silently becomes scoped.
  - The self-healing `ALTER TABLE` on "Unknown column" runs only for admin sessions (`selfHeal: session.admin`); a non-admin could otherwise add columns to any table.
  - Self-check: `node --experimental-strip-types src/lib/sql-scope.check.ts`.
  - **Quotations too (`quotations.terms`)**: Edit Quotation has the same box below the Quotation Summary. It saves `terms = IF(?, ?, terms)` in `useSaveQuotationMutation`, is selected as `prj.terms` by the list query and by the detail page's shared `baseSelect`, and the `/quotations/[quotationid]` page and its PDF print `resolveTerms(parseTerms(quotation.terms))`. The old page-local `QUOTATION_TERMS` copy was removed; the default for both is `BRANDIUM_TERMS`.
  - The box, `termsToSave()`, `parseTerms()` and `resolveTerms()` live in one shared file, `src/components/sales/terms-editor.tsx` (`TermsEditor`); Edit Order and Edit Quotation both use it. Do not copy the editor into a third dialog: import it.

- **Sales PDF Layout (`sales-pdf-document.tsx`)**:
  - Terms & Conditions + totals sat right under the last table, leaving half the A4 page empty above the letterhead footer. `bottomRow` now uses `marginTop: "auto"` (plus `alignItems: "flex-end"`), so it anchors to the bottom of the sheet like the on-screen invoice.
  - react-pdf hyphenates long words by default ("Mehan Ahmed (Sys-tem Admin)"). The document registers `Font.registerHyphenationCallback((word) => [word])` (whole-word wrapping) and the Payments "Recorded By" column is 28% wide.
  - To check the layout without a browser, render the real component in Node with jiti (alias `@` → `src`, `global.React` set) and `renderToFile`; pass the letterhead as `{ data: Buffer, format: "jpg" }`, because a plain file path is silently skipped there.

- **One Lead Details Dialog (`ChangeStageDialog`, "Calm CRM record" redesign)**:
  - There were two "Lead Details" dialogs: `ChangeStageDialog` (stage badge, Follow-ups board) and an older `view-stage-dialog.tsx` (prospect card / table row click) with fewer actions. Per user request the old one was deleted; every place now opens `ChangeStageDialog` (`src/components/change-stage-dialog.tsx`) via `setStageTarget({ id, label, stageId, prospect })`. Do not add a second lead dialog: extend this one.
  - Layout: header (initials/logo avatar, full name that wraps, business, stage badge) → left column "Contact" (`Fact` rows in a `<dl>`, phone with icon-only Call / WhatsApp links with `aria-label`, CR with avatar, next follow-up pill, notes) and "Next steps" (Create Order as the only solid green button, Meeting / Quotation outline, Edit lead ghost) → right column "Activity" (plain `max-h-80 overflow-y-auto` list, not Radix ScrollArea; icon, title, date, note, "by Name", delete button visible on hover/focus with `aria-label`) and a "Log activity" form with one-tap activity type chips (`role="radio"`), notes textarea and Ctrl+Enter save.
  - Stage rows without a note show "Moved to {stage}". `handleSubmit` now throws when `addStageNote()` returns false, so a failed save shows "Failed to add activity" instead of "logged".

- **Per-Role Data Access: Own vs All Users' Data (`/admin/roles`)**:
  - Role Management has a **Data access** column (Own data / All users' data) on data pages. Areas and their tables live in one place, `DATA_SCOPE_AREAS` (`src/lib/data-scope.ts`): leads (Prospects + Follow UP), meetings, quotations, orders (Orders + Projects), sms (Send SMS + SMS Logs), expenses. Pages that read the same tables share an area, so their dropdowns change together ("Linked with ..."). "All" is stored as permission `perm-scope-all-<area>` in `role_permissions` (seeded in `ensureMySQLTablesExist()`); no row = own data, so existing roles kept their behaviour.
  - Enforced on the server: `/api/mysql` passes `getUnscopedTables(session.role)` (`src/lib/data-scope-server.ts`, reads the role's current `perm-scope-all-*` rows by role name, case-insensitive, 30s cache on `globalThis`, fails closed to own data) into `scopeSqlForUser(sql, userId, unscopedTables)`, which skips the own-rows rule for those tables only. Self-check covers it.
  - Pages: `useSeesAllData(area)` (`src/lib/use-data-scope.ts`, client only; keep it out of `data-scope.ts`, which the server imports) replaces `isAdmin` in the own-data filters of Prospects, Follow-ups board, Meetings, Quotations, Orders, Projects board and Expenses. The Dashboard stays own-data for non-admins. Admin roles (name Admin or `perm-admin-roles`) always see everything and their dropdowns are disabled.
  - Matrix UI: section labels per sidebar group, sticky header, centred checkbox columns, and a floating "N unsaved changes · Discard · Save changes" bar. Checkbox cells are a plain function call (`permCell(...)`), not a component defined inside render, which would remount and drop keyboard focus on every click.
  - **The PDF mirrors the on-screen invoice** (`/track/[id]`): uppercase "BILL TO:" label with a green building icon (no grey box), address / phone with pin and phone icons, "ORDER NO:" label + code in a monospace bordered pill (`Courier-Bold`), calendar icon on dates, light grey (`#f1f5f9`) table headers with small uppercase grey labels (not navy), green icons on Payments History / Order Notes / Terms, plain totals with a dashed line above Net Payable, and Amount Due in red `#EF1E1E`. Icons are Lucide paths drawn with react-pdf `Svg`/`Path` (`ICON_PATHS`). When you change the screen sheet, change `sales-pdf-document.tsx` the same way and re-render it to compare.

- **Non-Admin Writes Are Limited to Own Rows, and the Admin-Table Guard Cannot Be Bypassed (audit fixes 1 & 2)**:
  - `isAdminOnlySql` (now in `src/lib/sql-scope.ts`, so the self-check can test it) matched writes only as `insert|update|delete` followed by whitespace, so `UPDATE/**/users SET role='ADMIN' ...` or ``INSERT`role_permissions`VALUES(...)`` passed, the scoper then stripped the comment, and any signed-in user could make themselves admin. `WRITE_SQL` is now `\b(insert|update|delete|replace)\b`.
  - Writes used to run unscoped, so a non-admin could `DELETE FROM prospects` or `UPDATE orders SET ...` on every row. `limitWriteToOwnRows()` now adds the table's read rule to every non-admin UPDATE / DELETE on a company table (`WHERE (rule) AND (original)`), and refuses multi-table UPDATE / DELETE, `REPLACE INTO` and `INSERT ... ON DUPLICATE KEY UPDATE` on those tables. Tables set to "All users' data" have no rule, so they stay writable in full. Read and write use the same rule: a user can change exactly the rows they can see.
  - `createProspect()` used `INSERT ... ON DUPLICATE KEY UPDATE` with a "next id" computed in the browser, so two prospects created at once overwrote each other; it is now a plain INSERT that throws when the save fails. Do not add `ON DUPLICATE KEY UPDATE` or `REPLACE` to client SQL on company tables: non-admins get 403.
  - Self-check covers the bypass strings, the limited writes and the refused shapes; the generated statements were run on MySQL in a rolled-back transaction (agent: 0 rows, owner: own rows only).

- **Report Days Are Dhaka Days, Not UTC Days (audit fix 3)**:
  - Payment dates (`advance_payments` / `payments_json`) and `status_history` timestamps are UTC ISO strings (`new Date().toISOString()`), while MySQL DATETIME text is already Dhaka time. `dashboard-finance.ts` used the first 10 characters as the day, so a payment at 00:30 on the 1st (Dhaka) counted in the previous month in Cash Collection, Advance Paid, Total Delivered and the Sales/Expenses chart, and "today" was yesterday until 06:00.
  - `businessDay(value)` (`src/lib/dashboard-finance.ts`) converts ISO values with `getMySQLTimestamp()` (Asia/Dhaka) and keeps MySQL text as is; `inRange` and the chart's `today` use it. Old rows are fixed on read; no data migration. Never bucket a timestamp by `slice(0, 10)` unless it is MySQL DATETIME text.

- **SMS Sending Checks the Role on the Server (audit fix 4)**:
  - `/api/sms/send` only checked that someone was signed in, so any role (e.g. Artist) could send up to 500 paid SMS per request. It now returns 403 unless the session is admin or the role has `perm-sms-send`, read by `getRolePermissions(role)` (`src/lib/data-scope-server.ts`: all of a role's permission ids from MySQL, 30s cache per role, fails closed). `getUnscopedTables()` now derives from it. Use `getRolePermissions` for any other server-side permission check; never trust permissions sent from the browser.

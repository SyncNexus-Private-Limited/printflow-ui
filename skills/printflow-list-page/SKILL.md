---
name: printflow-list-page
description: Guide for adding or modifying dashboard list pages in printflow-ui. Use this skill whenever the task involves creating a new entity list page, adding a data table, adding filter fields, adding form fields, adding sort columns, or adding a delete confirmation dialog to a dashboard page. Trigger on phrases like "add a list page", "create a table view", "add a filter for", "add a column to the table", "add a delete button", "delete confirmation popup", "add fields to the form", or any mention of list controls, filter drawers, data tables, or dashboard pages for a specific entity.
---

# PrintFlow List Page Skill

This skill guides you through adding or modifying a dashboard list page in printflow-ui. Every list page is meaningfully different — use this skill to stay consistent with the shared primitives while accommodating page-specific logic.

---

## 0. Read before touching anything

Before writing a single line of code, read the relevant existing files:

1. The closest existing page as a reference (e.g. `app/dashboard/expenses/` for a new financial page).
2. The shared primitives in `lib/dashboard/` and `components/dashboard/` listed in CLAUDE.md.
3. `lib/dashboard/queries.ts` to understand the query pattern for the target entity.

If the user has not named a reference page, ask which existing page is closest in structure.

---

## 1. Understand what the task actually requires

List page tasks come in several forms. Identify which applies before planning:

| Task                       | What it touches                                                     |
| -------------------------- | ------------------------------------------------------------------- |
| New list page from scratch | Page file, list controls, data table, query, types, route if needed |
| Add a filter field         | List controls component, filter state parser, query WHERE clause    |
| Add a table column         | Data table component, column definitions, query SELECT, types       |
| Add form fields            | Form component, Zod schema, route handler, DB migration possibly    |
| Add a delete CTA           | Data table row, confirmation dialog component, DELETE route handler |

For each task, scope exactly which files will change before writing any code.

---

## 2. Shared primitives — always use these, never re-implement

**Filter controls** (e.g. `*-list-controls.tsx`):

- Use `useFilterDrawer` for open/close, draft filters, pending transition, focus management.
- Render `<FilterDrawerShell>`, `<FilterTriggerButton>`, `<AppliedFilterPills>` — do not rebuild these.
- `buildAppliedFilterSummaryItems` must always prepend `{ key: "branch", label: "Branch: [name]" }` first.
- `handleApplyFilters` and `handleResetFilters` stay in the page file, not the controls component.

**Data tables** (e.g. `*-data-table.tsx`):

- Wrap with `<DataTableContainer>` (glass card) and `<TableScrollArea>` (scroll + shadow indicators).
- Column definitions use `ColumnStickyDef` — set `sticky`, `width`, and `stickyOrder` as needed.
- Call `computeStickySpecs(columns)` once; pass result through both header and row render.
- Sticky body `<td>`: use `getStickyBodyCellClass` + `getStickyBodyCellStyle`. Parent `<tr>` must have `group` class.
- Sticky header `<th>`: handled inside `SortableHeaderCell` via `stickySpec` prop.
- Pass `stickyLeftWidth={getStickyEdgeTotalWidth(columns, "left") || undefined}` to `<TableScrollArea>`.
- Never override `.table-sticky-cell` background with Tailwind bg utilities — `globals.css` handles it.

**Pages**:

- Pass `selectedBranchName={context.selectedBranchName}` to every `*ListControls`.
- Fetch data server-side via `lib/dashboard/queries.ts`. Do not inline SQL in pages or components.
- Use `getDashboardContext` to resolve branch filter and user context.

---

## 3. Adding a filter field

1. Add the field to the filter state type in `lib/dashboard/*-page-filters.ts`.
2. Add the input to the filter drawer in `*-list-controls.tsx`.
3. Add it to `buildAppliedFilterSummaryItems` in the controls component.
4. Add the WHERE clause to the relevant query in `lib/dashboard/queries.ts` using a parameterised condition.
5. Pass the new filter through from page → controls → query.

Keep filter logic in `*-page-filters.ts`, not scattered across the page and controls.

---

## 4. Adding a table column

1. Add the column to the `ColumnStickyDef` array in the data table component.
2. Add a `<col>` entry to the `<colgroup>`.
3. Add a `<SortableHeaderCell>` (or plain `<th>`) to the header row.
4. Add the `<td>` to the body row render, following the sticky pattern if the column is sticky.
5. Add the field to the SELECT in the relevant query and to the row type.

---

## 5. Adding a delete button with confirmation dialog

The delete flow has two parts: the UI confirmation and the server action.

### UI: Confirmation dialog

The dialog must require the user to type the exact word `delete` (lowercase) before the confirm button activates. This is not optional — it prevents accidental deletion. Pattern:

```tsx
// State in the row or parent component
const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
const [confirmText, setConfirmText] = useState("");

// Dialog renders when deleteTarget is set
// Confirm button disabled unless confirmText === "delete"
```

Use an existing dialog or modal pattern from `components/ui/` if one exists. Do not introduce a new dialog library.

Place the "Delete" CTA in the row's actions cell. Keep it visually distinct (destructive colour) but not prominent — it should not be the first action the eye lands on.

### Server: DELETE route handler

Create or extend a route handler under `app/api/`:

```ts
export const runtime = "nodejs";

// POST /api/<entity>/delete (or DELETE /<entity>/[id])
// 1. Validate payload with Zod safeParse
// 2. Authorize via getCurrentUser()
// 3. Branch-scope: non-admin restricted to their branchId
// 4. Execute parameterised DELETE query
// 5. Return { success: boolean, message: string }
// 6. Never leak SQL errors to the client
```

Check whether the entity has a soft-delete pattern (e.g. a `deleted_at` column) before writing a hard DELETE. Ask the user if unsure.

---

## 6. Adding form fields

1. Add the field to the Zod schema in `lib/<entity>/schema.ts`.
2. Add the input to the form component using React Hook Form's `register` or `Controller`.
3. Add server-side validation in the route handler.
4. Add the column to the INSERT/UPDATE query in `lib/<entity>/mutations.ts`.
5. If a new DB column is needed, create a migration (use the `printflow-db-migration` skill).

Never set DB-managed fields directly (`order_code`, `total_amount`, `payable_amount`, `paid_amount`, `payment_status`).

---

## 7. TypeScript and styling

- All new code must be fully typed. No `any`.
- Tailwind CSS 4: use `@import "tailwindcss"` — do not use `@tailwind` directives.
- Reference CSS variable tokens as `rgb(var(--token))`.
- Maintain dark mode compatibility — test class names against `[data-theme="dark"]` styles in `globals.css`.
- Run `npm run typecheck` before declaring work done.

---

## 8. Handoff format

After completing any list page work:

```
## List Page Handoff

### Files changed
- [path]: [what changed]

### Files NOT changed
- [confirm key adjacent files were untouched]

### How to test
1. [Step-by-step manual test — include branch filter, empty state, sort, filter apply/reset]
2. [For delete: test that button is disabled until "delete" is typed exactly]

### DB steps needed
- npm run db:migrate   (if a migration was created)

### Risks or follow-up
- [Anything the developer should watch for]
```

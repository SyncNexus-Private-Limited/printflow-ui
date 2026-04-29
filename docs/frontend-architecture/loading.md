# Loading Architecture

This file is the source of truth for loading behavior in the frontend. Read this before changing any loader behavior.

## Goal

Use the smallest loader that clearly communicates progress without stacking multiple loaders for the same action.

## Loading types in this project

### 1. Global blocking loader

Use only when the whole app must be blocked.

Use for:

- login
- logout
- rare full-app lock flows

Do not use for:

- `router.push`
- `router.replace`
- filter changes
- sort
- pagination
- branch switching

---

### 2. Route loader (`loading.tsx`)

Use for route and segment navigation in App Router.

Use for:

- page navigation
- nested route transitions
- route-level loading owned by Next.js

Do not use for:

- form submit pending
- dropdown pending
- button-level actions
- small scoped refreshes

Notes:

- `loading.tsx` is the owner of route-level loading
- avoid stacking route loader with global blocker for the same transition

---

### 3. Inline spinner

Use for small scoped pending states near the initiating control.

Use for:

- branch dropdown pending
- filter apply pending
- sort pending
- pagination pending
- compact control-level refresh feedback

Do not use for:

- full page loading
- login/logout
- every nav item by default

Notes:

- keep it local
- prefer spinner-only in tight controls
- no popup for ordinary pending state

---

### 4. Button pending state

Use for submit and mutation actions.

Use for:

- save
- create
- retry
- apply

Expected behavior:

- disable button
- show spinner in button
- change label if useful

Do not use global blocker unless the action truly needs app-wide lock

---

### 5. Region busy state

Use when one section of the page is refreshing but the whole page should stay usable.

Use for:

- tables
- cards
- results section refresh
- dashboard sub-sections

Examples:

- filter apply updates results area
- branch change refreshes dashboard content

---

## Approved loading hierarchy

Use this order of preference:

1. Inline spinner / button pending / region busy state for scoped updates
2. `loading.tsx` for route and segment transitions
3. Global blocking loader only for true app-wide blocking flows

## Decision table

| Situation               | Use                                         | Avoid               |
| ----------------------- | ------------------------------------------- | ------------------- |
| Login / logout          | Global blocking loader                      | Inline spinner only |
| Route navigation        | `loading.tsx`                               | Global blocker      |
| Nested route transition | Child `loading.tsx`                         | Global blocker      |
| Branch dropdown change  | Inline spinner                              | Global blocker      |
| Filter apply            | Button pending + optional region busy state | Global blocker      |
| Save form               | Button pending / mutation loading           | Route loader only   |
| Sort / pagination       | Inline spinner or region busy state         | Global blocker      |

## Current project decisions

- Global loader was removed from pure route transitions
- `loading.tsx` owns route-level loading
- Branch switching should use local spinner, not global blocker
- Filter Apply should use local pending UI
- Nav items should not all show spinners by default
- Shared compact spinner should be reused across local pending states
- Keep loader behavior consistent and avoid duplicate loading layers

## What not to do

- Do not show global blocker for `router.push` or `router.replace`
- Do not stack global loader + `loading.tsx` for the same transition
- Do not add popup/toast for normal pending state
- Do not show spinners everywhere
- Do not use full-page loading when only one control or region is updating
- Do not rely on redirect-driven loading if canonical href can be built up front

## Shared naming conventions

- `GlobalLoader` = full-screen blocking loader
- `RouteLoading` = shared route loading UI for `loading.tsx`
- `Spinner` = small reusable inline spinner
- `isPending` = transition pending state
- `isSubmitting` = submit/mutation pending state
- `isBusy` = region-level loading state

## Where loading code belongs

- `components/ui/spinner.tsx` = shared compact spinner
- `components/ui/route-loading.tsx` = shared route loader
- `app/**/loading.tsx` = route/segment loading only
- feature components = local pending state
- global loader files = app-wide blocking only

## Rules for new developers and AI agents

Before changing loading behavior:

1. Classify the interaction:
   - global blocking
   - route loading
   - inline spinner
   - button pending
   - region busy state

2. Use the smallest correct loader

3. Reuse existing shared components before creating new ones

4. Do not add global blockers for route/query-param transitions

5. If unsure, prefer local pending feedback over screen-wide loading

## PR checklist

Before merging:

- no duplicate loaders for the same action
- no global blocker for normal route/query updates
- pending UI appears near the initiating control where appropriate
- route loading remains owned by `loading.tsx`
- TypeScript clean
- no unused imports
- no visual jump or noisy loader behavior

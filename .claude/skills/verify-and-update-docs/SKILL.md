---
name: verify-and-update-docs
description: Use after any code modification or implementation in printflow-ui, before declaring the task done and before touching CLAUDE.md or README.md. Runs the project's static verification gates (format:check, lint, typecheck, build) plus manual/browser verification for UI changes, and only updates CLAUDE.md/README.md once everything passes. Trigger on phrases like "verify this", "test and verify", "make sure this works", "update the docs", "sync CLAUDE.md", "update readme", or as the closing step of any code change.
---

# Verify & Update Docs

This skill enforces one rule: **never document a change that hasn't been verified.** CLAUDE.md and README.md describe the app as it actually behaves — updating them off unverified code turns them into fiction. Verification always comes first; doc updates are the last step, and are skipped entirely if verification fails.

Do not run this skill's doc-update step speculatively "to save time." If a gate fails, fix the code and re-run the gates — do not edit CLAUDE.md/README.md until they're clean.

---

## 0. Scope the change

Before verifying anything, know what actually changed:

```bash
git status
git diff --stat
```

Read the diff for each changed file (`git diff -- <path>`) if you didn't author it yourself in this session. You cannot verify or document a change you haven't actually looked at.

---

## 1. Static verification gates (always required)

Run in this order. Stop at the first failure, fix it, and re-run from that gate — do not skip ahead.

```bash
npm run format:check   # or `npm run format` if you intend to reformat touched files
npm run lint
npm run typecheck
```

Then, per CLAUDE.md's Development Rules, run a build for anything beyond a trivial/isolated change — required whenever the diff touches shared or broad-impact code (`lib/dashboard/*`, `components/dashboard/*`, `middleware.ts`, `app/dashboard/layout.tsx`, auth/session code, DB query/mutation modules):

```bash
npm run build
```

For a change confined to a single leaf component or copy-only edit, `build` is optional — use judgement, and say in your report whether you ran it.

If `format:check` reports failures on files you did not touch, that's a pre-existing repo-wide condition, not something to fix as part of this task — confirm via `git diff --stat` that your own changed files are the only ones you're responsible for, note the pre-existing issue, and move on. Do not run a blanket `npm run format` across the whole repo to "fix" it unless the user explicitly asks for a formatting-only pass.

---

## 2. Runtime verification (required for UI/frontend changes)

Per CLAUDE.md's UI Rules: for anything touching a page, component, or user-facing flow, start the dev server and exercise the actual feature in a browser — golden path plus the edge cases the change affects. Passing typecheck/lint/build proves the code compiles; it does not prove the feature works.

- Check for a project-level `run` skill first and use it if present.
- If the local sandbox has no working database connection (no `DATABASE_URL` in `.env`/`.env.local`, or the DB is unreachable), you cannot log in or exercise dashboard flows. **Say so explicitly** in your report — do not claim browser verification happened when it didn't. Static verification (gate 1) still stands on its own in that case, but call out that runtime/browser verification was not possible and why.

---

## 3. DB verification (only if the change touches migrations or DB objects)

Follow CLAUDE.md's DB Workflow exactly:

```bash
npm run db:target          # confirm which environment/DB you're pointed at
npm run db:migrate -- --dry-run
```

Never run `db:migrate`, `db:rollback`, `db:seed:dev`, or `db:reset:dev` for real without explicit user confirmation and (for destructive commands) all three safety gates from CLAUDE.md's Safety Rules. This skill does not grant permission to skip those gates.

---

## 4. Gate check

Before moving to step 5, confirm:

- [ ] `format:check` clean on the files you changed (pre-existing repo-wide noise excluded)
- [ ] `lint` clean
- [ ] `typecheck` clean
- [ ] `build` run if the change touched shared/broad-impact code (or explicitly judged unnecessary)
- [ ] Browser verification done for any UI/frontend change, or explicitly noted as not possible and why
- [ ] Dry-run DB checks done if the change touches migrations/DB objects

If any required box is unchecked and unresolved, **stop here**. Report the failure and do not touch CLAUDE.md or README.md.

---

## 5. Update CLAUDE.md and README.md

Only after step 4 passes:

1. Re-read the relevant section(s) of both files — do not guess at current structure from memory.
2. Match existing tone and format exactly:
   - CLAUDE.md is organized into rule sections (`## <Area> Rules`) written as terse, prescriptive bullets aimed at a coding agent, plus a running changelog-style list near the bottom under the file map noting what each feature area "now has."
   - README.md covers the same ground in short prose sections aimed at a human contributor (setup, commands, per-feature summaries) — keep it in sync with CLAUDE.md's content, not a duplicate of its wording.
3. Extend the existing section that covers the changed area. Only add a new section if nothing existing covers it — do not restructure either file.
4. Describe the resulting behavior, not the diff. Don't write "changed X to Y" — write what's true now, the way the rest of the file does.
5. Do not invent commands, scripts, env vars, or file paths that don't exist in the repo (CLAUDE.md's own "Do Not" rule).
6. Keep changes minimal and targeted — this step documents the verified change, it is not a license for a broader documentation rewrite.

---

## 6. Report

Close with:

- Which gates ran and their result (pass/fail, or "not applicable" with a reason)
- Which gates were skipped and why (e.g., no local DB, non-UI change)
- Exactly which CLAUDE.md/README.md sections were updated, or confirmation that no doc update was needed
- If verification failed and docs were intentionally *not* updated, say so plainly

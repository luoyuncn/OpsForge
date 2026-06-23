# TUI Audit Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make audit history inspectable from the TUI primary path, with shared rich report/export formatting for CLI fallback.

**Architecture:** `@opsforge/audit` owns a deterministic report model built from stored run detail. `@opsforge/tui` renders audit history/detail state and emits keyboard actions to load/open audit runs. The no-argument TUI runtime handles those actions through the configured `AuditStore`; CLI `audit show/export` reuses the same report model.

**Tech Stack:** TypeScript, Vitest, Ink/React, existing audit/TUI/CLI packages.

---

## Design Alignment

This plan advances §7.1, §7.2, §8, and §12:

- TUI remains the primary product surface: users can type `/history` to load recent audit history and `/audit 1` through `/audit 9` to open a listed run detail without stealing normal prompt input.
- Audit reports include plan title/intent, risk/status, event order, step exits, artifact paths, verification/rollback event counts, and stored rollback availability.
- CLI audit output/export uses the same model as a secondary/scriptable surface.

Out of scope:

- Retention policy and pruning.
- Full-screen cursor navigation or pagination.
- Real Pi SDK session persistence.

---

### Task 1: Shared Audit Report Model

- [x] **Step 1: Write failing audit report tests**

Add tests for `createAuditRunReport()` and `formatAuditRunReport()` using an `AuditRunDetail` with plan, events, steps, artifacts, verification, and rollback events.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/audit test
```

Expected: fail because the report model does not exist.

- [x] **Step 3: Implement audit report model**

Create `packages/audit/src/report.ts`, export it from `index.ts`, and keep formatting deterministic.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/audit test
pnpm --filter @opsforge/audit typecheck
```

### Task 2: TUI Audit History And Detail Views

- [x] **Step 1: Write failing TUI tests**

Add tests that:

- `formatTuiSnapshot()` renders loaded audit history.
- `formatTuiSnapshot()` renders opened audit detail.
- `h` emits `audit.history.load`.
- numeric keys emit `audit.run.open` for loaded history entries.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: fail because TUI audit state/actions do not exist.

- [x] **Step 3: Implement TUI audit state/actions/views**

Add audit history/detail state, reducer events, key actions, snapshot formatting, and Ink rendering.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/tui test
pnpm --filter @opsforge/tui typecheck
```

### Task 3: Wire TUI Runtime And CLI Export

- [x] **Step 1: Write failing CLI/runtime tests**

Add tests that:

- `createTuiRuntimeActionHandler()` maps `audit.history.load` to `audit.history.loaded`.
- `createTuiRuntimeActionHandler()` maps `audit.run.open` to `audit.run.loaded`.
- `audit show` uses the rich report.
- `audit export <run_id> --out <file>` writes the rich JSON report.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/cli test
```

Expected: fail because runtime audit actions and export command do not exist.

- [x] **Step 3: Implement runtime and CLI wiring**

Extend the TUI action handler to read from `AuditStore`, update `audit show`, and add the thin `audit export` command.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/cli test
pnpm --filter @opsforge/cli typecheck
```

### Task 4: Docs, Design Check, Full Verification, Commit

- [x] **Step 1: Update docs**

Update `README.md` and `docs/implementation-status.md` with Plan 28 delivered scope and remaining non-MVP gaps.

- [x] **Step 2: Run full checks**

Run:

```bash
pnpm exec turbo run build --force
pnpm exec turbo run test --force
pnpm exec turbo run typecheck --force
```

- [x] **Step 3: Commit and push**

Commit as:

```bash
git commit -m "feat: add tui audit reports"
git push origin main
```

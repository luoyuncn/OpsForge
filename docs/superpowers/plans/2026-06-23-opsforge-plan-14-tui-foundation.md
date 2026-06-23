# TUI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the design priority by adding the first real `@opsforge/tui` package and wiring `opsforge` with no arguments to launch the TUI path.

**Architecture:** Keep CLI subcommands as secondary scriptable entry points, but route the no-argument binary path through a TUI package. The first TUI slice provides a stable Ink/React shell, a pure view-model snapshot for tests, HostFacts/provider status display, and a non-TTY fallback so CI/scripts do not hang.

**Tech Stack:** TypeScript, React, Ink, Vitest, tsup, existing `@opsforge/config` and CLI HostFacts detection.

---

## File Structure

- Create `packages/tui/package.json`
  - Defines `@opsforge/tui`, build/test/typecheck scripts, and dependencies on `ink`, `react`, `@opsforge/config`, `@opsforge/executor-base`.
- Create `packages/tui/tsconfig.json`
  - Extends the monorepo TypeScript config.
- Create `packages/tui/src/index.tsx`
  - Exports `TuiStatus`, `TuiLaunchOptions`, `createTuiStatus()`, `formatTuiSnapshot()`, `TuiApp`, and `runTui()`.
- Create `packages/tui/test/tui.test.ts`
  - Tests pure snapshot/status behavior without needing an interactive terminal.
- Modify `apps/cli/package.json`
  - Adds `@opsforge/tui` workspace dependency.
- Modify `apps/cli/src/index.ts`
  - Routes no-argument `opsforge` to TUI for TTY and to a clear fallback for non-TTY.
- Create or modify `apps/cli/test/index.test.ts`
  - Tests no-argument entry decision logic without launching an actual TUI.
- Modify `README.md`
  - Add Plan 14 and show that `opsforge` no-arg starts TUI.
- Modify `docs/implementation-status.md`
  - Add Plan 14, TUI-first roadmap, and design alignment updates.

## Task 1: Plan Document

**Files:**
- Create: `docs/superpowers/plans/2026-06-23-opsforge-plan-14-tui-foundation.md`

- [ ] **Step 1: Commit the plan**

Run:

```bash
git add docs/superpowers/plans/2026-06-23-opsforge-plan-14-tui-foundation.md
git commit -m "docs: add tui foundation plan"
```

Expected: commit succeeds.

## Task 2: TUI Package TDD

**Files:**
- Create: `packages/tui/package.json`
- Create: `packages/tui/tsconfig.json`
- Create: `packages/tui/src/index.tsx`
- Create: `packages/tui/test/tui.test.ts`

- [ ] **Step 1: Write failing TUI tests**

Add tests that assert:

- `createTuiStatus()` keeps HostFacts/provider/model values.
- `formatTuiSnapshot()` includes `Forge`, OS, elevated state, provider, package managers, and the input prompt.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: FAIL before the package implementation exists or compiles.

- [ ] **Step 3: Implement minimal TUI package**

Implement:

- `TuiStatus` as serializable TUI state.
- `formatTuiSnapshot(status)` for deterministic tests/non-TTY display.
- `TuiApp` as an Ink component rendering title, status, timeline placeholder, and input prompt.
- `runTui(options)` calling Ink `render(<TuiApp ... />)`.

- [ ] **Step 4: Run package tests**

Run:

```bash
pnpm --filter @opsforge/tui test
pnpm --filter @opsforge/tui typecheck
```

Expected: PASS.

## Task 3: CLI Entry Integration TDD

**Files:**
- Modify: `apps/cli/package.json`
- Modify: `apps/cli/src/index.ts`
- Create: `apps/cli/test/index.test.ts`

- [ ] **Step 1: Write failing CLI entry tests**

Create pure helpers in `apps/cli/src/index.ts`:

- `shouldLaunchTui(argv, stdinIsTty, stdoutIsTty)`
- `formatNoTtyFallback(snapshot)`

Tests assert:

- no args + TTY => launch TUI
- no args + non-TTY => fallback
- args present => no TUI

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @opsforge/cli test -- index.test.ts
```

Expected: FAIL until helpers and TUI dependency are wired.

- [ ] **Step 3: Wire CLI no-arg path**

Behavior:

- If `process.argv.slice(2).length === 0` and stdin/stdout are TTY, call `runTui()` with HostFacts/provider status.
- If no args but not TTY, print deterministic fallback text from `formatTuiSnapshot()`.
- If args exist, keep commander subcommands unchanged.

- [ ] **Step 4: Run CLI tests**

Run:

```bash
pnpm --filter @opsforge/cli test -- index.test.ts
pnpm --filter @opsforge/cli typecheck
```

Expected: PASS.

## Task 4: Docs and Alignment

**Files:**
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

- [ ] **Step 1: Update README**

Add Plan 14 and update useful commands with:

```bash
node apps/cli/dist/index.js
```

noting it starts the TUI path.

- [ ] **Step 2: Update implementation status**

Add:

- Plan 14 in the implemented list.
- Delivered In Plan 14.
- TUI-first roadmap:
  - Plan 14 TUI foundation.
  - Plan 15 TUI plan card.
  - Plan 16 TUI execution timeline.
  - Plan 17 TUI approvals and rollback prompt.

Update design alignment so §7.1 moves from missing to partial.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add packages/tui apps/cli/package.json apps/cli/src/index.ts apps/cli/test/index.test.ts README.md docs/implementation-status.md pnpm-lock.yaml
git commit -m "feat: add tui foundation"
```

Expected: commit succeeds.

## Task 5: Full Verification and Push

- [ ] **Step 1: Run full verification**

Run:

```bash
pnpm build
pnpm test
pnpm typecheck
```

Expected: all commands exit 0. Node 24 `node:sqlite` ExperimentalWarning is acceptable.

- [ ] **Step 2: Clean temp outputs and verify status**

Run:

```bash
Remove-Item -Recurse -Force .opsforge-tmp -ErrorAction SilentlyContinue
git status --short --branch
```

Expected: only `docs/pi_soul.md` remains untracked.

- [ ] **Step 3: Push main**

Run:

```bash
git push origin main
```

Expected: remote main receives the Plan 14 commits.

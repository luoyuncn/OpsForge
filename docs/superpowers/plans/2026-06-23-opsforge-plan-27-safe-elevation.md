# Safe Elevation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block privileged execution on non-elevated hosts with clear guidance and expose the readiness issue in doctor.

**Architecture:** Keep automatic elevation out of MVP. Core compiles and guards commands as before, allows dry-run previews, but refuses non-dry-run execution when any compiled command requires elevation and HostFacts say the process is not elevated. Doctor reports the same readiness problem in human-readable terms.

**Tech Stack:** TypeScript, Vitest, existing core/policy/CLI packages.

---

## Design Alignment

This plan advances §4.1, §4.2, §4.3, §5.2, §7.1, and §12:

- Privileged operations no longer fall through to host command failure when OpsForge already knows elevation is missing.
- Dry-run still previews compiled commands for review.
- Doctor gives explicit next-step guidance for elevated operations.

Out of scope:

- Automatic sudo password prompts.
- Windows UAC relaunch.
- Per-command sudo wrapping.

## Files

- Modify: `packages/core/src/execute.ts`
- Modify: `packages/core/test/execute.test.ts`
- Modify: `apps/cli/src/commands/doctor.ts`
- Modify: `apps/cli/test/doctor.test.ts`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

---

### Task 1: Core Elevation Gate

- [x] **Step 1: Write failing core tests**

Add tests that:

- non-dry-run execution is denied before runner calls when compiled commands require elevation and HostFacts are not elevated.
- dry-run still returns the compiled privileged commands.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/core test
```

Expected: fail because core currently lets privileged commands continue on non-elevated facts.

- [x] **Step 3: Implement elevation guard**

Add a deterministic guard after compile/command guard and before real execution. Return a denied gate with actionable guidance.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/core test
pnpm --filter @opsforge/core typecheck
```

### Task 2: Doctor Elevation Guidance

- [x] **Step 1: Write failing doctor tests**

Assert non-elevated doctor output includes `privileged operations will be blocked until OpsForge is started from an elevated shell`.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/cli test -- doctor
```

Expected: fail because doctor only reports the raw elevation state.

- [x] **Step 3: Add actionable doctor warning**

Keep existing facts reporting and add a more specific readiness warning.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/cli test
pnpm --filter @opsforge/cli typecheck
```

### Task 3: Docs, Full Verification, Commit

- [x] **Step 1: Update docs**

Record Plan 27 and update remaining gaps.

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
git commit -m "feat: block unsafe elevation"
git push origin main
```

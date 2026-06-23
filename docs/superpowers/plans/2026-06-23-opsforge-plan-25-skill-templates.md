# Skill Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class deterministic skill templates for common local operations and feed them into the planner/TUI path.

**Architecture:** Keep templates deterministic in `@opsforge/planner` so the no-argument TUI runtime and CLI planner use the same fallback behavior. Check in human-readable skill template files under `skills/` for documentation and future Pi skill ingestion. Provider adapters include compact template guidance in their planning prompts without executing anything.

**Tech Stack:** TypeScript, Vitest, existing planner/CLI/TUI runtime path.

---

## Design Alignment

This plan advances §6.2, §9, and §12:

- Adds `install-nginx`, `install-docker`, and `install-nodejs` templates.
- Keeps templates as DSL plan skeletons, not free shell scripts.
- Surfaces templates through the planner path used by TUI prompt submission.

Out of scope:

- Real Pi skill ingestion.
- Remote inventory-aware skill selection.
- Provider-specific tool-call APIs.

## Files

- Create: `packages/planner/src/skill-templates.ts`
- Modify: `packages/planner/src/mock.ts`
- Modify: `packages/planner/src/openai-compatible.ts`
- Modify: `packages/planner/src/anthropic.ts`
- Modify: `packages/planner/src/google.ts`
- Modify: `packages/planner/src/index.ts`
- Modify: `packages/planner/test/planner.test.ts`
- Create: `skills/install-nginx/skill.md`
- Create: `skills/install-docker/skill.md`
- Create: `skills/install-nodejs/skill.md`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

---

### Task 1: Deterministic Skill Template Registry

- [x] **Step 1: Write failing planner tests**

Add tests that:

- `findSkillTemplateForPrompt("install docker")` returns `install-docker`.
- The mock provider uses `install-docker` to include package install, service enable/start, service-status verification, and rollback.
- Missing template prompts still fall back to generic package install.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/planner test
```

Expected: fail because `findSkillTemplateForPrompt` does not exist and mock provider still emits generic plans.

- [x] **Step 3: Implement template registry**

Add `skill-templates.ts` with deterministic `install-nginx`, `install-docker`, and `install-nodejs` skeletons plus prompt matching helpers.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/planner test
pnpm --filter @opsforge/planner typecheck
```

### Task 2: Provider Prompt Template Context

- [x] **Step 1: Write failing provider prompt tests**

Assert OpenAI-compatible, Anthropic, and Google provider request bodies include the skill template names and preserve the original user prompt.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/planner test
```

Expected: fail because provider prompts do not include template context yet.

- [x] **Step 3: Add compact skill prompt guidance**

Build a shared `buildPlannerPrompt()` helper and use it in all provider adapters.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/planner test
pnpm --filter @opsforge/planner typecheck
```

### Task 3: Checked-In Skill Docs And Project Docs

- [x] **Step 1: Add skill docs**

Create `skills/install-nginx/skill.md`, `skills/install-docker/skill.md`, and `skills/install-nodejs/skill.md` describing deterministic DSL skeletons.

- [x] **Step 2: Update status docs**

Record Plan 25 in README and implementation status, including the remaining gaps count.

- [x] **Step 3: Run full checks**

Run:

```bash
pnpm exec turbo run build --force
pnpm exec turbo run test --force
pnpm exec turbo run typecheck --force
```

- [x] **Step 4: Commit and push**

Commit as:

```bash
git commit -m "feat: add planner skill templates"
git push origin main
```

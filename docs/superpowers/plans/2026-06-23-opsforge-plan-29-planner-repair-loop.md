# Planner Repair Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic planner validation repair loop so TUI prompt submissions can recover from first-pass invalid DSL output.

**Architecture:** Keep provider adapters simple. `buildPlanFromPrompt()` remains the schema boundary: it validates provider output, and when validation fails it calls the same provider again with a repair prompt containing the zod issues and previous JSON payload. The final output still goes through `PlanSchema` before reaching TUI/runtime/core.

**Tech Stack:** TypeScript, Vitest, existing planner package.

---

## Design Alignment

This plan advances §6.2, §6.3, §7.1, §12, and risk §7:

- TUI planning becomes more reliable without weakening schema validation.
- Model/provider output is still rejected unless the final object validates through the DSL.
- Repair prompting is provider-neutral and works for OpenAI-compatible, Anthropic, Google, mock, and future Pi providers.

Out of scope:

- Provider-native tool-call retries.
- Invalid raw JSON repair inside individual HTTP adapters.
- Live model discovery.

---

### Task 1: Planner Repair Retry

- [x] **Step 1: Write failing planner tests**

Add tests that:

- `buildPlanFromPrompt()` retries once after invalid DSL output and returns the repaired Plan.
- the repair request includes validation errors and previous output.
- it still throws `PlannerValidationError` after the configured attempt budget is exhausted.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/planner test
```

Expected: fail because `buildPlanFromPrompt()` currently calls the provider once.

- [x] **Step 3: Implement repair loop**

Add `maxRepairAttempts?: number`, default it to `1`, and keep the final schema validation as the only success path.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/planner test
pnpm --filter @opsforge/planner typecheck
```

### Task 2: Docs, Full Verification, Commit

- [x] **Step 1: Update docs**

Update `README.md` and `docs/implementation-status.md` with Plan 29 and the reduced provider gap.

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
git commit -m "feat: add planner repair loop"
git push origin main
```

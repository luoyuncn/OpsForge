# Pi Runtime Event Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a typed `@opsforge/pi-runtime` event bridge so headless Pi/core events can feed the TUI reducer without exposing raw bash or bypassing the existing safety pipeline.

**Architecture:** Create a small runtime package that owns provider/session/event vocabulary and a pure event normalizer. Keep TUI-specific adaptation inside `@opsforge/tui`, so dependencies remain aligned with the design: `tui -> pi-runtime`, not the other way around.

**Tech Stack:** TypeScript, Vitest, existing `@opsforge/core`, `@opsforge/dsl`, `@opsforge/executor-base`, and `@opsforge/tui`.

---

## Design Alignment

This plan advances §6.2 and §6.3:

- defines structured OpsForge runtime events for thinking, plan, approval, execution, rollback, and errors
- keeps execution behind the existing core pipeline
- gives the TUI a stable adapter for event-stream rendering
- does not register or expose raw Pi bash/write/edit tools

Out of scope:

- real Pi SDK authentication/session manager
- real provider calls
- executing approval/rollback decisions

## Files

- Create: `packages/pi-runtime/package.json`
- Create: `packages/pi-runtime/tsconfig.json`
- Create: `packages/pi-runtime/src/index.ts`
- Create: `packages/pi-runtime/src/events.ts`
- Create: `packages/pi-runtime/test/events.test.ts`
- Create: `packages/tui/src/runtime-adapter.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `packages/tui/test/tui.test.ts`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

---

### Task 1: Runtime Event Model

- [ ] **Step 1: Write failing pi-runtime tests**

Add tests for `createRuntimeSessionStatus()` and `normalizeRuntimeEvent()`.

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
pnpm --filter @opsforge/pi-runtime test
```

Expected: fail because the runtime event module does not exist.

- [ ] **Step 3: Implement runtime event model**

Create a narrow event union:

- `runtime.session.started`
- `runtime.thinking.delta`
- `runtime.plan.ready`
- `runtime.approval.requested`
- `runtime.execution.finished`
- `runtime.rollback.requested`
- `runtime.error`

The normalizer should preserve payloads and produce deterministic event summaries.

- [ ] **Step 4: Run focused test and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/pi-runtime test
```

Expected: pass.

---

### Task 2: TUI Adapter

- [ ] **Step 1: Write failing TUI adapter tests**

Add tests that convert runtime events into existing `TuiEvent` values and reduce them into renderable state.

- [ ] **Step 2: Run focused TUI tests and verify RED**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: fail because the adapter is missing.

- [ ] **Step 3: Implement adapter**

Create `runtimeEventToTuiEvent()` in `packages/tui/src/runtime-adapter.ts`. Error/session events may be ignored by the reducer for now, but thinking/plan/execution/approval/rollback must map into existing TUI events.

- [ ] **Step 4: Run focused TUI tests and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/tui test
```

Expected: pass.

---

### Task 3: Documentation And Verification

- [ ] **Step 1: Update README and implementation status**

Record Plan 19 and update §6/§7 alignment notes.

- [ ] **Step 2: Run package checks**

Run:

```bash
pnpm --filter @opsforge/pi-runtime test
pnpm --filter @opsforge/pi-runtime typecheck
pnpm --filter @opsforge/tui test
pnpm --filter @opsforge/tui typecheck
```

- [ ] **Step 3: Run full checks**

Run:

```bash
pnpm build
pnpm test
pnpm typecheck
```

- [ ] **Step 4: Commit and push**

Commit as:

```bash
git commit -m "feat: add pi runtime event bridge"
git push origin main
```

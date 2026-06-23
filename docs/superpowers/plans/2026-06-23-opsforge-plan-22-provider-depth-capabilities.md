# Provider Depth And Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Anthropic and Google planner adapters plus provider capability reporting so OpsForge no longer treats OpenAI-compatible as the only implemented provider path.

**Architecture:** Keep provider-specific HTTP logic in `@opsforge/planner`, keep config/env resolution in `@opsforge/config` and `apps/cli/src/provider.ts`, and expose doctor capability summaries in the CLI. All provider tests use mocked `fetch`; no real network calls.

**Tech Stack:** TypeScript, Vitest, existing planner/config/CLI packages.

---

## Design Alignment

This plan advances §6.1 and §13:

- OpenAI-compatible remains configurable by base URL
- Anthropic and Google provider paths become implemented
- provider capability checks become visible in `opsforge doctor`
- weak structured output remains a known follow-up rather than hidden

Out of scope:

- real Pi native provider login
- model list discovery
- provider retry/repair loop

## Files

- Create: `packages/planner/src/anthropic.ts`
- Create: `packages/planner/src/google.ts`
- Create: `packages/planner/src/capabilities.ts`
- Modify: `packages/planner/src/index.ts`
- Modify: `packages/planner/test/planner.test.ts`
- Modify: `apps/cli/src/provider.ts`
- Modify: `apps/cli/src/commands/config.ts`
- Modify: `apps/cli/src/commands/doctor.ts`
- Modify: `apps/cli/test/config.test.ts`
- Create: `apps/cli/test/provider.test.ts`
- Modify: `apps/cli/test/doctor.test.ts`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

---

### Task 1: Provider Adapters

- [x] **Step 1: Write failing planner tests**

Add mocked-fetch tests for Anthropic `/v1/messages` and Google `generateContent` responses.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/planner test
```

Expected: fail because adapters are missing.

- [x] **Step 3: Implement adapters and exports**

Adapters should parse provider text content as JSON and surface typed provider errors.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/planner test
pnpm --filter @opsforge/planner typecheck
```

---

### Task 2: CLI Resolution And Doctor Capabilities

- [x] **Step 1: Write failing CLI tests**

Add tests for configuring Anthropic/Google providers, resolving configured providers, and formatting provider capabilities in doctor.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/cli test
```

- [x] **Step 3: Implement resolver/config/doctor updates**

Support `anthropic` and `google` in `resolvePlanProvider()` and `opsforge config provider`.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/cli test
pnpm --filter @opsforge/cli typecheck
```

---

### Task 3: Docs, Verification, Commit

- [x] **Step 1: Update docs**

Record Plan 22 and update provider design alignment.

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
git commit -m "feat: add provider depth"
git push origin main
```

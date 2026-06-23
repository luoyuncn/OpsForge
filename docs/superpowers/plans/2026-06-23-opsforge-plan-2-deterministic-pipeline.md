# OpsForge Plan 2 — Deterministic Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic local execution pipeline foundation: policy, executors, verifier, audit events, core orchestration, and a scriptable `opsforge apply <plan.json>` CLI path.

**Architecture:** This plan implements the non-LLM safety spine from the design: `Plan(DSL) -> policy classify/gate -> executor compile -> guard -> execute -> verify -> audit`. Execution is injectable and test-first so unit tests never modify the host. CLI defaults to dry/safe behavior for risky plans and requires explicit `--yes` for L2/L3 execution.

**Tech Stack:** TypeScript, pnpm workspace, Turbo, tsup, vitest, zod, commander.

**Spec Coverage:** `docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md` §4 execution pipeline, §4.1 executor abstraction, §4.2/§4.3 Linux/Windows compilation, §5 policy/guards, §7.2 CLI apply/dry-run flags, §8 audit event model, §11 test strategy.

**Branch:** `main` (explicit user instruction for this goal).

---

## File Structure

```text
packages/
├─ policy/
│  ├─ package.json  tsconfig.json
│  ├─ src/{index,risk,command-guard,path-guard,gate}.ts
│  └─ test/policy.test.ts
├─ executor-base/
│  ├─ package.json  tsconfig.json
│  ├─ src/{index,types,runner}.ts
│  └─ test/runner.test.ts
├─ executor-linux/
│  ├─ package.json  tsconfig.json
│  ├─ src/{index,compile,executor}.ts
│  └─ test/compile.test.ts
├─ executor-windows/
│  ├─ package.json  tsconfig.json
│  ├─ src/{index,compile,executor}.ts
│  └─ test/compile.test.ts
├─ verifier/
│  ├─ package.json  tsconfig.json
│  ├─ src/{index,verify}.ts
│  └─ test/verify.test.ts
├─ audit/
│  ├─ package.json  tsconfig.json
│  ├─ src/{index,events,memory}.ts
│  └─ test/audit.test.ts
└─ core/
   ├─ package.json  tsconfig.json
   ├─ src/{index,ids,execute}.ts
   └─ test/execute.test.ts
apps/cli/
├─ src/commands/apply.ts
├─ src/index.ts
└─ test/apply.test.ts
docs/
└─ implementation-status.md
```

---

## Task 1: `@opsforge/policy`

**Files:**
- Create: `packages/policy/package.json`, `packages/policy/tsconfig.json`
- Create: `packages/policy/src/risk.ts`, `packages/policy/src/command-guard.ts`, `packages/policy/src/path-guard.ts`, `packages/policy/src/gate.ts`, `packages/policy/src/index.ts`
- Test: `packages/policy/test/policy.test.ts`

- [ ] **Step 1: Write failing tests**

Expected API:

```ts
import { classifyPlanRisk, guardCommand, guardStepPath, evaluateGate } from "../src/index";
```

Test cases:
- `package-install` stays L1.
- `file-write` to `/etc/sudoers` becomes blocked by path guard.
- `shell` is L3 and blocked unless `allowShell: true`.
- command guard blocks `curl https://x | sh` and `rm -rf /`.
- gate allows L0/L1 automatically, denies L2/L3 unless `yes` is true and `riskMax` permits it.

Run: `pnpm --filter @opsforge/policy test`
Expected: FAIL because `../src/index` does not exist.

- [ ] **Step 2: Implement deterministic policy**

Implementation requirements:
- Risk ordering helper: `L0 < L1 < L2 < L3`.
- Step risk rules: service/package install/remove/start/stop/enable = L1, status = L0, file write/template = L2, shell = L3.
- Path guard protects `/etc/sudoers`, `/root/.ssh`, `/etc/ssh/sshd_config`, `/usr/lib/systemd/system`, `C:\Windows\System32`, `HKLM:\SYSTEM`.
- Command guard blocks shell pipelines that download and execute, `rm -rf /`, `Remove-Item -Recurse -Force C:\Windows`, sudoers/sshd edits.
- Gate returns `{ allowed, reason }`, never prompts.

- [ ] **Step 3: Verify**

Run:
```bash
pnpm --filter @opsforge/policy test
pnpm --filter @opsforge/policy typecheck
pnpm --filter @opsforge/policy build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/policy pnpm-lock.yaml
git commit -m "feat(policy): deterministic risk, gate, and guard checks"
```

---

## Task 2: Executor Contracts And Compilers

**Files:**
- Create: `packages/executor-base/**`
- Create: `packages/executor-linux/**`
- Create: `packages/executor-windows/**`

- [ ] **Step 1: Write failing executor tests**

Expected APIs:

```ts
import type { HostFacts, CompiledCommand, CommandRunner } from "@opsforge/executor-base";
import { createLinuxExecutor } from "../src/index";
import { createWindowsExecutor } from "../src/index";
```

Test cases:
- base `runCompiledCommand` returns stdout/stderr/exitCode and truncates long output.
- Linux compiles `package-install nginx` to `apt-get install -y nginx` when facts include `apt`.
- Linux compiles `service-start nginx` to `systemctl start nginx`.
- Windows compiles `package-install nginx` to `winget install --id nginx --silent` when facts include `winget`.
- Windows compiles `service-start nginx` to `Start-Service -Name nginx`.

Run:
```bash
pnpm --filter @opsforge/executor-base test
pnpm --filter @opsforge/executor-linux test
pnpm --filter @opsforge/executor-windows test
```

Expected: FAIL because packages do not exist.

- [ ] **Step 2: Implement contracts**

`executor-base` exports:
- `HostFacts`
- `CompiledCommand`
- `RawCommandResult`
- `StepResult`
- `CommandRunner`
- `Executor`
- `runCompiledCommand(step, command, runner, opts)`

- [ ] **Step 3: Implement compilers**

Linux:
- package manager priority: `apt`, `dnf`, `yum`.
- services: `systemctl`.
- shell step: provided shell or `bash`.

Windows:
- package manager priority: `winget`, `choco`.
- services: PowerShell service cmdlets.
- shell step: PowerShell.

- [ ] **Step 4: Verify**

Run:
```bash
pnpm --filter @opsforge/executor-base test
pnpm --filter @opsforge/executor-linux test
pnpm --filter @opsforge/executor-windows test
pnpm --filter @opsforge/executor-base typecheck
pnpm --filter @opsforge/executor-linux typecheck
pnpm --filter @opsforge/executor-windows typecheck
pnpm --filter @opsforge/executor-base build
pnpm --filter @opsforge/executor-linux build
pnpm --filter @opsforge/executor-windows build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/executor-base packages/executor-linux packages/executor-windows pnpm-lock.yaml
git commit -m "feat(executor): base contracts plus linux and windows compilers"
```

---

## Task 3: `@opsforge/verifier` And `@opsforge/audit`

**Files:**
- Create: `packages/verifier/**`
- Create: `packages/audit/**`

- [ ] **Step 1: Write failing tests**

Verifier expected API:

```ts
import { verifyPlan } from "../src/index";
```

Test cases:
- `smoke-test` passes when runner exit code matches `expectExit` or default `0`.
- `file-checksum` passes when injected file reader returns matching sha256 content.
- failed verification includes message and original verification spec.

Audit expected API:

```ts
import { createMemoryAuditRecorder } from "../src/index";
```

Test cases:
- appends events in order.
- returns immutable snapshot.

Run:
```bash
pnpm --filter @opsforge/verifier test
pnpm --filter @opsforge/audit test
```

Expected: FAIL because packages do not exist.

- [ ] **Step 2: Implement verifier**

Implement deterministic verification with injected dependencies:
- `runCommand(cmd)` for smoke tests.
- `readFile(path)` for checksums.
- Unsupported verification types return failed result with `unsupported verification`.

- [ ] **Step 3: Implement audit event model**

Export event union matching the design names:
- `plan.created`
- `plan.classified`
- `gate.confirmed`
- `job.dispatched`
- `run.step.started`
- `run.step.finished`
- `run.verified`
- `run.rollback.started`
- `run.rollback.finished`

Use an in-memory recorder for Plan 2; SQLite implementation remains a later storage adapter.

- [ ] **Step 4: Verify and commit**

Run:
```bash
pnpm --filter @opsforge/verifier test
pnpm --filter @opsforge/audit test
pnpm --filter @opsforge/verifier typecheck
pnpm --filter @opsforge/audit typecheck
pnpm --filter @opsforge/verifier build
pnpm --filter @opsforge/audit build
```

Commit:
```bash
git add packages/verifier packages/audit pnpm-lock.yaml
git commit -m "feat(verifier,audit): deterministic verification and audit events"
```

---

## Task 4: `@opsforge/core`

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`
- Create: `packages/core/src/ids.ts`, `packages/core/src/execute.ts`, `packages/core/src/index.ts`
- Test: `packages/core/test/execute.test.ts`

- [ ] **Step 1: Write failing tests**

Expected API:

```ts
import { executePlan } from "../src/index";
```

Test cases:
- dry-run classifies, gates, compiles, guards, audits, and does not call runner.
- L2/L3 plans are denied without `yes`.
- allowed plan executes steps, verifies, and records audit events in order.

Run: `pnpm --filter @opsforge/core test`
Expected: FAIL because package does not exist.

- [ ] **Step 2: Implement core orchestration**

`executePlan(input)` accepts:
- `plan`
- `executor`
- `facts`
- `runner`
- `audit`
- `dryRun`
- `yes`
- `riskMax`
- `allowShell`
- `verifyDeps`

Return:
- `runId`
- `risk`
- `gate`
- `commands`
- `stepResults`
- `verificationResults`
- `auditEvents`

- [ ] **Step 3: Verify and commit**

Run:
```bash
pnpm --filter @opsforge/core test
pnpm --filter @opsforge/core typecheck
pnpm --filter @opsforge/core build
```

Commit:
```bash
git add packages/core pnpm-lock.yaml
git commit -m "feat(core): orchestrate deterministic plan execution pipeline"
```

---

## Task 5: CLI `apply <plan.json>`

**Files:**
- Create: `apps/cli/src/commands/apply.ts`
- Modify: `apps/cli/src/index.ts`, `apps/cli/package.json`
- Test: `apps/cli/test/apply.test.ts`

- [ ] **Step 1: Write failing tests**

Expected API:

```ts
import { buildApplyCommand, formatApplyResult } from "../src/commands/apply";
```

Test cases:
- dry-run JSON plan prints compiled commands and does not execute runner.
- risky file write without `--yes` returns denied gate result.

Run: `pnpm --filter @opsforge/cli test`
Expected: FAIL because apply command module does not exist.

- [ ] **Step 2: Implement command**

CLI behavior:
- `opsforge apply <plan.json>`
- flags: `--dry-run`, `--yes/-y`, `--json`, `--risk-max <L0|L1|L2|L3>`, `--allow-shell`
- Reads and validates JSON via `parsePlan`.
- Selects Linux or Windows executor from detected platform.
- Uses real child process runner only when not dry-run and gate allows execution.
- Human format shows risk, gate, compiled commands, step result count, verification result count.

- [ ] **Step 3: Verify and commit**

Run:
```bash
pnpm --filter @opsforge/cli test
pnpm --filter @opsforge/cli typecheck
pnpm --filter @opsforge/cli build
```

Commit:
```bash
git add apps/cli pnpm-lock.yaml
git commit -m "feat(cli): apply JSON plans through deterministic pipeline"
```

---

## Task 6: Documentation, Alignment Check, And Full Verification

**Files:**
- Create: `docs/implementation-status.md`
- Modify: `README.md`

- [ ] **Step 1: Document current implementation status**

`docs/implementation-status.md` must include:
- Plan 1 delivered foundation.
- Plan 2 delivered deterministic pipeline.
- Explicit gaps: LLM planner, Pi runtime, TUI, SQLite audit adapter, rollback command, provider config commands, skill templates.
- Design alignment check against spec sections.

- [ ] **Step 2: Update README**

Add a short “Current implementation status” section pointing to:
- design spec
- Plan 1
- Plan 2
- implementation status

- [ ] **Step 3: Full verification**

Run:
```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
node apps/cli/dist/index.js doctor
node apps/cli/dist/index.js --help
```

Create a dry-run sample plan and run:
```bash
node apps/cli/dist/index.js apply examples/plan-install-nginx.local.json --dry-run
```

Expected: all commands pass; dry-run prints compiled commands and does not execute install.

- [ ] **Step 4: Final commit and push**

```bash
git add docs README.md examples pnpm-lock.yaml
git commit -m "docs: record Plan 2 pipeline status and alignment"
git push origin main
```

---

## Done Definition

- `pnpm build`, `pnpm test`, and `pnpm typecheck` pass.
- CLI keeps existing `doctor` behavior.
- `opsforge apply <plan.json> --dry-run` compiles a valid plan without executing host mutations.
- Policy blocks dangerous commands/paths and denies L2/L3 without explicit `--yes`.
- Core emits ordered audit events for classification, gate, dispatch, step execution, and verification.
- Documentation states what now matches the design and what remains for later plans.

## Known Gaps After Plan 2

- Audit storage is in-memory only; SQLite adapter is deferred to a storage-focused plan.
- Real privilege detection remains in `doctor` only at a shallow level.
- Rollback orchestration is not yet exposed as `opsforge rollback`.
- Planner/Pi/TUI are still future plans.

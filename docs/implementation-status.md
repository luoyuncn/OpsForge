# OpsForge Implementation Status

Last updated: 2026-06-23

## Current Baseline

OpsForge is being implemented directly on `main` in plan-sized slices. Each plan should leave the repository buildable, tested, documented, and explicitly checked against the design spec.

Authoritative design:

- `docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md`

Implemented plans:

- Plan 1: `docs/superpowers/plans/2026-06-23-opsforge-plan-1-foundation.md`
- Plan 2: `docs/superpowers/plans/2026-06-23-opsforge-plan-2-deterministic-pipeline.md`
- Plan 3: `docs/superpowers/plans/2026-06-23-opsforge-plan-3-audit-persistence.md`
- Plan 4: `docs/superpowers/plans/2026-06-23-opsforge-plan-4-planner-provider-scaffold.md`
- Plan 5: `docs/superpowers/plans/2026-06-23-opsforge-plan-5-json-schema-plan-output.md`

## Delivered In Plan 1

- pnpm + Turbo TypeScript monorepo skeleton.
- `@opsforge/shared` with base error, logger, and output truncation.
- `@opsforge/dsl` with zod Plan/Step/Precheck/Verification schemas and inferred TypeScript types.
- `@opsforge/config` with default config loading and provider inference.
- `@opsforge/cli` with `opsforge` / `ops` bins and `doctor`.

## Delivered In Plan 2

- `@opsforge/policy`
  - Deterministic step risk classifier.
  - Non-interactive gate decision for `riskMax` and `--yes`.
  - Command guard for download-and-execute, destructive root removal, and protected system edits.
  - Path guard for high-risk Linux and Windows paths.

- `@opsforge/executor-base`
  - `HostFacts`, `CompiledCommand`, `StepResult`, `Executor`, and injectable `CommandRunner`.
  - `runCompiledCommand` wrapper with output truncation.

- `@opsforge/executor-linux`
  - Pure compiler for apt/dnf/yum package operations, systemd service operations, file write/template placeholders, and shell steps.

- `@opsforge/executor-windows`
  - Pure compiler for winget/choco package operations, PowerShell service operations, file write/template placeholders, and shell steps.

- `@opsforge/verifier`
  - Injected-dependency verifier for `smoke-test` and `file-checksum`.
  - Unsupported verification types fail explicitly instead of silently passing.

- `@opsforge/audit`
  - Design-aligned audit event union.
  - In-memory append-only recorder for tests and early core integration.

- `@opsforge/core`
  - Deterministic `executePlan` orchestration:
    `classify -> gate -> compile -> guard -> dry-run/execute -> verify -> audit`.

- `@opsforge/cli`
  - `opsforge apply <plan.json>` with `--dry-run`, `--yes`, `--json`, `--risk-max`, and `--allow-shell`.
  - Dry-run path compiles and checks plans without executing host mutation commands.

## Delivered In Plan 3

- `@opsforge/audit`
  - SQLite-backed `AuditStore` with `plans`, `runs`, `step_runs`, and `audit_events`.
  - Append-only event persistence plus run list/detail summaries.
  - stdout/stderr artifact writing under `artifacts/<run_id>/`.
  - `resolveOpsForgePaths()` expands `~` for configured audit paths.
  - Uses Node 24 built-in `node:sqlite` instead of `better-sqlite3`; this keeps the SQLite storage semantics from §8.1 while avoiding the native ClangCL toolchain requirement observed on the current Windows development host.

- `@opsforge/cli`
  - `opsforge apply` records audit history to SQLite by default.
  - Tests can inject an `AuditStore` to avoid writing to user home.
  - `opsforge audit ls` lists persisted runs.
  - `opsforge audit show <run_id>` shows persisted events and step artifact paths.

## Delivered In Plan 4

- `@opsforge/planner`
  - Provider-independent `PlanProvider` interface for natural-language planning.
  - `buildPlanFromPrompt()` validates provider output through the DSL schema before returning a Plan.
  - Stable `PlannerValidationError` for invalid provider output.
  - Deterministic mock provider that generates install plans such as `install nginx`.

- `@opsforge/cli`
  - `opsforge plan "<NL>"` emits a compact human-readable Plan summary.
  - `opsforge plan "<NL>" --json` emits schema-valid Plan JSON.
  - Plan generation is non-mutating and does not call host executors.

## Delivered In Plan 5

- `@opsforge/dsl`
  - `createPlanJsonSchema()` exports JSON Schema from the zod Plan schema.
  - `planJsonSchema` provides a runtime singleton for provider/tooling consumers.
  - `schemas/plan.schema.json` is checked in and verified against the runtime export.

- `@opsforge/cli`
  - `opsforge plan "<NL>" --out <file>` writes schema-valid Plan JSON to disk.
  - Saved plan files can be consumed by `opsforge apply <file> --dry-run`.
  - Plan file writing remains non-mutating with respect to host operations.

## Design Alignment Check

| Spec Area | Status | Evidence | Notes |
|---|---:|---|---|
| §3 DSL | Partial | `packages/dsl`, `schemas/plan.schema.json` | Core schema and Plan JSON Schema export exist. Job/approval/inventory/audit schema artifacts remain. |
| §4 Core pipeline | Partial | `packages/core/src/execute.ts` | Deterministic spine exists; rollback orchestration is not implemented yet. |
| §4.1 Executor abstraction | Partial | `packages/executor-base` | Interfaces and injectable runner exist. Real host detection is still shallow. |
| §4.2 Linux executor | Partial | `packages/executor-linux` | Compile layer exists for apt/dnf/yum and systemd. Real safe file writing needs a later pass. |
| §4.3 Windows executor | Partial | `packages/executor-windows` | Compile layer exists for winget/choco and services. UAC/admin detection remains open. |
| §5 Policy and guard | Partial | `packages/policy` | Deterministic classifier/gate/guards exist. More rules and config knobs are needed. |
| §6 Planner/provider layer | Partial | `packages/planner` | Provider boundary, DSL validation, and mock provider exist. Real OpenAI/Anthropic/Google/Pi adapters, JSON retry, and Pi sessions remain. |
| §7.2 CLI mode | Partial | `apps/cli/src/commands` | `doctor`, `plan`, `plan --out`, `apply`, and `audit ls/show` exist. `run/verify/rollback/config` remain. |
| §8 Audit | Partial | `packages/audit` | SQLite event store and stdout/stderr artifacts exist. Rich reports, retention/export, rollback audit views, and TUI timeline consumption remain. |
| §11 Tests | Partial | package tests | Unit tests cover deterministic components and do not mutate the host. |

## Known Gaps

- Real LLM planner adapters and Pi runtime are not implemented.
- Planner JSON-mode retry/tool-call retry loops are not implemented.
- TUI primary entry is not implemented; bare `opsforge` still prints a placeholder.
- Rollback orchestration and CLI `rollback` are not implemented.
- CLI `run`, `verify`, and `config` subcommands are not implemented.
- Audit retention/export and richer report generation are not implemented.
- TUI timeline consumption of audit history is not implemented.
- Provider configuration commands, real provider adapters, and model capability checks are not implemented.
- Only the Plan JSON Schema artifact is exported; job, approval, inventory, and audit schema artifacts remain.
- Generated plans are persisted as files, not yet in a first-class plan registry.
- Real elevated privilege detection and safe elevation flows are incomplete.
- Skill templates such as install-nginx/install-docker/install-nodejs are not implemented.

## Next Plan Recommendation

Plan 6 should focus on either:

1. provider configuration commands and a real OpenAI-compatible planner adapter with mocked HTTP tests, or
2. CLI `run "<NL>"` as a composed `plan -> gate -> apply` flow using the existing mock planner and dry-run-safe execution path.

The safer next slice is CLI `run "<NL>" --dry-run` because it connects existing planner and executor pieces without introducing live LLM credentials yet.

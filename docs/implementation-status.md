# OpsForge Implementation Status

Last updated: 2026-06-23

## Current Baseline

OpsForge is being implemented directly on `main` in plan-sized slices. Each plan should leave the repository buildable, tested, documented, and explicitly checked against the design spec.

Authoritative design:

- `docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md`

Implemented plans:

- Plan 1: `docs/superpowers/plans/2026-06-23-opsforge-plan-1-foundation.md`
- Plan 2: `docs/superpowers/plans/2026-06-23-opsforge-plan-2-deterministic-pipeline.md`

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

## Design Alignment Check

| Spec Area | Status | Evidence | Notes |
|---|---:|---|---|
| §3 DSL | Partial | `packages/dsl` | Core schema exists; JSON Schema export is still missing. |
| §4 Core pipeline | Partial | `packages/core/src/execute.ts` | Deterministic spine exists; rollback orchestration is not implemented yet. |
| §4.1 Executor abstraction | Partial | `packages/executor-base` | Interfaces and injectable runner exist. Real host detection is still shallow. |
| §4.2 Linux executor | Partial | `packages/executor-linux` | Compile layer exists for apt/dnf/yum and systemd. Real safe file writing needs a later pass. |
| §4.3 Windows executor | Partial | `packages/executor-windows` | Compile layer exists for winget/choco and services. UAC/admin detection remains open. |
| §5 Policy and guard | Partial | `packages/policy` | Deterministic classifier/gate/guards exist. More rules and config knobs are needed. |
| §7.2 CLI mode | Partial | `apps/cli/src/commands/apply.ts` | `doctor` and `apply` exist. `plan/run/verify/rollback/audit/config` remain. |
| §8 Audit | Partial | `packages/audit` | Event model exists. SQLite and artifacts are not implemented yet. |
| §11 Tests | Partial | package tests | Unit tests cover deterministic components and do not mutate the host. |

## Known Gaps

- LLM planner and Pi runtime are not implemented.
- TUI primary entry is not implemented; bare `opsforge` still prints a placeholder.
- Audit persistence is not SQLite yet.
- Artifacts directory handling is not implemented.
- Rollback orchestration and CLI `rollback` are not implemented.
- CLI `plan`, `run`, `verify`, `audit`, and `config` subcommands are not implemented.
- Provider configuration commands and model capability checks are not implemented.
- JSON Schema export from DSL is not implemented.
- Real elevated privilege detection and safe elevation flows are incomplete.
- Skill templates such as install-nginx/install-docker/install-nodejs are not implemented.

## Next Plan Recommendation

Plan 3 should focus on either:

1. Audit persistence and CLI audit commands (`better-sqlite3` + artifacts), or
2. Planner/provider layer for `opsforge plan` with schema-valid mocked provider first.

The safer next slice is audit persistence because it strengthens the execution spine before LLM or TUI work begins.

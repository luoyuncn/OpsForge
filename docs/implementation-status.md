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
- Plan 6: `docs/superpowers/plans/2026-06-23-opsforge-plan-6-cli-run-flow.md`
- Plan 7: `docs/superpowers/plans/2026-06-23-opsforge-plan-7-provider-config-openai-adapter.md`
- Plan 8: `docs/superpowers/plans/2026-06-23-opsforge-plan-8-rollback-command.md`
- Plan 9: `docs/superpowers/plans/2026-06-23-opsforge-plan-9-verify-command.md`
- Plan 10: `docs/superpowers/plans/2026-06-23-opsforge-plan-10-auto-rollback.md`
- Plan 11: `docs/superpowers/plans/2026-06-23-opsforge-plan-11-verifier-coverage.md`
- Plan 12: `docs/superpowers/plans/2026-06-23-opsforge-plan-12-default-verifier-probes.md`
- Plan 13: `docs/superpowers/plans/2026-06-23-opsforge-plan-13-host-facts-doctor.md`
- Plan 14: `docs/superpowers/plans/2026-06-23-opsforge-plan-14-tui-foundation.md`
- Plan 15: `docs/superpowers/plans/2026-06-23-opsforge-plan-15-tui-plan-card.md`
- Plan 16: `docs/superpowers/plans/2026-06-23-opsforge-plan-16-tui-execution-timeline.md`

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

## Delivered In Plan 6

- `@opsforge/cli`
  - `opsforge run "<NL>"` generates a Plan and feeds it into the same gated execution helper used by `apply`.
  - `opsforge run "<NL>" --dry-run` compiles and guards commands without executing host mutation commands.
  - `opsforge run "<NL>" --dry-run --json` emits both the generated Plan and execution result.
  - `apply` now delegates parsed Plan execution through `executeParsedPlan()`, keeping file-based and NL-based flows aligned.

## Delivered In Plan 7

- `@opsforge/config`
  - Provider config can be persisted to and loaded from `~/.opsforge/config.json`.
  - OpenAI-compatible env inference now defaults to `gpt-4.1-mini`, `https://api.openai.com/v1`, and `OPENAI_API_KEY`.
  - Provider config includes `apiKeyEnv` so credentials stay in environment variables rather than config files.

- `@opsforge/planner`
  - `createOpenAICompatiblePlanProvider()` calls OpenAI-compatible `/chat/completions` endpoints with JSON-mode response format.
  - Adapter tests use mocked HTTP responses and still validate through the existing DSL parser.
  - Provider failures surface as typed OpenAI-compatible provider errors.

- `@opsforge/cli`
  - `opsforge config provider openai-compatible ...` writes provider settings.
  - `opsforge config show [--json]` displays local config.
  - `opsforge plan/run --provider configured` resolves local config into the planner provider.
  - `opsforge plan/run --provider openai-compatible` can be driven directly from CLI flags and environment variables.

## Delivered In Plan 8

- `@opsforge/audit`
  - `plan.created` events can carry the full Plan.
  - SQLite audit storage persists full Plan JSON in `plans.plan_json`.
  - `audit show` internals can retrieve the stored Plan through `AuditRunDetail.plan`, enabling run-id based rollback.

- `@opsforge/core`
  - `rollbackPlan()` builds a rollback-only Plan from `plan.rollback`.
  - Rollback uses the same risk classification, gate, compile, guard, executor, and artifact flow as normal execution.
  - Rollback records `run.rollback.started` and `run.rollback.finished` audit events.

- `@opsforge/cli`
  - `opsforge rollback <run_id> --dry-run` compiles and guards rollback steps without executing them.
  - `opsforge rollback <run_id>` executes stored rollback steps for the original run's Plan.
  - `opsforge rollback <run_id> --json` returns the original run ID and rollback result payload.

## Delivered In Plan 9

- `@opsforge/core`
  - `verifyStoredPlan()` reruns stored Plan verifications and records a fresh `run.verified` event against the original run ID.
  - Verification replay does not recompile or execute mutation steps.

- `@opsforge/cli`
  - `opsforge verify <run_id>` loads the Plan stored in audit history and replays `plan.verifications`.
  - `opsforge verify <run_id> --json` emits the verification replay payload for scripts.
  - The command exits non-zero when the stored Plan is missing or any verification fails.

## Delivered In Plan 10

- `@opsforge/core`
  - `executePlan()` detects failed steps and failed verifications after the main run.
  - Failed runs return a rollback outcome that either recommends `opsforge rollback <run_id>` or reports auto-executed rollback details.
  - `autoRollback` reuses `rollbackPlan()` so rollback still goes through risk gate, compile, guard, executor, artifact, and audit paths.

- `@opsforge/cli`
  - `opsforge apply <plan.json> --auto-rollback` opts into automatic rollback after failed steps or failed verification.
  - `opsforge run "<NL>" --auto-rollback` forwards the same option through the natural-language flow.
  - Human-readable apply/run output now shows `Rollback: not needed`, `recommended`, `unavailable`, or `auto-executed`.

## Delivered In Plan 11

- `@opsforge/verifier`
  - Supports `package-version`, `service-status`, `port-open`, and `process-alive` through injected host-check dependencies.
  - Missing host-check dependencies fail explicitly instead of passing silently.
  - Verifier unit tests now cover all Verification variants in the current DSL.

## Delivered In Plan 12

- `@opsforge/cli`
  - Default verifier dependencies now provide read-only host probes for `package-version`, `service-status`, `port-open`, and `process-alive`.
  - Linux probes use `dpkg-query` for apt-style package versions, `rpm -q` for yum/dnf-style package versions, `systemctl is-active` for services, and `pgrep -x` for processes.
  - Windows probes use read-only PowerShell `Get-Package`, `Get-Service`, and `Get-Process` calls.
  - Port checks use a short local TCP connection to `127.0.0.1`.
  - Tests cover Linux command generation, Windows command generation, and open/closed local TCP port behavior without mutating the host.

## Delivered In Plan 13

- `@opsforge/cli`
  - Added centralized local HostFacts detection in `apps/cli/src/host-facts.ts`.
  - HostFacts now detect OS family, architecture, package managers, Linux distro/version from os-release content, Linux root elevation via `process.getuid()`, and Windows admin elevation through read-only `net session`.
  - `apply` and rollback execution paths now use centralized HostFacts detection when tests or callers do not inject explicit facts.
  - Default verifier probes receive the detected package-manager list.
  - `opsforge doctor` now reports HostFacts, elevation, distro/version, provider config, risk settings, shell policy, and readiness warnings.
  - Tests cover HostFacts detection, Linux elevation, Windows elevation, doctor warnings, and apply integration without mutating the host.

## Delivered In Plan 14

- `@opsforge/tui`
  - Added the first real TUI package with React + Ink.
  - Exports a testable TUI status model, deterministic snapshot formatter, `TuiApp`, and `runTui()`.
  - The first shell renders Forge branding, HostFacts, provider/model state, a timeline placeholder, and an `Ask Forge >` input prompt marker.

- `@opsforge/cli`
  - `opsforge` with no arguments now routes to the TUI path in interactive terminals.
  - Non-TTY no-argument execution prints a deterministic fallback instead of hanging.
  - CLI subcommands remain unchanged for script/CI usage.

## Delivered In Plan 15

- `@opsforge/tui`
  - Added deterministic Plan card view models for title, intent, risk, prechecks, steps, verifications, rollback, and explanation.
  - Added compiled-command previews for Plan steps and rollback steps by reusing the existing Linux and Windows executor compile functions.
  - Added deterministic Plan card snapshot formatting for tests and later non-TTY/event-stream fallbacks.
  - The TUI shell can now carry an optional Plan and render the card before execution begins.

## Delivered In Plan 16

- `@opsforge/tui`
  - Added deterministic execution timeline view models from existing `@opsforge/core` `ExecutePlanResult` data.
  - Timeline entries now include step command, stdout/stderr preview, exit code, duration, and truncated output marker.
  - Verification results render as pass/fail timeline entries with their verifier message.
  - Rollback outcomes render as not-needed, recommended, unavailable, or auto-executed status with suggested rollback command when present.
  - The TUI shell can now carry an optional execution result and render the timeline after the Plan card.

## Design Alignment Check

| Spec Area | Status | Evidence | Notes |
|---|---:|---|---|
| §3 DSL | Partial | `packages/dsl`, `schemas/plan.schema.json` | Core schema and Plan JSON Schema export exist. Job/approval/inventory/audit schema artifacts remain. |
| §4 Core pipeline | Partial | `packages/core/src/execute.ts`, `apps/cli/src/commands/run.ts`, `apps/cli/src/commands/rollback.ts`, `apps/cli/src/commands/verify.ts` | Deterministic spine exists, is reachable from NL via `run`, can manually replay stored verifications, recommends rollback by default on failure, and can auto-run rollback when explicitly requested. |
| §4.1 Executor abstraction | Partial | `packages/executor-base`, `apps/cli/src/host-facts.ts` | Interfaces and injectable runner exist. CLI now builds real local HostFacts for OS, arch, package managers, distro/version, and elevation. Safe elevation flows remain open. |
| §4.2 Linux executor | Partial | `packages/executor-linux` | Compile layer exists for apt/dnf/yum and systemd. Real safe file writing needs a later pass. |
| §4.3 Windows executor | Partial | `packages/executor-windows`, `apps/cli/src/host-facts.ts` | Compile layer exists for winget/choco and services. Doctor can detect admin status with `net session`; safe UAC elevation flow remains open. |
| §5 Policy and guard | Partial | `packages/policy` | Deterministic classifier/gate/guards exist. More rules and config knobs are needed. |
| §6 Planner/provider layer | Partial | `packages/planner`, `packages/config`, `apps/cli/src/provider.ts` | Provider boundary, DSL validation, mock provider, persistent provider config, and OpenAI-compatible adapter exist. Anthropic/Google/Pi adapters, JSON retry/tool-call retry loops, model capability checks, and Pi sessions remain. |
| §7.1 TUI mode | Partial | `packages/tui`, `packages/tui/src/plan-card.ts`, `packages/tui/src/timeline.ts`, `apps/cli/src/index.ts` | `@opsforge/tui` exists, `opsforge` no-arg enters the TUI path in TTY, a deterministic Plan card can render risk/prechecks/steps/compiled command previews/verifications/rollback preview/explanation, and a deterministic execution timeline can render step output, exit codes, verification results, and rollback recommendations. Inline approvals, interactive rollback choice, and Pi event streaming remain. |
| §7.2 CLI mode | Partial | `apps/cli/src/commands` | `doctor`, `plan`, `plan --out`, `run`, `apply`, `verify`, `rollback`, `config provider/show`, and `audit ls/show` exist. `doctor` now reports richer HostFacts and readiness warnings; `apply` and `run` support `--auto-rollback`; default verification includes read-only host probes. |
| §8 Audit | Partial | `packages/audit` | SQLite event store, stored Plan JSON, and stdout/stderr artifacts exist. Rich reports, retention/export, rollback audit views, and TUI timeline consumption remain. |
| §11 Tests | Partial | package tests | Unit tests cover deterministic components, all current verifier variants, default verifier probe command generation, local TCP port checks, HostFacts detection, doctor warnings, TUI snapshot rendering, and no-arg TUI entry decisions without mutating the host. |

## TUI-First Roadmap

The implementation priority is now locked back to the design document's product shape: TUI first, CLI second.

- Plan 14: TUI foundation and no-argument entry.
- Plan 15: TUI plan card with risk, steps, verifications, rollback preview, and compiled-command preview.
- Plan 16: TUI execution timeline with step output, verification results, and rollback recommendation display.
- Plan 17: TUI inline approval and rollback prompt flow for L2/L3 and failed runs.
- After Plan 17: return to provider depth, Pi runtime, safe file write/template semantics, skills, and richer audit/reporting.

## Remaining Implementation Estimate

To finish the full Phase 1 MVP described in the design document, the project likely needs roughly 4-8 more plan-sized slices after Plan 16. The immediate remaining track is TUI interaction depth: inline approvals, rollback choice, and Pi event streaming. After that, the major tracks are provider depth, Pi runtime integration, safe file-write/template execution semantics, skill templates, safe elevation flows, and richer audit/export/reporting.

## Known Gaps

- Anthropic, Google, and Pi planner adapters plus Pi runtime are not implemented.
- Planner JSON-mode retry/tool-call retry loops are not implemented.
- TUI primary entry exists, but the TUI is still a foundation shell rather than the full plan/execute/approve experience.
- TUI inline rollback choice after failure is not implemented.
- TUI inline approval flow is not implemented.
- Verification replay is manual only; no scheduled or automatic verification loop exists yet.
- Default verifier probes and HostFacts detection are basic; package-manager edge cases, distro-specific nuance, and safe elevation flows remain open.
- Rollback reporting is basic and does not yet provide rich rollback views in audit output.
- Audit retention/export and richer report generation are not implemented.
- TUI timeline consumption of audit history is not implemented.
- Model capability checks are not implemented.
- Only the Plan JSON Schema artifact is exported; job, approval, inventory, and audit schema artifacts remain.
- Generated plans are persisted as files, not yet in a first-class plan registry.
- Safe elevation flows are incomplete; current work detects elevated state but does not request or broker elevation.
- Skill templates such as install-nginx/install-docker/install-nodejs are not implemented.

## Next Plan Recommendation

Plan 17 should focus on TUI inline approval and rollback prompts. It should model L2/L3 approve/deny states, L3 reason capture, non-interactive fallback semantics, and failed-run rollback choices as deterministic TUI state before wiring them into live Pi/core events.

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
- Plan 17: `docs/superpowers/plans/2026-06-23-opsforge-plan-17-tui-inline-approval-rollback-prompts.md`
- Plan 18: `docs/superpowers/plans/2026-06-23-opsforge-plan-18-tui-event-input-state.md`
- Plan 19: `docs/superpowers/plans/2026-06-23-opsforge-plan-19-pi-runtime-event-bridge.md`
- Plan 20: `docs/superpowers/plans/2026-06-23-opsforge-plan-20-tui-keyboard-session-controls.md`
- Plan 21: `docs/superpowers/plans/2026-06-23-opsforge-plan-21-runtime-action-controller.md`
- Plan 22: `docs/superpowers/plans/2026-06-23-opsforge-plan-22-provider-depth-capabilities.md`
- Plan 23: `docs/superpowers/plans/2026-06-23-opsforge-plan-23-tui-runtime-wiring.md`
- Plan 24: `docs/superpowers/plans/2026-06-23-opsforge-plan-24-safe-file-write-template.md`
- Plan 25: `docs/superpowers/plans/2026-06-23-opsforge-plan-25-skill-templates.md`
- Plan 26: `docs/superpowers/plans/2026-06-23-opsforge-plan-26-tui-audit-rollback.md`
- Plan 27: `docs/superpowers/plans/2026-06-23-opsforge-plan-27-safe-elevation.md`
- Plan 28: `docs/superpowers/plans/2026-06-23-opsforge-plan-28-tui-audit-reports.md`
- Plan 29: `docs/superpowers/plans/2026-06-23-opsforge-plan-29-planner-repair-loop.md`

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

## Delivered In Plan 17

- `@opsforge/tui`
  - Added deterministic inline approval prompt models for L0/L1 bypass, L2 approve/deny, L3 approve/deny with required reason, and non-interactive high-risk denial fallback.
  - Added deterministic rollback prompt models for recommended, unavailable, auto-executed, and not-needed rollback outcomes.
  - Added snapshot formatters for approval and rollback prompts so future Pi/core event wiring has stable rendering targets.
  - The TUI shell can now carry optional approval and rollback prompt states and render them inline after the Plan card and execution timeline.

## Delivered In Plan 18

- `@opsforge/tui`
  - Added deterministic TUI event/input state with a pure reducer for thinking stream deltas, input draft changes, input submission, Plan readiness, execution completion, approval requests, and rollback requests.
  - Event-driven state now maps into the same Plan card, execution timeline, approval prompt, and rollback prompt view models built in Plans 15-17.
  - Added thinking text, input draft, and last submitted prompt rendering to the deterministic TUI snapshot and Ink shell.
  - Added TUI state snapshot formatting so a future Pi/core event stream can be tested without a live terminal.

## Delivered In Plan 19

- `@opsforge/pi-runtime`
  - Added the first Pi runtime boundary package with typed runtime events for session start, thinking deltas, Plan readiness, approval requests, execution completion, rollback requests, and recoverable/fatal errors.
  - Added a deterministic runtime session status model that exposes only structured OpsForge tools (`inspect_host`, `build_plan`, `execute_job`, `verify_run`, `rollback_run`) and explicitly keeps raw shell tools disabled.
  - Added runtime event summaries for timeline/audit-style rendering.

- `@opsforge/tui`
  - Added `runtimeEventToTuiEvent()` so runtime events can feed the Plan 18 TUI reducer.
  - Kept dependency direction design-aligned: `tui` consumes `pi-runtime`; `pi-runtime` does not import TUI rendering code.

## Delivered In Plan 20

- `@opsforge/tui`
  - Added a pure keyboard reducer for prompt editing, Enter submission, L2 approve/deny actions, L3 reason entry, and rollback/skip actions.
  - Added typed `TuiUserAction` values so the TUI can hand decisions to a runtime session without executing host commands itself.
  - Added `TuiInteractiveApp`, which wires Ink `useInput` into the reducer and keeps rendering through the existing `TuiApp` surface.
  - Updated `runTui()` to launch the interactive wrapper instead of a static render-only component.

## Delivered In Plan 21

- `@opsforge/pi-runtime`
  - Added `createRuntimeActionController()` to receive prompt, approval, deny, rollback, and rollback-skip actions.
  - Prompt submissions now call an injected planner callback and emit thinking plus Plan-ready runtime events.
  - L2/L3 Plans emit approval requests instead of executing immediately.
  - L0/L1 Plans can auto-execute only through an injected executor callback.
  - Approval and rollback actions resume through injected executor/rollback callbacks, keeping host mutation behind the guarded runtime/core boundary.
  - Missing pending Plan or rollback callback returns recoverable runtime errors instead of falling through silently.

## Delivered In Plan 22

- `@opsforge/planner`
  - Added Anthropic `/v1/messages` and Google `generateContent` Plan providers with mocked-fetch coverage.
  - Provider adapters parse provider text content as JSON and still rely on DSL validation before a Plan is accepted.
  - Added typed provider errors for Anthropic and Google failures.
  - Added provider capability descriptions for OpenAI-compatible, Anthropic, Google, Pi, and unconfigured states.

- `@opsforge/cli`
  - `opsforge config provider anthropic` and `opsforge config provider google` now persist provider-specific defaults.
  - `resolvePlanProvider()` can instantiate configured Anthropic and Google providers with provider-specific env vars.
  - `opsforge doctor` now reports provider capabilities alongside HostFacts, elevation, risk, shell policy, and warnings.
  - `plan/run --provider` help text now reflects the implemented provider modes while keeping CLI secondary to the TUI-first path.

## Delivered In Plan 23

- `@opsforge/tui`
  - Added `reduceTuiEvents()` for applying batches of runtime-derived events into the TUI state reducer.
  - Added typed async `TuiActionHandler` support so keyboard actions can return TUI events after planner/core work completes.
  - `TuiInteractiveApp` now feeds returned events back into the same Plan card, approval prompt, execution timeline, and rollback prompt state.

- `@opsforge/cli`
  - Added `createTuiRuntimeActionHandler()` to bridge TUI actions to `createRuntimeActionController()`.
  - No-argument interactive `opsforge` now launches the TUI with a runtime action handler.
  - Prompt submission resolves the configured provider, builds a DSL-validated Plan, and executes low-risk or approved Plans through the existing guarded `executeParsedPlan()` path.
  - Runtime events are converted into TUI reducer events, keeping host mutation behind planner/core callbacks.

## Delivered In Plan 24

- `@opsforge/executor-base`
  - Added optional `CompiledCommand.stdin` so command content can be supplied without interpolating it into shell arguments.
  - Added deterministic `renderFileTemplate()` for `{{name}}` style template variables, keeping missing variables visible.

- `@opsforge/executor-linux`
  - `file-write` now compiles to `install -D -m <mode> /dev/stdin <path>` with content passed through stdin.
  - `file-template` now renders variables first and writes rendered content through stdin.

- `@opsforge/executor-windows`
  - `file-write` and `file-template` now compile to stdin-backed PowerShell `Set-Content -LiteralPath ...` commands.
  - File contents no longer appear in Windows command arguments.

- `@opsforge/cli`
  - The default local command runner now writes `CompiledCommand.stdin` into child process stdin.
  - Apply tests cover stdin-backed file-write execution with an injected runner and no real host mutation.

## Delivered In Plan 25

- `@opsforge/planner`
  - Added deterministic skill templates for `install-nginx`, `install-docker`, and `install-nodejs`.
  - Mock planning now uses matching skill templates before falling back to generic package installation.
  - OpenAI-compatible, Anthropic, and Google planning prompts now include compact skill template context so real provider planning sees the same DSL skeleton guidance used by the TUI runtime path.

- `skills/`
  - Added checked-in human-readable skill template docs for nginx, Docker, and Node.js.
  - Templates remain DSL skeletons only; execution still flows through policy, guard, executor, verifier, rollback, and audit.

## Delivered In Plan 26

- `@opsforge/pi-runtime`
  - Runtime action handling now emits `runtime.rollback.requested` after guarded execution recommends rollback.
  - Rollback action results continue through the same execution event mapping and avoid prompting again when rollback is not needed.

- `@opsforge/cli`
  - No-argument TUI runtime handling now injects a rollback callback.
  - `rollback.run` can use an injected test callback or, by default, load the stored Plan from audit history and call `executeRollbackPlan()`.
  - TUI rollback actions now reuse the same policy, guard, executor, verifier, artifact, and audit path as `opsforge rollback`.

## Delivered In Plan 27

- `@opsforge/core`
  - Non-dry-run execution is denied before runner calls when a compiled command requires elevation and HostFacts report a non-elevated process.
  - Dry-run still previews privileged compiled commands for review.
  - The denial reason tells the user to restart OpsForge from an elevated shell before execution.

- `@opsforge/cli`
  - `opsforge doctor` now reports that privileged operations will be blocked until OpsForge is started from an elevated shell.
  - TUI status inherits the same doctor warning source because no-argument launch builds from the doctor report.

## Delivered In Plan 28

- `@opsforge/audit`
  - Added a deterministic `AuditRunReport` model that summarizes stored run detail into plan identity, risk/status, ordered events, step exits, artifact paths, verification event counts, and rollback state.
  - Added a stable human formatter for rich audit reports so consumers do not parse raw SQLite rows or raw event payloads.

- `@opsforge/tui`
  - Added audit history and audit detail view models/rendering to the TUI status, reducer, snapshots, and Ink shell.
  - Added slash-command actions for the primary TUI path: type `/history` to load audit history, then `/audit 1` through `/audit 9` to open a listed run without stealing normal prompt input.

- `@opsforge/cli`
  - No-argument TUI runtime handling now maps audit history/detail actions to the configured `AuditStore`.
  - `opsforge audit show <run_id>` now uses the shared rich report formatter.
  - `opsforge audit export <run_id> --out <file>` writes the same rich report model as JSON for scripts and support bundles.

## Delivered In Plan 29

- `@opsforge/planner`
  - `buildPlanFromPrompt()` now retries invalid DSL output once by default with a provider-neutral repair prompt.
  - Repair prompts include the original user request, schema validation errors, and the previous output.
  - `maxRepairAttempts` lets tests and callers make the retry budget explicit while preserving schema validation as the only success path.

## Delivered In Plan 30

- `@opsforge/tui`
  - Reworked the live Ink shell into separate Host, Runtime, Status, Workspace, and Prompt panels so prompt input no longer sits in the same visual stream as host facts, errors, and run content.
  - Compact long runtime/thinking text in the TUI snapshot and live status panel so repeated provider errors do not dominate the screen.
  - Clear stale thinking/status text on each new prompt submission, preventing repeated `Runtime error` messages from accumulating across retries.
  - Removed obsolete placeholder copy about future TUI plans from the primary TUI surface.

## Design Alignment Check

| Spec Area | Status | Evidence | Notes |
|---|---:|---|---|
| §3 DSL | Partial | `packages/dsl`, `schemas/plan.schema.json` | Core schema and Plan JSON Schema export exist. Job/approval/inventory/audit schema artifacts remain. |
| §4 Core pipeline | Partial | `packages/core/src/execute.ts`, `apps/cli/src/commands/run.ts`, `apps/cli/src/commands/rollback.ts`, `apps/cli/src/commands/verify.ts` | Deterministic spine exists, is reachable from NL via `run`, can manually replay stored verifications, recommends rollback by default on failure, and can auto-run rollback when explicitly requested. |
| §4.1 Executor abstraction | Partial | `packages/executor-base`, `apps/cli/src/host-facts.ts`, `apps/cli/src/commands/apply.ts`, `packages/core/src/execute.ts` | Interfaces, injectable runner, optional command stdin, deterministic template rendering, real local HostFacts detection, and non-elevated privileged execution blocking exist. Automatic sudo/UAC relaunch remains open. |
| §4.2 Linux executor | Partial | `packages/executor-linux` | Compile layer exists for apt/dnf/yum, systemd, and stdin-backed file write/template operations. Atomic backups and richer file permissions remain open. |
| §4.3 Windows executor | Partial | `packages/executor-windows`, `apps/cli/src/host-facts.ts`, `packages/core/src/execute.ts` | Compile layer exists for winget/choco, services, and stdin-backed file write/template operations. Doctor can detect admin status with `net session`, and core blocks privileged execution when not admin; automatic UAC relaunch remains open. |
| §5 Policy and guard | Partial | `packages/policy` | Deterministic classifier/gate/guards exist. More rules and config knobs are needed. |
| §6 Planner/provider layer | Partial | `packages/planner`, `packages/config`, `packages/pi-runtime`, `apps/cli/src/provider.ts`, `apps/cli/src/commands/doctor.ts`, `skills/` | Provider boundary, DSL validation, schema repair retry, mock provider, deterministic skill templates, persistent provider config, OpenAI-compatible adapter, Anthropic adapter, Google adapter, provider capability reporting, typed Pi runtime event bridge, and runtime action controller exist. Real Pi SDK sessions, provider-native raw JSON/tool-call retry loops, and model discovery remain. |
| §7.1 TUI mode | Partial | `packages/tui`, `packages/tui/src/plan-card.ts`, `packages/tui/src/timeline.ts`, `packages/tui/src/prompts.ts`, `packages/tui/src/state.ts`, `packages/tui/src/runtime-adapter.ts`, `packages/tui/src/controls.ts`, `packages/tui/src/audit-history.ts`, `packages/pi-runtime/src/actions.ts`, `apps/cli/src/index.ts`, `apps/cli/src/tui-runtime.ts`, `packages/planner/src/skill-templates.ts` | `@opsforge/tui` exists, `opsforge` no-arg enters the TUI path in TTY, the live shell separates Host/Runtime/Status/Workspace/Prompt panels, long runtime status is compacted, stale thinking text is cleared on new prompt submission, a deterministic Plan card can render risk/prechecks/steps/compiled command previews/verifications/rollback preview/explanation, a deterministic execution timeline can render step output/exit codes/verification results/rollback recommendations, inline approval/rollback prompt states can render, a pure event/input reducer can drive those views, runtime events can be adapted into TUI events, keyboard input can emit typed prompt/approval/rollback/audit actions, async TUI action handlers can feed returned events back into state, the no-arg CLI entry now wires prompt submission to provider planning plus guarded core execution, stored-audit rollback execution, and stored-audit history/detail loading, and planner skill templates are available through that same prompt path. Real Pi SDK streaming remains. |
| §7.2 CLI mode | Partial | `apps/cli/src/commands` | `doctor`, `plan`, `plan --out`, `run`, `apply`, `verify`, `rollback`, `config provider/show`, `audit ls/show/export` exist. `doctor` now reports richer HostFacts and readiness warnings; `apply` and `run` support `--auto-rollback`; default verification includes read-only host probes. |
| §8 Audit | Partial | `packages/audit` | SQLite event store, stored Plan JSON, stdout/stderr artifacts, rich reports, JSON report export, rollback audit event summaries, and TUI history/detail consumption exist. Retention/pruning remains. |
| §11 Tests | Partial | package tests | Unit tests cover deterministic components, all current verifier variants, default verifier probe command generation, local TCP port checks, HostFacts detection, doctor warnings, TUI snapshot rendering, and no-arg TUI entry decisions without mutating the host. |

## TUI-First Roadmap

The implementation priority is now locked back to the design document's product shape: TUI first, CLI second.

- Plan 14: TUI foundation and no-argument entry.
- Plan 15: TUI plan card with risk, steps, verifications, rollback preview, and compiled-command preview.
- Plan 16: TUI execution timeline with step output, verification results, and rollback recommendation display.
- Plan 17: TUI inline approval and rollback prompt flow for L2/L3 and failed runs.
- Plan 18: Wire TUI event stream/input state so Plan card, timeline, approvals, and rollback prompts can be driven by live core/Pi events.
- Plan 19: Add the typed Pi runtime event bridge and TUI adapter without enabling raw bash.
- Plan 20: Add real Ink keyboard handling and typed TUI user actions for prompt submission, approvals, L3 reasons, and rollback decisions.
- Plan 21: Add runtime action handling for prompt, approval, deny, rollback, and rollback-skip actions using injected planner/core callbacks.
- Plan 22: Add Anthropic/Google provider depth and expose provider capability reporting in doctor.
- Plan 23: Wire the no-argument TUI entry to runtime action handling, provider planning, and guarded core execution.
- Plan 24: Add stdin-backed safe file-write and file-template execution semantics.
- Plan 25: Add deterministic skill templates for common local operations and feed them into the planner/TUI path.
- Plan 26: Wire TUI rollback actions to stored audit rollback execution.
- Plan 27: Block privileged execution on non-elevated hosts and surface actionable doctor guidance.
- Plan 28: Add TUI audit history/detail reports and shared CLI export/report formatting.
- Plan 29: Add provider-neutral planner schema repair retry for invalid DSL output.
- Plan 30: Polish the live TUI layout and status hygiene so host facts, runtime state, workspace content, and prompt input are separated.
- After Plan 30: remaining work is no longer basic local TUI/control-plane plumbing; it is deeper Pi SDK fidelity and hardening.

## Remaining Implementation Estimate

The local TUI-first Phase 1 spine is now implemented through planning, approval, execution, verification, rollback, audit persistence, audit report browsing, and safe elevation blocking. Remaining work is mainly fidelity/hardening rather than missing primary local flow.

## Known Gaps

- Real Pi planner adapter and real Pi SDK session integration are not implemented.
- Planner schema repair retry is implemented; provider-native raw JSON/tool-call retry loops are not implemented.
- Anthropic and Google provider adapters exist, but live model discovery is not implemented.
- TUI primary entry, separated live panels, deterministic state/rendering, runtime-event adaptation, keyboard action emission, runtime action handling, and no-arg provider/core callback wiring exist.
- TUI rollback prompt rendering, rollback key actions, no-arg stored audit rollback execution, and browseable audit history/detail reports are wired.
- Verification replay is manual only; no scheduled or automatic verification loop exists yet.
- Default verifier probes and HostFacts detection are basic; package-manager edge cases, distro-specific nuance, and automatic sudo/UAC relaunch remain open.
- File write/template steps now execute through stdin-backed commands, but atomic backup/restore snapshots and secret redaction remain open.
- Rollback reporting is summarized in rich audit reports; a dedicated rollback drilldown view remains open.
- Audit JSON export and richer report generation are implemented; retention/pruning remains open.
- TUI audit history/detail consumption is implemented; full timeline replay from historical run artifacts remains open.
- Provider capability reporting exists in doctor; live model capability checks are not implemented.
- Only the Plan JSON Schema artifact is exported; job, approval, inventory, and audit schema artifacts remain.
- Generated plans are persisted as files, not yet in a first-class plan registry.
- Safe elevation detection and blocking are implemented; automatic sudo/UAC relaunch is not implemented.
- Skill templates for install-nginx/install-docker/install-nodejs exist; more templates and real Pi skill ingestion remain open.

## Next Plan Recommendation

Next plans should target one of the remaining hardening tracks: real Pi SDK session integration, provider-native raw JSON/tool-call repair, or atomic file backup/restore with secret redaction.

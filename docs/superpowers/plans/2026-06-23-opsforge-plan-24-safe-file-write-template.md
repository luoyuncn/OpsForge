# Safe File Write And Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder file-write/file-template command compilation with safe stdin-backed local write semantics for Linux and Windows.

**Architecture:** Extend `CompiledCommand` with optional `stdin` so file content is not interpolated into shell arguments. Keep rendering deterministic in executor-base, compilation OS-specific in executor-linux/executor-windows, and process stdin support in the CLI default runner. Existing path guards remain the safety boundary for protected paths.

**Tech Stack:** TypeScript, Vitest, existing executor/core/CLI packages.

---

## Design Alignment

This plan advances §3.3, §4.1, §4.2, §4.3, and §5.4:

- `file-write` and `file-template` become executable local operations instead of placeholders
- file content travels through stdin rather than shell interpolation
- template rendering is deterministic and testable
- path guard remains responsible for blocking protected locations

Out of scope:

- atomic backup/restore snapshots
- Windows ACL/registry safe-write wrappers
- secret redaction in stored Plan content

## Files

- Modify: `packages/executor-base/src/types.ts`
- Create: `packages/executor-base/src/template.ts`
- Modify: `packages/executor-base/src/index.ts`
- Modify: `packages/executor-base/test/runner.test.ts`
- Modify: `packages/executor-linux/src/compile.ts`
- Modify: `packages/executor-linux/test/compile.test.ts`
- Modify: `packages/executor-windows/src/compile.ts`
- Modify: `packages/executor-windows/test/compile.test.ts`
- Modify: `apps/cli/src/commands/apply.ts`
- Modify: `apps/cli/test/apply.test.ts`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

---

### Task 1: Command Stdin And Template Rendering

- [x] **Step 1: Write failing executor-base tests**

Add tests that `renderFileTemplate("hello {{name}}", { name: "Forge" })` returns `hello Forge`, and that missing vars remain visible as `{{missing}}`.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/executor-base test
```

Expected: fail because `renderFileTemplate` does not exist.

- [x] **Step 3: Implement base support**

Add optional `stdin?: string` to `CompiledCommand`. Add and export `renderFileTemplate()`.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/executor-base test
pnpm --filter @opsforge/executor-base typecheck
```

### Task 2: Linux And Windows Safe File Compilation

- [x] **Step 1: Write failing executor tests**

Linux `file-write` should compile to `install -D -m <mode> /dev/stdin <path>` with `stdin` equal to content. Windows `file-template` should compile to a `Set-Content` command with rendered content in `stdin`.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/executor-linux test
pnpm --filter @opsforge/executor-windows test
```

- [x] **Step 3: Implement compilers**

Update Linux and Windows compilers to use stdin-backed writes and deterministic template rendering.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/executor-linux test
pnpm --filter @opsforge/executor-linux typecheck
pnpm --filter @opsforge/executor-windows test
pnpm --filter @opsforge/executor-windows typecheck
```

### Task 3: CLI Runner Stdin Support

- [x] **Step 1: Write failing CLI apply test**

Add a dry-run/apply integration test that file-write execution passes content through `command.stdin` to the injected runner and does not place file content in `argv`.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @opsforge/cli test
```

- [x] **Step 3: Implement default runner stdin support**

Update the default command runner to write `CompiledCommand.stdin` to the child process stdin while keeping existing stdout/stderr capture behavior.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @opsforge/cli test
pnpm --filter @opsforge/cli typecheck
```

### Task 4: Docs, Full Verification, Commit

- [x] **Step 1: Update docs**

Record Plan 24 and update design alignment for safe file-write/template execution.

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
git commit -m "feat: add safe file writes"
git push origin main
```

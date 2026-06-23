# Default Verifier Probes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the verifier's host-specific checks into CLI defaults with safe, read-only OS probes.

**Architecture:** Keep `@opsforge/verifier` dependency-injected and implement host probing at the CLI boundary where OS detection already exists. The probes run only read-only commands or local TCP checks, normalize platform-specific output into the verifier contract, and remain unit-testable through injected command runners and platform selectors.

**Tech Stack:** TypeScript, Vitest, Node `net`, existing `CommandRunner`, pnpm/Turbo.

---

## File Structure

- Modify `apps/cli/src/commands/apply.ts`
  - Extend `createDefaultVerifyDeps()` to accept optional platform, package manager list, and runner.
  - Add read-only default probes for package version, service status, port open, and process alive.
- Modify `apps/cli/test/apply.test.ts`
  - Add TDD coverage for Linux and Windows default verifier probes through injected fake runners.
- Modify `README.md`
  - Add Plan 12 to current implementation status and keep command examples aligned.
- Modify `docs/implementation-status.md`
  - Add Plan 12 and update design alignment / known gaps.

## Task 1: Plan Document

**Files:**
- Create: `docs/superpowers/plans/2026-06-23-opsforge-plan-12-default-verifier-probes.md`

- [ ] **Step 1: Save this implementation plan**

- [ ] **Step 2: Commit the plan**

Run:

```bash
git add docs/superpowers/plans/2026-06-23-opsforge-plan-12-default-verifier-probes.md
git commit -m "docs: add default verifier probes plan"
```

Expected: commit succeeds with only the new plan doc staged.

## Task 2: Default Probe Tests

**Files:**
- Modify: `apps/cli/test/apply.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that call `createDefaultVerifyDeps()` with fake platforms and a fake command runner:

```ts
it("creates linux default verifier probes for package, service, and process checks", async () => {
  const calls: string[] = [];
  const deps = createDefaultVerifyDeps({
    platform: "linux",
    packageManagers: ["apt"],
    runner: async (command) => {
      calls.push(Array.isArray(command.argv) ? command.argv.join(" ") : command.argv);
      if (calls.at(-1)?.startsWith("dpkg-query")) return { stdout: "1.24.0\n", stderr: "", exitCode: 0 };
      if (calls.at(-1)?.startsWith("systemctl")) return { stdout: "active\n", stderr: "", exitCode: 0 };
      if (calls.at(-1)?.startsWith("pgrep")) return { stdout: "123\n", stderr: "", exitCode: 0 };
      return { stdout: "", stderr: "", exitCode: 1 };
    },
  });

  await expect(deps.getPackageVersion?.("nginx")).resolves.toBe("1.24.0");
  await expect(deps.getServiceStatus?.("nginx")).resolves.toBe("active");
  await expect(deps.isProcessAlive?.("nginx")).resolves.toBe(true);
  expect(calls).toEqual([
    "dpkg-query -W -f=${Version} nginx",
    "systemctl is-active nginx",
    "pgrep -x nginx",
  ]);
});

it("creates windows default verifier probes for package, service, and process checks", async () => {
  const calls: string[] = [];
  const deps = createDefaultVerifyDeps({
    platform: "win32",
    runner: async (command) => {
      calls.push(Array.isArray(command.argv) ? command.argv.join(" ") : command.argv);
      if (calls.at(-1)?.startsWith("Get-Package")) return { stdout: "2.0.0\n", stderr: "", exitCode: 0 };
      if (calls.at(-1)?.startsWith("Get-Service")) return { stdout: "Running\n", stderr: "", exitCode: 0 };
      if (calls.at(-1)?.startsWith("Get-Process")) return { stdout: "nginx\n", stderr: "", exitCode: 0 };
      return { stdout: "", stderr: "", exitCode: 1 };
    },
  });

  await expect(deps.getPackageVersion?.("nginx")).resolves.toBe("2.0.0");
  await expect(deps.getServiceStatus?.("nginx")).resolves.toBe("running");
  await expect(deps.isProcessAlive?.("nginx")).resolves.toBe(true);
  expect(calls).toEqual([
    "Get-Package -Name 'nginx' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Version",
    "Get-Service -Name 'nginx' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Status",
    "Get-Process -Name 'nginx' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty ProcessName",
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @opsforge/cli test -- apply.test.ts
```

Expected: FAIL because `createDefaultVerifyDeps` does not accept options or expose host probes yet.

## Task 3: Default Probe Implementation

**Files:**
- Modify: `apps/cli/src/commands/apply.ts`

- [ ] **Step 1: Implement minimal default probes**

Implement:

```ts
export interface DefaultVerifyDepsOptions {
  platform?: NodeJS.Platform;
  packageManagers?: string[];
  runner?: CommandRunner;
}

export const createDefaultVerifyDeps = (options: DefaultVerifyDepsOptions = ({})): VerifyStoredPlanInput["verifyDeps"] => {
  const platform = options.platform ?? process.platform;
  const os = detectOs(platform);
  const runner = options.runner ?? defaultRunner;
  const runProbe = async (cmd: string) => runner({
    shell: os === "windows" ? "powershell" : "bash",
    argv: cmd,
    needsElevation: false,
    describe: `Verify ${cmd}`,
  });
  ...
};
```

Use read-only commands:

- Linux apt: `dpkg-query -W -f=${Version} <name>`
- Linux yum/dnf/rpm: `rpm -q --qf %{VERSION} <name>`
- Linux service: `systemctl is-active <name>`
- Linux process: `pgrep -x <name>`
- Windows package: `Get-Package -Name '<name>' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Version`
- Windows service: `Get-Service -Name '<name>' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Status`
- Windows process: `Get-Process -Name '<name>' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty ProcessName`
- Port open: Node `net.connect()` to `127.0.0.1` with a short timeout.

Return `undefined` for missing package/service and `false` for missing process/closed port.

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm --filter @opsforge/cli test -- apply.test.ts
```

Expected: PASS.

## Task 4: Docs and Design Alignment

**Files:**
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

- [ ] **Step 1: Update README**

Add Plan 12 to the implemented-plan list.

- [ ] **Step 2: Update implementation status**

Add:

```md
- Plan 12: `docs/superpowers/plans/2026-06-23-opsforge-plan-12-default-verifier-probes.md`
```

Add a "Delivered In Plan 12" section noting that CLI default verification dependencies now provide read-only OS probes for package version, service status, port checks, and process checks.

Update known gaps by removing "Real OS-specific default verifier probes are not implemented" and replacing it with a narrower gap that host probes are basic and doctor/elevation checks remain shallow.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add apps/cli/src/commands/apply.ts apps/cli/test/apply.test.ts README.md docs/implementation-status.md
git commit -m "feat: add default verifier probes"
```

Expected: commit succeeds.

## Task 5: Full Verification and Push

**Files:**
- No new files.

- [ ] **Step 1: Run full verification**

Run:

```bash
pnpm build
pnpm test
pnpm typecheck
```

Expected: all commands exit 0. Node 24 `node:sqlite` ExperimentalWarning is acceptable.

- [ ] **Step 2: Confirm design alignment**

Check `docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md` §4, §7, §11, and §12. Confirm this plan advances the verifier and CLI done definitions without changing host state.

- [ ] **Step 3: Clean temp outputs**

Run:

```bash
Remove-Item -Recurse -Force .opsforge-tmp -ErrorAction SilentlyContinue
git status --short --branch
```

Expected: only `docs/pi_soul.md` remains untracked.

- [ ] **Step 4: Push main**

Run:

```bash
git push origin main
```

Expected: remote main receives the Plan 12 commits.

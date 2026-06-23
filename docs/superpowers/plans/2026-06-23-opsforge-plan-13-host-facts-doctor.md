# Host Facts and Doctor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real local HostFacts detection, elevated privilege checks, and richer `opsforge doctor` output.

**Architecture:** Introduce a CLI-local host facts module that centralizes safe OS, architecture, package-manager, distro, and elevation detection. `apply`/`rollback` use this module for default `HostFacts`, while `doctor` renders the same facts for humans; tests inject platform, `which`, UID, and command runners so no host mutation is required.

**Tech Stack:** TypeScript, Vitest, Node `child_process`, existing `HostFacts` and CLI dependency injection.

---

## File Structure

- Create `apps/cli/src/host-facts.ts`
  - Build `HostFacts` from platform, arch, package-manager probes, optional Linux release content, optional UID, and optional read-only command runner.
  - Export synchronous `detectLocalHostFacts()` for apply/rollback and async `detectLocalHostFactsAsync()` for Windows elevation checks.
- Create `apps/cli/test/host-facts.test.ts`
  - Unit test Linux distro parsing, Linux elevation, Windows elevation, and unsupported OS handling.
- Modify `apps/cli/src/commands/apply.ts`
  - Replace local `factsFromHost()` with centralized host facts detection.
  - Pass detected package managers into default verifier probes.
- Modify `apps/cli/src/commands/doctor.ts`
  - Render `HostFacts` plus provider/config status.
  - Show elevation, distro/version, and readiness warnings.
- Modify `apps/cli/test/doctor.test.ts`
  - Assert doctor uses supplied facts and prints the richer fields.
- Modify `README.md`
  - Add Plan 13.
- Modify `docs/implementation-status.md`
  - Add Plan 13, update design alignment and known gaps.

## Task 1: Plan Document

**Files:**
- Create: `docs/superpowers/plans/2026-06-23-opsforge-plan-13-host-facts-doctor.md`

- [ ] **Step 1: Save this implementation plan**

- [ ] **Step 2: Commit the plan**

Run:

```bash
git add docs/superpowers/plans/2026-06-23-opsforge-plan-13-host-facts-doctor.md
git commit -m "docs: add host facts doctor plan"
```

Expected: commit succeeds with only the new plan staged.

## Task 2: Host Facts TDD

**Files:**
- Create: `apps/cli/src/host-facts.ts`
- Create: `apps/cli/test/host-facts.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests:

```ts
import { describe, expect, it } from "vitest";
import { detectLocalHostFacts, detectLocalHostFactsAsync } from "../src/host-facts";

describe("detectLocalHostFacts", () => {
  it("detects linux facts with distro and root elevation", () => {
    const facts = detectLocalHostFacts({
      platform: "linux",
      arch: "x64",
      which: (cmd) => cmd === "apt" || cmd === "dnf",
      getUid: () => 0,
      linuxRelease: 'ID=ubuntu\nVERSION_ID="24.04"\n',
    });

    expect(facts).toEqual({
      osFamily: "linux",
      arch: "x64",
      distro: "ubuntu",
      version: "24.04",
      isElevated: true,
      packageManagers: ["apt", "dnf"],
    });
  });

  it("detects unsupported platforms as a typed error", () => {
    expect(() => detectLocalHostFacts({
      platform: "darwin",
      arch: "arm64",
      which: () => false,
    })).toThrow("Unsupported OS for local host facts: other");
  });
});

describe("detectLocalHostFactsAsync", () => {
  it("detects windows admin elevation through a read-only command", async () => {
    const facts = await detectLocalHostFactsAsync({
      platform: "win32",
      arch: "x64",
      which: (cmd) => cmd === "winget",
      runCommand: async (cmd) => {
        expect(cmd).toBe("net session");
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    expect(facts).toEqual({
      osFamily: "windows",
      arch: "x64",
      isElevated: true,
      packageManagers: ["winget"],
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @opsforge/cli test -- host-facts.test.ts
```

Expected: FAIL because the module does not exist.

## Task 3: Host Facts Implementation

**Files:**
- Create: `apps/cli/src/host-facts.ts`

- [ ] **Step 1: Implement minimal host facts detection**

Implementation details:

- `detectLocalHostFacts()` is synchronous and uses:
  - `detectOs(platform)`
  - `detectPackageManagers(os, which)`
  - `arch`
  - Linux elevation: `getUid?.() === 0`
  - Linux distro/version parsed from `/etc/os-release` format when provided or readable.
  - Windows elevation defaults to `false` in sync mode.
- `detectLocalHostFactsAsync()` reuses sync facts, but for Windows runs `net session` through an injected command runner and sets `isElevated` from exit code `0`.

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm --filter @opsforge/cli test -- host-facts.test.ts
```

Expected: PASS.

## Task 4: Apply/Rollback Integration TDD

**Files:**
- Modify: `apps/cli/test/apply.test.ts`
- Modify: `apps/cli/src/commands/apply.ts`

- [ ] **Step 1: Write failing test**

Add a test proving dry-run uses detected facts when no explicit facts are passed:

```ts
it("uses detected host facts when explicit facts are not supplied", async () => {
  const apply = buildApplyCommand({
    readFile: async () => JSON.stringify(installPlan),
    platform: "linux",
    arch: "x64",
    getUid: () => 0,
    linuxRelease: "ID=fedora\nVERSION_ID=40\n",
    which: (cmd) => cmd === "dnf",
    auditStore: createFakeAuditStore(),
    runner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
  });

  const result = await apply("plan.json", { dryRun: true, yes: false, json: false, riskMax: "L3", allowShell: false });

  expect(result.commands[0].argv).toEqual(["dnf", "install", "-y", "nginx"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @opsforge/cli test -- apply.test.ts
```

Expected: FAIL because `BuildApplyDeps` does not accept `arch`, `getUid`, or `linuxRelease` and still uses the old local helper.

- [ ] **Step 3: Integrate host facts**

Modify `ExecutePlanDeps` to include host fact detection options. Use `detectLocalHostFacts()` in `executeParsedPlan()` and `executeRollbackPlan()`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
pnpm --filter @opsforge/cli test -- apply.test.ts
```

Expected: PASS.

## Task 5: Doctor TDD and Implementation

**Files:**
- Modify: `apps/cli/src/commands/doctor.ts`
- Modify: `apps/cli/test/doctor.test.ts`

- [ ] **Step 1: Write failing tests**

Update doctor tests to assert:

- report includes `isElevated`
- report includes distro/version when available
- formatted output includes `Elevated`, `Distro`, and readiness warnings such as provider missing or package manager missing.

- [ ] **Step 2: Run doctor tests to verify they fail**

Run:

```bash
pnpm --filter @opsforge/cli test -- doctor.test.ts
```

Expected: FAIL because doctor output is still shallow.

- [ ] **Step 3: Implement richer doctor report**

Modify `DoctorReport` to include:

```ts
facts: HostFacts;
provider: string;
riskMax: string;
allowShell: boolean;
warnings: string[];
```

Warnings:

- provider missing
- package manager missing on Linux/Windows
- unsupported OS
- not elevated

- [ ] **Step 4: Run doctor tests**

Run:

```bash
pnpm --filter @opsforge/cli test -- doctor.test.ts
```

Expected: PASS.

## Task 6: Docs and Design Alignment

**Files:**
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

- [ ] **Step 1: Update README**

Add Plan 13 to the implemented-plan list.

- [ ] **Step 2: Update implementation status**

Add Plan 13 and a "Delivered In Plan 13" section. Update §4.1, §4.4, §7.2, §11 notes and narrow the known gaps to safe elevation flows rather than raw detection.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add apps/cli/src/host-facts.ts apps/cli/test/host-facts.test.ts apps/cli/src/commands/apply.ts apps/cli/test/apply.test.ts apps/cli/src/commands/doctor.ts apps/cli/test/doctor.test.ts README.md docs/implementation-status.md
git commit -m "feat: detect host facts for doctor"
```

Expected: commit succeeds.

## Task 7: Full Verification and Push

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

Check design spec §4.1, §4.4, §7.2, §11, §12, and §13. Confirm this plan advances runtime host detection and doctor without host mutation or unsafe elevation.

- [ ] **Step 3: Clean temp outputs and verify status**

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

Expected: remote main receives the Plan 13 commits.

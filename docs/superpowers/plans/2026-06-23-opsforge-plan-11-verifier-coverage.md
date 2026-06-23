# Verifier Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `@opsforge/verifier` beyond smoke tests and checksums so automatic rollback can rely on package, service, port, and process verification results.

**Architecture:** Keep verifier side-effect free by default and require injected host-check dependencies for host-specific probes. Each DSL verification maps to one small dependency hook, returning explicit failure when the hook is missing instead of silently passing.

**Tech Stack:** TypeScript, vitest, `@opsforge/dsl`, `@opsforge/verifier`.

---

## File Map

- Modify `packages/verifier/src/verify.ts`: add dependency hooks and implementations for `package-version`, `service-status`, `port-open`, and `process-alive`.
- Modify `packages/verifier/test/verify.test.ts`: add RED/GREEN tests for each verification type and missing dependency behavior.
- Modify `README.md`: list verifier coverage in the current command/status section.
- Modify `docs/implementation-status.md`: add Plan 11 delivery notes and update known verifier gaps.

## Design Alignment

This plan implements the verifier portion of design spec §3.4 and improves §11 deterministic unit coverage. It intentionally does not add OS-specific real probe implementations, scheduled verification replay, or TUI rendering.

---

### Task 1: Package And Service Verification

**Files:**
- Modify: `packages/verifier/src/verify.ts`
- Modify: `packages/verifier/test/verify.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/verifier/test/verify.test.ts`:

```ts
it("verifies package-version with optional expected version", async () => {
  const results = await verifyPlan([{ type: "package-version", name: "nginx", expect: "1.24.0" }], {
    getPackageVersion: async (name) => (name === "nginx" ? "1.24.0" : undefined),
  });

  expect(results[0]).toMatchObject({ ok: true, message: "package nginx version 1.24.0" });
});

it("fails package-version when installed version differs", async () => {
  const results = await verifyPlan([{ type: "package-version", name: "nginx", expect: "1.24.0" }], {
    getPackageVersion: async () => "1.23.0",
  });

  expect(results[0]).toMatchObject({ ok: false, message: "package nginx version 1.23.0 did not match 1.24.0" });
});

it("verifies service-status against the expected status", async () => {
  const results = await verifyPlan([{ type: "service-status", name: "nginx", expect: "active" }], {
    getServiceStatus: async () => "active",
  });

  expect(results[0]).toMatchObject({ ok: true, message: "service nginx status active" });
});

it("fails service-status when actual status differs", async () => {
  const results = await verifyPlan([{ type: "service-status", name: "nginx", expect: "active" }], {
    getServiceStatus: async () => "stopped",
  });

  expect(results[0]).toMatchObject({ ok: false, message: "service nginx status stopped did not match active" });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm --filter @opsforge/verifier exec vitest run test/verify.test.ts
```

Expected: FAIL because the new dependency hooks are not in `VerifyDeps` and the verification types are unsupported.

- [ ] **Step 3: Implement package/service checks**

Update `VerifyDeps` in `packages/verifier/src/verify.ts`:

```ts
getPackageVersion?: (name: string) => Promise<string | undefined>;
getServiceStatus?: (name: string) => Promise<string | undefined>;
```

Add branches to `verifyOne()`:

```ts
if (verification.type === "package-version") {
  if (!deps.getPackageVersion) return { verification, ok: false, message: "missing getPackageVersion dependency" };
  const actual = await deps.getPackageVersion(verification.name);
  if (!actual) return { verification, ok: false, message: `package ${verification.name} is not installed` };
  if (verification.expect && actual !== verification.expect) {
    return { verification, ok: false, message: `package ${verification.name} version ${actual} did not match ${verification.expect}` };
  }
  return { verification, ok: true, message: `package ${verification.name} version ${actual}` };
}

if (verification.type === "service-status") {
  if (!deps.getServiceStatus) return { verification, ok: false, message: "missing getServiceStatus dependency" };
  const actual = await deps.getServiceStatus(verification.name);
  if (!actual) return { verification, ok: false, message: `service ${verification.name} status unavailable` };
  if (actual !== verification.expect) {
    return { verification, ok: false, message: `service ${verification.name} status ${actual} did not match ${verification.expect}` };
  }
  return { verification, ok: true, message: `service ${verification.name} status ${actual}` };
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/verifier exec vitest run test/verify.test.ts
```

Expected: PASS for package/service tests.

---

### Task 2: Port And Process Verification

**Files:**
- Modify: `packages/verifier/src/verify.ts`
- Modify: `packages/verifier/test/verify.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/verifier/test/verify.test.ts`:

```ts
it("verifies port-open using an injected port checker", async () => {
  const results = await verifyPlan([{ type: "port-open", port: 8080 }], {
    isPortOpen: async (port) => port === 8080,
  });

  expect(results[0]).toMatchObject({ ok: true, message: "port 8080 is open" });
});

it("fails port-open when injected checker reports closed", async () => {
  const results = await verifyPlan([{ type: "port-open", port: 8080 }], {
    isPortOpen: async () => false,
  });

  expect(results[0]).toMatchObject({ ok: false, message: "port 8080 is closed" });
});

it("verifies process-alive using an injected process checker", async () => {
  const results = await verifyPlan([{ type: "process-alive", name: "nginx" }], {
    isProcessAlive: async (name) => name === "nginx",
  });

  expect(results[0]).toMatchObject({ ok: true, message: "process nginx is alive" });
});

it("fails process-alive when injected checker reports missing process", async () => {
  const results = await verifyPlan([{ type: "process-alive", name: "nginx" }], {
    isProcessAlive: async () => false,
  });

  expect(results[0]).toMatchObject({ ok: false, message: "process nginx is not alive" });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm --filter @opsforge/verifier exec vitest run test/verify.test.ts
```

Expected: FAIL because port/process verification is unsupported.

- [ ] **Step 3: Implement port/process checks**

Update `VerifyDeps`:

```ts
isPortOpen?: (port: number) => Promise<boolean>;
isProcessAlive?: (name: string) => Promise<boolean>;
```

Add branches:

```ts
if (verification.type === "port-open") {
  if (!deps.isPortOpen) return { verification, ok: false, message: "missing isPortOpen dependency" };
  const open = await deps.isPortOpen(verification.port);
  return { verification, ok: open, message: open ? `port ${verification.port} is open` : `port ${verification.port} is closed` };
}

if (verification.type === "process-alive") {
  if (!deps.isProcessAlive) return { verification, ok: false, message: "missing isProcessAlive dependency" };
  const alive = await deps.isProcessAlive(verification.name);
  return { verification, ok: alive, message: alive ? `process ${verification.name} is alive` : `process ${verification.name} is not alive` };
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
pnpm --filter @opsforge/verifier exec vitest run test/verify.test.ts
```

Expected: PASS.

---

### Task 3: Missing Dependency And Documentation

**Files:**
- Modify: `packages/verifier/test/verify.test.ts`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

- [ ] **Step 1: Replace unsupported test with missing dependency assertions**

Replace the unsupported `service-status` test with:

```ts
it("fails host-specific verification types when required dependencies are missing", async () => {
  const results = await verifyPlan([
    { type: "package-version", name: "nginx" },
    { type: "service-status", name: "nginx", expect: "active" },
    { type: "port-open", port: 8080 },
    { type: "process-alive", name: "nginx" },
  ], {});

  expect(results.map((result) => result.message)).toEqual([
    "missing getPackageVersion dependency",
    "missing getServiceStatus dependency",
    "missing isPortOpen dependency",
    "missing isProcessAlive dependency",
  ]);
});
```

- [ ] **Step 2: Update docs**

In `README.md`, add Plan 11 to the current status list.

In `docs/implementation-status.md`, add:

```md
## Delivered In Plan 11

- `@opsforge/verifier`
  - Supports `package-version`, `service-status`, `port-open`, and `process-alive` through injected host-check dependencies.
  - Missing host-check dependencies fail explicitly instead of passing silently.
```

Update the §11 Tests evidence and known gaps to say verifier coverage exists, while real OS-specific default probe implementations remain open.

- [ ] **Step 3: Run verifier tests**

Run:

```bash
pnpm --filter @opsforge/verifier exec vitest run test/verify.test.ts
```

Expected: PASS.

---

### Task 4: Full Verification, Commit, Push

**Files:**
- All files touched above.

- [ ] **Step 1: Run full build**

Run:

```bash
pnpm build
```

Expected: exit 0.

- [ ] **Step 2: Run full test suite**

Run:

```bash
pnpm test
```

Expected: exit 0. Node 24 may print the known `node:sqlite` ExperimentalWarning.

- [ ] **Step 3: Run full typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 4: Review status and design drift**

Run:

```bash
git status --short --branch
git diff -- docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md
git diff --stat
```

Expected: spec unchanged; `docs/pi_soul.md` remains untracked and untouched.

- [ ] **Step 5: Commit and push**

Run:

```bash
git add README.md docs/implementation-status.md docs/superpowers/plans/2026-06-23-opsforge-plan-11-verifier-coverage.md packages/verifier/src/verify.ts packages/verifier/test/verify.test.ts
git commit -m "feat: expand verifier coverage"
git push origin main
git rev-parse HEAD
git rev-parse origin/main
```

Expected: local and remote hashes match.

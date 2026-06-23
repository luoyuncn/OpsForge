import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPlan } from "../src/index";

describe("verifyPlan", () => {
  it("passes smoke-test when exit code matches expected code", async () => {
    const results = await verifyPlan([{ type: "smoke-test", cmd: "nginx -v", expectExit: 2 }], {
      runCommand: async () => ({ stdout: "", stderr: "nginx", exitCode: 2 }),
    });

    expect(results[0]).toMatchObject({ ok: true, message: "smoke-test exited 2" });
  });

  it("verifies file checksum from injected reader", async () => {
    const sha256 = createHash("sha256").update("hello").digest("hex");
    const results = await verifyPlan([{ type: "file-checksum", path: "/tmp/a", sha256 }], {
      readFile: async () => "hello",
    });

    expect(results[0].ok).toBe(true);
  });

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
});

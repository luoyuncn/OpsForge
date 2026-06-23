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

  it("fails unsupported verification types with a useful message", async () => {
    const results = await verifyPlan([{ type: "service-status", name: "nginx", expect: "active" }], {});
    expect(results[0]).toMatchObject({ ok: false, message: "unsupported verification: service-status" });
  });
});

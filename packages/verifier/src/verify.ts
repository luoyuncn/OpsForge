import { createHash } from "node:crypto";
import type { Verification } from "@opsforge/dsl";

export interface VerificationCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface VerifyDeps {
  runCommand?: (cmd: string) => Promise<VerificationCommandResult>;
  readFile?: (path: string) => Promise<string | Buffer>;
  getPackageVersion?: (name: string) => Promise<string | undefined>;
  getServiceStatus?: (name: string) => Promise<string | undefined>;
  isPortOpen?: (port: number) => Promise<boolean>;
  isProcessAlive?: (name: string) => Promise<boolean>;
}

export interface VerificationResult {
  verification: Verification;
  ok: boolean;
  message: string;
}

const checksum = (content: string | Buffer): string => createHash("sha256").update(content).digest("hex");

const verifyOne = async (verification: Verification, deps: VerifyDeps): Promise<VerificationResult> => {
  if (verification.type === "smoke-test") {
    if (!deps.runCommand) {
      return { verification, ok: false, message: "missing runCommand dependency" };
    }
    const result = await deps.runCommand(verification.cmd);
    const expected = verification.expectExit ?? 0;
    return {
      verification,
      ok: result.exitCode === expected,
      message: `smoke-test exited ${result.exitCode}`,
    };
  }

  if (verification.type === "file-checksum") {
    if (!deps.readFile) {
      return { verification, ok: false, message: "missing readFile dependency" };
    }
    const content = await deps.readFile(verification.path);
    const actual = checksum(content);
    return {
      verification,
      ok: actual === verification.sha256,
      message: actual === verification.sha256 ? "checksum matched" : `checksum mismatch: ${actual}`,
    };
  }

  if (verification.type === "package-version") {
    if (!deps.getPackageVersion) {
      return { verification, ok: false, message: "missing getPackageVersion dependency" };
    }
    const actual = await deps.getPackageVersion(verification.name);
    if (!actual) {
      return { verification, ok: false, message: `package ${verification.name} is not installed` };
    }
    if (verification.expect && actual !== verification.expect) {
      return {
        verification,
        ok: false,
        message: `package ${verification.name} version ${actual} did not match ${verification.expect}`,
      };
    }
    return { verification, ok: true, message: `package ${verification.name} version ${actual}` };
  }

  if (verification.type === "service-status") {
    if (!deps.getServiceStatus) {
      return { verification, ok: false, message: "missing getServiceStatus dependency" };
    }
    const actual = await deps.getServiceStatus(verification.name);
    if (!actual) {
      return { verification, ok: false, message: `service ${verification.name} status unavailable` };
    }
    if (actual !== verification.expect) {
      return {
        verification,
        ok: false,
        message: `service ${verification.name} status ${actual} did not match ${verification.expect}`,
      };
    }
    return { verification, ok: true, message: `service ${verification.name} status ${actual}` };
  }

  if (verification.type === "port-open") {
    if (!deps.isPortOpen) {
      return { verification, ok: false, message: "missing isPortOpen dependency" };
    }
    const open = await deps.isPortOpen(verification.port);
    return {
      verification,
      ok: open,
      message: open ? `port ${verification.port} is open` : `port ${verification.port} is closed`,
    };
  }

  if (verification.type === "process-alive") {
    if (!deps.isProcessAlive) {
      return { verification, ok: false, message: "missing isProcessAlive dependency" };
    }
    const alive = await deps.isProcessAlive(verification.name);
    return {
      verification,
      ok: alive,
      message: alive ? `process ${verification.name} is alive` : `process ${verification.name} is not alive`,
    };
  }

  const unsupported = verification as { type: string };
  return { verification, ok: false, message: `unsupported verification: ${unsupported.type}` };
};

export const verifyPlan = async (verifications: Verification[], deps: VerifyDeps): Promise<VerificationResult[]> =>
  Promise.all(verifications.map((verification) => verifyOne(verification, deps)));

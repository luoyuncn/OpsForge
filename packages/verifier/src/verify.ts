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

  return { verification, ok: false, message: `unsupported verification: ${verification.type}` };
};

export const verifyPlan = async (verifications: Verification[], deps: VerifyDeps): Promise<VerificationResult[]> =>
  Promise.all(verifications.map((verification) => verifyOne(verification, deps)));

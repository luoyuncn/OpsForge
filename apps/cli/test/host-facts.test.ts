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

  it("detects linux non-root elevation", () => {
    const facts = detectLocalHostFacts({
      platform: "linux",
      arch: "arm64",
      which: (cmd) => cmd === "apt",
      getUid: () => 1000,
      linuxRelease: "ID=debian\nVERSION_ID=12\n",
    });

    expect(facts).toMatchObject({
      osFamily: "linux",
      arch: "arm64",
      distro: "debian",
      version: "12",
      isElevated: false,
      packageManagers: ["apt"],
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

  it("detects windows non-admin elevation when the probe fails", async () => {
    const facts = await detectLocalHostFactsAsync({
      platform: "win32",
      arch: "x64",
      which: (cmd) => cmd === "choco",
      runCommand: async () => ({ stdout: "", stderr: "Access is denied.", exitCode: 1 }),
    });

    expect(facts).toEqual({
      osFamily: "windows",
      arch: "x64",
      isElevated: false,
      packageManagers: ["choco"],
    });
  });
});

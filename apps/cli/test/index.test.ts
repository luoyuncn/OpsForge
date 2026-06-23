import { describe, expect, it } from "vitest";
import { formatNoTtyFallback, shouldLaunchTui } from "../src/index";

describe("shouldLaunchTui", () => {
  it("launches TUI only for no-argument interactive terminals", () => {
    expect(shouldLaunchTui([], true, true)).toBe(true);
    expect(shouldLaunchTui(["doctor"], true, true)).toBe(false);
    expect(shouldLaunchTui([], false, true)).toBe(false);
    expect(shouldLaunchTui([], true, false)).toBe(false);
  });
});

describe("formatNoTtyFallback", () => {
  it("explains non-TTY fallback while preserving a TUI snapshot", () => {
    const output = formatNoTtyFallback("Forge\nAsk Forge >");

    expect(output).toContain("OpsForge TUI requires an interactive terminal");
    expect(output).toContain("Forge");
    expect(output).toContain("Use `opsforge --help`");
  });
});

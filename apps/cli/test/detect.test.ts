import { describe, it, expect } from "vitest";
import { detectOs, detectPackageManagers } from "../src/detect";

describe("detectOs", () => {
  it("maps node platforms to OS family", () => {
    expect(detectOs("linux")).toBe("linux");
    expect(detectOs("win32")).toBe("windows");
    expect(detectOs("darwin")).toBe("other");
  });
});

describe("detectPackageManagers", () => {
  it("filters linux candidates by the which probe", () => {
    expect(detectPackageManagers("linux", (c) => c === "apt")).toEqual(["apt"]);
  });

  it("filters windows candidates", () => {
    expect(detectPackageManagers("windows", (c) => c === "winget")).toEqual(["winget"]);
  });

  it("returns empty for an unsupported OS", () => {
    expect(detectPackageManagers("other", () => true)).toEqual([]);
  });
});

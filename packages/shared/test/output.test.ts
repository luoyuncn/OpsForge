import { describe, it, expect } from "vitest";
import { truncateOutput } from "../src/output";

describe("truncateOutput", () => {
  it("returns text unchanged when under the byte limit", () => {
    expect(truncateOutput("hello", 100)).toEqual({ text: "hello", truncated: false });
  });

  it("truncates and flags when over the byte limit", () => {
    const r = truncateOutput("abcdef", 3);
    expect(r.truncated).toBe(true);
    expect(Buffer.byteLength(r.text, "utf8")).toBeLessThanOrEqual(3);
  });
});

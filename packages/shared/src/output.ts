export interface TruncateResult {
  text: string;
  truncated: boolean;
}

/** Truncate to a UTF-8 byte limit and report whether content was shortened. */
export function truncateOutput(text: string, maxBytes: number): TruncateResult {
  const buf = Buffer.from(text, "utf8");
  if (buf.byteLength <= maxBytes) {
    return { text, truncated: false };
  }
  return { text: buf.subarray(0, maxBytes).toString("utf8"), truncated: true };
}

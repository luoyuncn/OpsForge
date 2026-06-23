export type InputIntent =
  | { kind: "command"; name: string; args: string[]; raw: string }
  | { kind: "task"; text: string };

export const parseInput = (value: string): InputIntent => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return { kind: "task", text: trimmed };

  const [namePart = "", ...args] = trimmed.slice(1).split(/\s+/).filter(Boolean);
  return {
    kind: "command",
    name: namePart.toLowerCase(),
    args,
    raw: trimmed,
  };
};

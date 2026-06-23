export interface ExtractPlanCandidateResult {
  candidate: unknown;
  raw: string;
}

const fencedJsonPattern = /```(?:json)?\s*([\s\S]*?)```/gi;

const parseJson = (text: string): unknown | undefined => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const extractBalancedJsonObjects = (text: string): string[] => {
  const objects: string[] = [];
  const stack: number[] = [];
  let inString = false;
  let escaped = false;
  let start = -1;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (stack.length === 0) start = index;
      stack.push(index);
      continue;
    }

    if (char === "}" && stack.length) {
      stack.pop();
      if (stack.length === 0 && start >= 0) {
        objects.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
};

export const extractPlanCandidate = (input: unknown): ExtractPlanCandidateResult => {
  if (typeof input !== "string") {
    return { candidate: input, raw: JSON.stringify(input) };
  }

  const fencedCandidates = [...input.matchAll(fencedJsonPattern)]
    .map((match) => match[1]?.trim())
    .filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of fencedCandidates) {
    const parsed = parseJson(candidate);
    if (parsed !== undefined) return { candidate: parsed, raw: candidate };
  }

  const direct = parseJson(input.trim());
  if (direct !== undefined) return { candidate: direct, raw: input };

  const largestJson = extractBalancedJsonObjects(input)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => parseJson(candidate) !== undefined);

  if (largestJson) {
    return { candidate: parseJson(largestJson), raw: largestJson };
  }

  return { candidate: input, raw: input };
};

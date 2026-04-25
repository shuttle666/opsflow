export type AiEvalMode = "cheap" | "llm";

export type AiEvalAssertion = {
  name: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  details?: unknown;
};

export type AiEvalResult = {
  name: string;
  prompt: string;
  mode: AiEvalMode;
  passed: boolean;
  assertions: AiEvalAssertion[];
  summary?: Record<string, unknown>;
};

export type AiEvalSummary = {
  mode: AiEvalMode;
  passed: boolean;
  total: number;
  failed: number;
  durationMs: number;
  results: AiEvalResult[];
};

export function pass(name: string, details?: unknown): AiEvalAssertion {
  return {
    name,
    passed: true,
    ...(details === undefined ? {} : { details }),
  };
}

export function fail(
  name: string,
  input: {
    expected?: unknown;
    actual?: unknown;
    details?: unknown;
  } = {},
): AiEvalAssertion {
  return {
    name,
    passed: false,
    ...input,
  };
}

export function expectEqual<T>(
  name: string,
  actual: T,
  expected: T,
): AiEvalAssertion {
  if (actual === expected) {
    return pass(name, { actual });
  }

  return fail(name, { actual, expected });
}

export function expectTruthy(
  name: string,
  actual: unknown,
  details?: unknown,
): AiEvalAssertion {
  return actual ? pass(name, details) : fail(name, { actual, expected: true });
}

export function resultFromAssertions(input: {
  name: string;
  prompt: string;
  mode: AiEvalMode;
  assertions: AiEvalAssertion[];
  summary?: Record<string, unknown>;
}): AiEvalResult {
  return {
    ...input,
    passed: input.assertions.every((assertion) => assertion.passed),
  };
}

export const EXPLICIT_CONFIRMATION_PHRASES = [
  "ok",
  "okay",
  "confirm",
  "confirm it",
  "ok, execute it",
  "execute",
  "execute it",
  "proceed",
  "go ahead",
  "确认",
  "确认执行",
  "执行",
  "可以了",
  "就这样执行",
  "按此执行",
  "继续执行",
] as const;

const explicitConfirmationPhrases = new Set<string>(
  EXPLICIT_CONFIRMATION_PHRASES,
);

/**
 * Normalize only presentation differences that cannot change intent.
 *
 * Question marks, commas, colons, and other meaning-bearing punctuation are
 * deliberately retained. This keeps questions and qualified instructions out
 * of the exact allowlist instead of trying to infer their meaning.
 */
export function normalizeExplicitConfirmationText(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/gu, " ")
    .replace(/[.!。！]+$/gu, "")
    .trim();
}

/**
 * Fail closed: conversational execution accepts only a short, explicit phrase
 * from the allowlist. Any question, rejection, qualification, or change request
 * remains pending for a person to clarify or approve in the Web app.
 */
export function isExplicitConfirmationText(value: string) {
  return explicitConfirmationPhrases.has(
    normalizeExplicitConfirmationText(value),
  );
}

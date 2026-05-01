const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "job",
  "work",
  "repair",
  "service",
  "services",
]);

const jobConceptPatterns = [
  ["leak", /leak|漏水|渗漏|漏/iu],
  ["tap", /\btaps?\b|\bfaucets?\b|水龙头|龙头/iu],
  ["kitchen", /\bkitchen\b|厨房/iu],
  ["dishwasher", /\bdish\s*washer\b|\bdishwasher\b|洗碗机/iu],
  ["investigation", /investigat|inspect|diagnos|调查|检查/iu],
  ["installation", /install|安装/iu],
  ["ceiling", /\bceiling\b|天花板|吊顶/iu],
  ["fan", /\bfans?\b|风扇|吊扇/iu],
  ["aircon", /\bair\s*con\b|\bac\b|\bair\s*condition|空调/iu],
  ["maintenance", /mainten|service|维护|保养/iu],
] satisfies Array<[string, RegExp]>;

export function normalizeSearchText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function tokenizeSearchText(value?: string | null) {
  return new Set(
    (normalizeSearchText(value).match(/[a-z0-9\u4e00-\u9fff]+/gu) ?? []).filter(
      (token) => token.length >= 2 && !stopWords.has(token),
    ),
  );
}

export function extractJobConcepts(value?: string | null) {
  const concepts = new Set<string>();
  const text = value ?? "";

  for (const [concept, pattern] of jobConceptPatterns) {
    if (pattern.test(text)) {
      concepts.add(concept);
    }
  }

  return Array.from(concepts);
}

export function normalizeJobConcepts(values?: string[] | null) {
  if (!values?.length) {
    return [];
  }

  const concepts = new Set<string>();

  for (const value of values) {
    for (const concept of extractJobConcepts(value)) {
      concepts.add(concept);
    }

    const normalized = normalizeSearchText(value);
    if (jobConceptPatterns.some(([concept]) => concept === normalized)) {
      concepts.add(normalized);
    }
  }

  return Array.from(concepts);
}

export function sharedTokenScore(query: string, candidate: string) {
  const queryTokens = tokenizeSearchText(query);
  const candidateTokens = tokenizeSearchText(candidate);

  if (queryTokens.size === 0 || candidateTokens.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      shared += 1;
    }
  }

  return shared / Math.max(queryTokens.size, 1);
}

export function sharedJobConceptScore(
  query: string,
  candidate: string,
  extraQueryConcepts?: string[],
) {
  const queryConcepts = new Set([
    ...extractJobConcepts(query),
    ...normalizeJobConcepts(extraQueryConcepts),
  ]);
  const candidateConcepts = new Set(extractJobConcepts(candidate));

  if (queryConcepts.size === 0 || candidateConcepts.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const concept of queryConcepts) {
    if (candidateConcepts.has(concept)) {
      shared += 1;
    }
  }

  return shared / Math.max(queryConcepts.size, 1);
}

export const GOLDEN_DEMO_VERSION = 1 as const;
export const GOLDEN_DEMO_STORAGE_KEY =
  `opsflow:golden-demo:v${GOLDEN_DEMO_VERSION}`;

export type GoldenDemoStatus =
  | "seen"
  | "dismissed"
  | "started"
  | "completed";

export type GoldenDemoProgress = {
  version: typeof GOLDEN_DEMO_VERSION;
  status: GoldenDemoStatus;
  currentStep?: number;
  updatedAt: string;
};

const goldenDemoStatuses = new Set<GoldenDemoStatus>([
  "seen",
  "dismissed",
  "started",
  "completed",
]);

function isBrowser() {
  return typeof window !== "undefined";
}

function isGoldenDemoProgress(value: unknown): value is GoldenDemoProgress {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<GoldenDemoProgress>;
  const hasValidStep =
    candidate.currentStep === undefined ||
    (Number.isInteger(candidate.currentStep) && (candidate.currentStep ?? -1) >= 0);

  return (
    candidate.version === GOLDEN_DEMO_VERSION &&
    typeof candidate.status === "string" &&
    goldenDemoStatuses.has(candidate.status as GoldenDemoStatus) &&
    typeof candidate.updatedAt === "string" &&
    hasValidStep
  );
}

export function readGoldenDemoProgress(): GoldenDemoProgress | null {
  if (!isBrowser()) {
    return null;
  }

  const stored = window.localStorage.getItem(GOLDEN_DEMO_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    return isGoldenDemoProgress(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeGoldenDemoProgress(
  status: GoldenDemoStatus,
  currentStep?: number,
): GoldenDemoProgress {
  const progress: GoldenDemoProgress = {
    version: GOLDEN_DEMO_VERSION,
    status,
    ...(currentStep === undefined ? {} : { currentStep }),
    updatedAt: new Date().toISOString(),
  };

  if (isBrowser()) {
    window.localStorage.setItem(GOLDEN_DEMO_STORAGE_KEY, JSON.stringify(progress));
  }

  return progress;
}

export function clearGoldenDemoProgress() {
  if (isBrowser()) {
    window.localStorage.removeItem(GOLDEN_DEMO_STORAGE_KEY);
  }
}

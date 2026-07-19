"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "@/components/ui/icons";
import {
  readGoldenDemoProgress,
  writeGoldenDemoProgress,
  type GoldenDemoProgress,
} from "./golden-demo-storage";

export function GoldenDemoWelcome() {
  const [progress, setProgress] = useState<GoldenDemoProgress | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const stored = readGoldenDemoProgress();
      if (stored?.status === "started" && stored.currentStep === 0) {
        writeGoldenDemoProgress("seen", stored.currentStep);
        setProgress(stored);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!progress) {
    return null;
  }

  const closeWelcome = (status: "seen" | "dismissed") => {
    writeGoldenDemoProgress(status, progress.currentStep);
    setProgress(null);
  };

  return (
    <section
      aria-labelledby="golden-demo-welcome-title"
      className="mb-5 rounded-[22px] border border-[var(--color-brand)]/35 bg-[var(--color-brand-soft)] p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-app-panel)] text-[var(--color-brand)] shadow-sm">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="golden-demo-welcome-title"
            className="text-sm font-bold text-[var(--color-text)]"
          >
            Your demo workspace is ready
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
            Start with a suggested request below to explore the AI planning and
            approval flow. Your sample data is isolated and expires automatically.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => closeWelcome("seen")}
              className="inline-flex min-h-10 items-center justify-center rounded-[14px] bg-[var(--color-brand)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
            >
              View suggested requests
            </button>
            <button
              type="button"
              onClick={() => closeWelcome("dismissed")}
              className="inline-flex min-h-10 items-center justify-center rounded-[14px] border border-[var(--color-app-border-strong)] bg-[var(--color-app-panel)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

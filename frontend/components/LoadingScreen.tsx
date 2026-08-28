"use client";

import { SparkleCluster } from "./Brand";

/**
 * Extraction takes two vision calls plus grading, so the wait is real.
 * The stage line below the heading tells the teacher it has not stalled.
 */
export function LoadingScreen({ stage }: { stage: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-panel bg-surface px-6 py-16">
      <SparkleCluster />
      <h1 className="mt-5 text-[22px] font-bold tracking-tight">Extracting...</h1>
      <p className="mt-1 text-[14px] text-ink-muted">This may take a while</p>
      <p aria-live="polite" className="mt-6 text-[12.5px] text-ink-faint">
        {stage}
      </p>
    </div>
  );
}

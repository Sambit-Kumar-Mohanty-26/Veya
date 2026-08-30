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
      {/* The heading's fill is a symmetric dark-light-dark ramp across the
          line, so it has to be painted as a background and clipped to the
          glyphs - a `color` can only be flat. Sizing it to twice the box lets
          the ramp travel through the word instead of sitting still. */}
      <h1 className="mt-5 animate-shimmer bg-[linear-gradient(90deg,#303030,#606060,#808080,#606060,#303030)] bg-[length:200%_100%] bg-clip-text text-[30px] font-bold leading-9 tracking-[-1.2px] text-transparent">
        Extracting...
      </h1>
      <p className="text-[20px] leading-9 tracking-[-1.2px] text-[#464646]/75">This may take a while</p>
      <p aria-live="polite" className="mt-6 text-[12.5px] text-ink-faint">
        {stage}
      </p>
    </div>
  );
}

"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export type ProgressStatus = "pending" | "active" | "complete" | "error";

type ProgressStep = {
  key: string;
  label: string;
  status: ProgressStatus;
};

type ProgressStepsProps = {
  steps: ProgressStep[];
};

export function ProgressSteps({ steps }: ProgressStepsProps) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <h2 className="text-sm font-semibold text-ink">Processing progress</h2>
      <div className="mt-3 grid gap-2">
        {steps.map((step) => (
          <div key={step.key} className="flex items-center gap-3 rounded-md bg-[#fbfaf6] px-3 py-2">
            {step.status === "complete" ? <CheckCircle2 className="h-4 w-4 text-sage" aria-hidden="true" /> : null}
            {step.status === "active" ? <Loader2 className="h-4 w-4 animate-spin text-sky" aria-hidden="true" /> : null}
            {step.status === "pending" ? <Circle className="h-4 w-4 text-muted" aria-hidden="true" /> : null}
            {step.status === "error" ? <Circle className="h-4 w-4 text-clay" aria-hidden="true" /> : null}
            <span className="text-sm text-ink">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

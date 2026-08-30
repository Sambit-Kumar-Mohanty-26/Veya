"use client";

import { useEffect, useRef, useState } from "react";
import type { Mapping, ProcessResult } from "@/lib/types";
import { AnswerSheetViewer } from "./AnswerSheetViewer";
import { QuestionList } from "./QuestionList";
import { ScrollPill } from "./ScrollPill";

type MappingScreenProps = {
  result: ProcessResult;
  answerSheet: File;
  selected: Mapping | null;
  selectedId: string | null;
  expandedIds: Set<string>;
  overrides: Record<string, string>;
  onSelect: (questionId: string) => void;
  onToggleExpand: (questionId: string) => void;
  onExpandAll: () => void;
  onOverride: (questionId: string, answerId: string) => void;
};

export function MappingScreen({
  result,
  answerSheet,
  selected,
  selectedId,
  expandedIds,
  overrides,
  onSelect,
  onToggleExpand,
  onExpandAll,
  onOverride
}: MappingScreenProps) {
  // On phones the two panels do not fit side by side, so they become tabs.
  const [tab, setTab] = useState<"questions" | "answer">("questions");
  const isNarrow = useIsNarrow();
  const listRef = useRef<HTMLDivElement>(null);

  const regions = selected?.answerRegions ?? [];
  const hasLocatedRegion = regions.some((region) => region.bbox);

  const emptyMessage =
    selected == null
      ? null
      : selected.status === "unanswered"
        ? `Q${selected.questionNumber}${selected.part ?? ""} was not answered on this sheet.`
        : !hasLocatedRegion
          ? "The answer was matched, but its position on the page could not be located."
          : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Summary result={result} />

      <div className="flex shrink-0 gap-1 rounded-full bg-surface p-1 md:hidden">
        {(["questions", "answer"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={`h-9 flex-1 rounded-full text-[13.5px] font-medium transition ${
              tab === value ? "bg-ink text-white" : "text-ink-muted"
            }`}
          >
            {value === "questions" ? "Questions" : "Answer Sheet"}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(360px,0.85fr)_minmax(0,1fr)]">
        {/* The pill hangs outside the list panel to fill the 12px seam between
            the two columns exactly. Stacked on mobile there is no seam, so it
            tucks back inside. */}
        <div className={`relative min-h-0 min-w-0 ${tab === "questions" ? "flex" : "hidden"} md:flex`}>
          <ScrollPill target={listRef} className="right-1.5 md:-right-3" />
          <QuestionList
            scrollRef={listRef}
            mappings={result.mappings}
            selectedId={selectedId}
            expandedIds={expandedIds}
            overrides={overrides}
            onSelect={(questionId) => {
              onSelect(questionId);
              setTab("answer");
            }}
            onToggleExpand={onToggleExpand}
            onExpandAll={onExpandAll}
            onOverride={onOverride}
          />
        </div>

        <div className={`min-h-0 min-w-0 ${tab === "answer" ? "flex" : "hidden"} md:flex`}>
          <AnswerSheetViewer
            file={answerSheet}
            regions={regions}
            tag={selected ? `Q${selected.questionNumber}${selected.part ?? ""}` : null}
            emptyMessage={emptyMessage}
            active={tab === "answer" || !isNarrow}
          />
        </div>
      </div>
    </div>
  );
}

/** Score and counts, shown above both panels once grading has run. */
function Summary({ result }: { result: ProcessResult }) {
  const { grading, summary } = result;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5 rounded-panel bg-surface px-4 py-2.5 sm:py-3">
      {grading && (
        <span className="flex items-baseline gap-1.5">
          <span className="text-[22px] font-bold leading-none tabular-nums">
            {grading.awardedMarks}
            <span className="text-ink-faint">/{grading.totalMarks}</span>
          </span>
          <span className="rounded-md bg-mark-full-bg px-1.5 py-0.5 text-[11.5px] font-semibold text-mark-full tabular-nums">
            {Math.round(grading.percentage)}%
          </span>
        </span>
      )}

      <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-muted">
        <Stat value={summary.totalQuestions} label="questions" />
        <Stat value={summary.answered} label="answered" />
        <Stat value={summary.unanswered} label="unanswered" />
        {summary.needsReview > 0 && (
          <Stat value={summary.needsReview} label="need review" tone="text-mark-part" />
        )}
        {summary.unmatchedAnswers > 0 && <Stat value={summary.unmatchedAnswers} label="unmatched" />}
      </span>

      {grading?.summary && (
        <p className="line-clamp-2 w-full text-[12.5px] leading-relaxed text-ink-muted lg:line-clamp-none lg:w-auto lg:flex-1 lg:border-l lg:border-line lg:pl-5">
          {grading.summary}
        </p>
      )}
    </div>
  );
}

function Stat({ value, label, tone = "text-ink" }: { value: number; label: string; tone?: string }) {
  return (
    <span>
      <span className={`font-semibold tabular-nums ${tone}`}>{value}</span> {label}
    </span>
  );
}

/** Matches the `md` breakpoint the tab switcher appears at. */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return narrow;
}

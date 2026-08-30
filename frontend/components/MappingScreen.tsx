"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Mapping, ProcessResult } from "@/lib/types";
import { AnswerSheetViewer } from "./AnswerSheetViewer";
import { QuestionList } from "./QuestionList";
import { ScrollPill } from "./ScrollPill";

type MappingScreenProps = {
  result: ProcessResult;
  /** The teacher's view of `result.mappings`: reassignments and re-marks applied. */
  mappings: Mapping[];
  answerSheet: File[];
  selected: Mapping | null;
  /** A question id, or the id of an unmatched answer. */
  selectedId: string | null;
  expandedIds: Set<string>;
  overrides: Record<string, string>;
  regrading: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (questionId: string) => void;
  onExpandAll: () => void;
  onOverride: (questionId: string, answerId: string) => void;
};

export function MappingScreen({
  result,
  mappings,
  answerSheet,
  selected,
  selectedId,
  expandedIds,
  overrides,
  regrading,
  onSelect,
  onToggleExpand,
  onExpandAll,
  onOverride
}: MappingScreenProps) {
  // On phones the two panels do not fit side by side, so they become tabs.
  const [tab, setTab] = useState<"questions" | "answer">("questions");
  const isNarrow = useIsNarrow();
  const listRef = useRef<HTMLDivElement>(null);

  // An answer that matched nothing is selectable too: it is still writing on
  // the sheet the teacher may want to find, and its regions highlight the same
  // way a mapped answer's do.
  const unmatched = result.unmatchedAnswers.find((answer) => answer.id === selectedId) ?? null;
  const regions = unmatched ? unmatched.pages : (selected?.answerRegions ?? []);
  const hasLocatedRegion = regions.some((region) => region.bbox);

  const emptyMessage = unmatched
    ? hasLocatedRegion
      ? null
      : "This answer could not be located on the page."
    : selected == null
      ? null
      : selected.status === "unanswered"
        ? `Q${selected.questionNumber}${selected.part ?? ""} was not answered on this sheet.`
        : !hasLocatedRegion
          ? "The answer was matched, but its position on the page could not be located."
          : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* The model's closing remark is dropped as soon as the teacher reassigns
          anything: it was written about the paper as first mapped, and it reads
          as a verdict on a score it no longer matches. */}
      <Summary
        mappings={mappings}
        unmatchedAnswers={result.unmatchedAnswers.length}
        note={Object.keys(overrides).length > 0 ? undefined : result.grading?.summary}
      />

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
            mappings={mappings}
            unmatchedAnswers={result.unmatchedAnswers}
            selectedId={selectedId}
            expandedIds={expandedIds}
            overrides={overrides}
            regrading={regrading}
            onSelect={(id) => {
              onSelect(id);
              setTab("answer");
            }}
            onToggleExpand={onToggleExpand}
            onExpandAll={onExpandAll}
            onOverride={onOverride}
          />
        </div>

        <div className={`min-h-0 min-w-0 ${tab === "answer" ? "flex" : "hidden"} md:flex`}>
          <AnswerSheetViewer
            files={answerSheet}
            regions={regions}
            tag={
              unmatched ? "Unmatched" : selected ? `Q${selected.questionNumber}${selected.part ?? ""}` : null
            }
            emptyMessage={emptyMessage}
            active={tab === "answer" || !isNarrow}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Score and counts, shown above both panels once grading has run.
 *
 * Everything except the model's prose is counted off the mappings on screen
 * rather than read from the backend's own summary: reassigning an answer
 * re-marks that question, and a total that still describes the first pass is
 * worse than no total at all.
 */
function Summary({
  mappings,
  unmatchedAnswers,
  note
}: {
  mappings: Mapping[];
  unmatchedAnswers: number;
  note: string | undefined;
}) {
  const totals = useMemo(() => {
    const answered = mappings.filter((mapping) => mapping.status === "answered");
    const maxMarks = sum(mappings, (m) => m.grade?.maxMarks ?? m.marks ?? 0);
    const awarded = sum(mappings, (m) => m.grade?.awardedMarks ?? 0);

    return {
      maxMarks: round(maxMarks),
      awarded: round(awarded),
      percentage: maxMarks > 0 ? Math.round((awarded / maxMarks) * 100) : 0,
      graded: mappings.some((mapping) => mapping.grade),
      answered: answered.length,
      unanswered: mappings.length - answered.length,
      needsReview: answered.filter((mapping) => mapping.reviewStatus !== "high_confidence").length
    };
  }, [mappings]);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5 rounded-panel bg-surface px-4 py-2.5 sm:py-3">
      {totals.graded && (
        <span className="flex items-baseline gap-1.5">
          <span className="text-[22px] font-bold leading-none tabular-nums">
            {totals.awarded}
            <span className="text-ink-faint">/{totals.maxMarks}</span>
          </span>
          <span className="rounded-md bg-mark-full-bg px-1.5 py-0.5 text-[11.5px] font-semibold text-mark-full tabular-nums">
            {totals.percentage}%
          </span>
        </span>
      )}

      <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-muted">
        <Stat value={mappings.length} label="questions" />
        <Stat value={totals.answered} label="answered" />
        <Stat value={totals.unanswered} label="unanswered" />
        {totals.needsReview > 0 && (
          <Stat value={totals.needsReview} label="need review" tone="text-mark-part" />
        )}
        {unmatchedAnswers > 0 && <Stat value={unmatchedAnswers} label="unmatched" />}
      </span>

      {note && (
        <p className="line-clamp-2 w-full text-[12.5px] leading-relaxed text-ink-muted lg:line-clamp-none lg:w-auto lg:flex-1 lg:border-l lg:border-line lg:pl-5">
          {note}
        </p>
      )}
    </div>
  );
}

function sum(mappings: Mapping[], pick: (mapping: Mapping) => number): number {
  return mappings.reduce((total, mapping) => total + pick(mapping), 0);
}

/** Marks can be halves; anything finer is a rounding artefact. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
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

"use client";

import type { RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { markPill, markToneClass } from "@/lib/marks";
import type { AnswerEvidence, Mapping } from "@/lib/types";

type QuestionListProps = {
  mappings: Mapping[];
  /** Answer blocks that matched no question. Selectable, so they can be located. */
  unmatchedAnswers: AnswerEvidence[];
  /** A question id, or the id of an unmatched answer. */
  selectedId: string | null;
  expandedIds: Set<string>;
  overrides: Record<string, string>;
  /** Questions whose reassigned answer is still being re-marked. */
  regrading: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (questionId: string) => void;
  onExpandAll: () => void;
  onOverride: (questionId: string, answerId: string) => void;
  /** Owned by MappingScreen, which hangs the scroll pill in the panel seam. */
  scrollRef: RefObject<HTMLDivElement | null>;
};

export function QuestionList({
  mappings,
  unmatchedAnswers,
  selectedId,
  expandedIds,
  overrides,
  regrading,
  onSelect,
  onToggleExpand,
  onExpandAll,
  onOverride,
  scrollRef
}: QuestionListProps) {
  // Counted by membership, not by size: selecting an unmatched answer also puts
  // its id in the set, and a plain length comparison would flip the button.
  const allExpanded = mappings.every((mapping) => expandedIds.has(mapping.questionId));

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-panel bg-surface-list">
      <div className="flex h-[60px] shrink-0 items-center justify-between gap-3 px-5 sm:px-6">
        <h2 className="truncate text-[14px] font-semibold">Extracted Questions (from question paper)</h2>
        <button
          type="button"
          onClick={onExpandAll}
          className="shrink-0 rounded-full bg-surface px-3.5 py-2 text-[12.5px] font-medium shadow-card transition hover:bg-surface-sunken"
        >
          {allExpanded ? "Collapse All" : "Expand All"}
        </button>
      </div>

      <div ref={scrollRef} className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 pt-1 sm:px-3">
        <ul className="flex flex-col gap-2">
          {mappings.map((mapping) => (
            <QuestionRow
              key={mapping.questionId}
              mapping={mapping}
              isSelected={mapping.questionId === selectedId}
              isExpanded={expandedIds.has(mapping.questionId)}
              overriddenAnswerId={overrides[mapping.questionId]}
              isRegrading={regrading.has(mapping.questionId)}
              onSelect={() => onSelect(mapping.questionId)}
              onToggleExpand={() => onToggleExpand(mapping.questionId)}
              onOverride={(answerId) => onOverride(mapping.questionId, answerId)}
            />
          ))}
        </ul>

        {/* Writing the model found on the sheet but could not tie to any
            question. It is the other half of the mapping result: without it a
            mis-numbered answer simply disappears, and the teacher has no way
            to see that the paper was answered at all. */}
        {unmatchedAnswers.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="px-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint">
              Unmatched answers ({unmatchedAnswers.length})
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {unmatchedAnswers.map((answer) => (
                <li key={answer.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(answer.id)}
                    aria-pressed={answer.id === selectedId}
                    className={`w-full rounded-card bg-surface px-4 py-2.5 text-left transition ${
                      answer.id === selectedId
                        ? "ring-2 ring-brand"
                        : "ring-1 ring-transparent hover:ring-line-strong"
                    }`}
                  >
                    <span className="line-clamp-2 text-[13px] leading-[1.5] text-ink-soft">
                      {answer.normalizedText || "Untranscribed answer block"}
                    </span>
                    <span className="mt-1 block text-[11.5px] text-ink-faint">
                      {answer.detectedQuestionNumber
                        ? `Labelled "${answer.detectedQuestionNumber}"`
                        : "No question number written"}
                      {answer.pages[0] && ` • page ${answer.pages[0].page}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function QuestionRow({
  mapping,
  isSelected,
  isExpanded,
  overriddenAnswerId,
  isRegrading,
  onSelect,
  onToggleExpand,
  onOverride
}: {
  mapping: Mapping;
  isSelected: boolean;
  isExpanded: boolean;
  overriddenAnswerId: string | undefined;
  isRegrading: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onOverride: (answerId: string) => void;
}) {
  const pill = markPill(mapping);
  const unanswered = mapping.status === "unanswered";
  const needsReview = mapping.status === "answered" && mapping.reviewStatus !== "high_confidence";

  return (
    <li>
      <div
        className={`relative overflow-hidden rounded-card bg-surface transition ${
          isSelected ? "ring-2 ring-brand" : "ring-1 ring-transparent hover:ring-line-strong"
        }`}
      >
        {/* Badge, mark, and chevron all centre on the question text, so a
            three-line question does not leave them stranded at the top.
            The controls sit outside the button because a button cannot nest. */}
        <div className="relative">
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={isSelected}
            className="block w-full px-4 py-2.5 pr-[112px] text-left"
          >
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-white/25 text-[12.5px] font-semibold text-white ${
                  isSelected ? "bg-brand shadow-badge-brand" : "bg-[#2B2B2B]/80 shadow-badge"
                }`}
              >
                {mapping.questionNumber}
              </span>
              {mapping.part && (
                <span className="shrink-0 text-[12.5px] font-semibold text-ink-soft">{mapping.part}.</span>
              )}
              <span className="w-full text-[13px] leading-[1.5] text-ink-soft sm:w-auto sm:flex-1">
                {mapping.questionText}
              </span>
            </span>
          </button>

          <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
            {isRegrading ? (
              <span className="animate-pulse rounded-lg bg-surface-panel px-2.5 py-1 text-[12px] font-semibold text-ink-faint">
                Re-marking
              </span>
            ) : pill ? (
              <span
                className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold tabular-nums ${markToneClass[pill.tone]}`}
              >
                {pill.label}
              </span>
            ) : (
              unanswered && (
                <span className="rounded-lg bg-mark-none-bg px-2.5 py-1 text-[12px] font-semibold text-mark-none">
                  Unanswered
                </span>
              )
            )}
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Hide details" : "Show details"}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-panel text-ink-soft transition hover:bg-surface-sunken"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4">
            <div className="rounded-xl bg-surface-panel p-3.5">
              <p className="text-[13px] font-semibold">AI Feedback</p>
              <p className="mt-1.5 text-[12.5px] leading-[1.55] text-ink-muted">
                {isRegrading
                  ? "Marking the answer you just assigned…"
                  : mapping.grade?.feedback ||
                    (unanswered
                      ? "No answer was found for this question on the sheet."
                      : "This answer has not been marked.")}
              </p>

              {mapping.status === "answered" && mapping.answerText && (
                <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-[1.55] text-ink-soft">
                  <span className="font-semibold">Mapped answer: </span>
                  {mapping.answerText}
                </p>
              )}

              {needsReview && mapping.alternativeCandidates.length > 0 && (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint">
                    Not the right answer?
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {mapping.alternativeCandidates.map((alt) => (
                      <button
                        key={alt.answerId}
                        type="button"
                        onClick={() => onOverride(alt.answerId)}
                        className={`rounded-lg px-2.5 py-2 text-left text-[12px] leading-snug transition ${
                          overriddenAnswerId === alt.answerId
                            ? "bg-brand-soft text-ink ring-1 ring-brand"
                            : "bg-surface text-ink-muted hover:bg-surface-sunken"
                        }`}
                      >
                        <span className="line-clamp-2">{alt.answerText || "Untranscribed answer block"}</span>
                        <span className="mt-1 block text-[11px] text-ink-faint tabular-nums">
                          {Math.round(alt.mappingScore * 100)}% match
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

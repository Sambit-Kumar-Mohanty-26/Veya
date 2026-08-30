"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MappingScreen } from "@/components/MappingScreen";
import { Sidebar } from "@/components/Sidebar";
import { MobileTopBar, TopBar } from "@/components/TopBar";
import { UploadScreen } from "@/components/UploadScreen";
import { gradeQuestions, processAssessment } from "@/lib/api";
import { countPages } from "@/lib/pdf";
import type { Mapping, ProcessResult, QuestionGrade } from "@/lib/types";

type Phase = "upload" | "processing" | "results";

/** Rotated under the "Extracting..." heading so a long wait still looks alive. */
const STAGES = [
  "Reading the question paper",
  "Detecting handwritten answer blocks",
  "Scoring question-answer evidence",
  "Mapping answers to questions",
  "Marking and writing feedback"
];

export default function Home() {
  const [phase, setPhase] = useState<Phase>("upload");
  // Either document may be several files - one photo per page - in page order.
  const [questionPaper, setQuestionPaper] = useState<File[]>([]);
  const [answerSheet, setAnswerSheet] = useState<File[]>([]);

  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(STAGES[0]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  /** Marks for questions whose answer the teacher reassigned. `null` = not marked. */
  const [regrades, setRegrades] = useState<Record<string, QuestionGrade | null>>({});
  const [regrading, setRegrading] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const menuRef = useRef<HTMLDialogElement>(null);

  const questionPaperPages = useTotalPages(questionPaper);
  const answerSheetPages = useTotalPages(answerSheet);

  // Advance the stage caption on a timer. It is a progress *indication*, not a
  // report - the backend runs these as one call and cannot stream its position.
  useEffect(() => {
    if (phase !== "processing") return;
    let index = 0;
    const timer = setInterval(() => {
      index = Math.min(index + 1, STAGES.length - 1);
      setStage(STAGES[index]);
    }, 6000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleStart = useCallback(async () => {
    if (!questionPaper.length || !answerSheet.length) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("processing");
    setStage(STAGES[0]);
    setError(null);
    setResult(null);
    setOverrides({});
    setRegrades({});
    setRegrading(new Set());
    setExpandedIds(new Set());
    setCollapsed(true);

    try {
      const payload = await processAssessment(questionPaper, answerSheet, controller.signal);
      setResult(payload);
      // The design opens on the first question with its feedback already showing.
      const first = payload.mappings[0]?.questionId ?? null;
      setSelectedId(first);
      setExpandedIds(first ? new Set([first]) : new Set());
      setPhase("results");
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "Processing failed.");
      setPhase("upload");
      setCollapsed(false);
    }
  }, [questionPaper, answerSheet]);

  /**
   * What the screen shows: the model's mappings with the teacher's
   * reassignments and their re-marks applied. Regions come from the full
   * `answers` list, not just the unmatched ones - most alternatives are
   * currently mapped to some other question, and using stale regions would
   * highlight the wrong place on the sheet.
   */
  const mappings = useMemo((): Mapping[] => {
    if (!result) return [];

    return result.mappings.map((base) => {
      const answer = result.answers.find((candidate) => candidate.id === overrides[base.questionId]);
      const merged: Mapping = answer
        ? {
            ...base,
            status: "answered",
            reviewStatus: "needs_review",
            answerId: answer.id,
            answerText: answer.normalizedText,
            answerRegions: answer.pages,
            mappingConfidence:
              base.alternativeCandidates.find((alt) => alt.answerId === answer.id)?.mappingScore ??
              base.mappingConfidence
          }
        : base;

      // The old mark described the answer that was just replaced, so it goes
      // even while the new one is still being marked.
      return base.questionId in regrades ? { ...merged, grade: regrades[base.questionId] } : merged;
    });
  }, [result, overrides, regrades]);

  const selected = useMemo(
    () => mappings.find((mapping) => mapping.questionId === selectedId) ?? null,
    [mappings, selectedId]
  );

  const toggleExpand = useCallback((questionId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(questionId)) next.add(questionId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds((prev) =>
      mappings.every((mapping) => prev.has(mapping.questionId))
        ? new Set()
        : new Set(mappings.map((mapping) => mapping.questionId))
    );
  }, [mappings]);

  /** `id` is a question id, or the id of an answer that matched no question. */
  const select = useCallback((id: string) => {
    setSelectedId(id);
    setExpandedIds((prev) => new Set(prev).add(id));
  }, []);

  /**
   * The teacher reassigns an answer, so the question is marked again: the mark
   * on screen was written about the answer that was just replaced. It is
   * cleared first and only restored by the new call, because a stale mark is
   * worse than none - the teacher would have no way to tell it was stale.
   */
  const override = useCallback(
    async (questionId: string, answerId: string) => {
      setOverrides((prev) => ({ ...prev, [questionId]: answerId }));

      const question = result?.mappings.find((mapping) => mapping.questionId === questionId);
      const answer = result?.answers.find((candidate) => candidate.id === answerId);
      if (!question || !answer) return;

      setRegrades((prev) => ({ ...prev, [questionId]: null }));
      setRegrading((prev) => new Set(prev).add(questionId));
      try {
        const grades = await gradeQuestions([
          {
            id: questionId,
            question: question.questionText,
            marks: question.marks,
            answer: answer.normalizedText
          }
        ]);
        setRegrades((prev) => ({ ...prev, [questionId]: grades[questionId] ?? null }));
      } catch {
        // Leave it unmarked. The row says so, which is the honest state.
      } finally {
        setRegrading((prev) => {
          const next = new Set(prev);
          next.delete(questionId);
          return next;
        });
      }
    },
    [result]
  );

  return (
    <div className="flex h-dvh gap-3 p-3">
      <Sidebar collapsed={collapsed || phase !== "upload"} onToggle={() => setCollapsed((value) => !value)} />

      <main className="flex min-w-0 flex-1 flex-col gap-3">
        <TopBar />
        <MobileTopBar onMenu={() => menuRef.current?.showModal()} />

        {/* The phone nav is the same Sidebar in a modal `<dialog>`, which brings
            its own backdrop, Escape-to-close and focus trapping - all of which a
            hand-rolled overlay div would have to re-implement. Clicks land on
            the dialog itself only when they hit the backdrop. */}
        <dialog
          ref={menuRef}
          onClick={(event) => event.target === event.currentTarget && menuRef.current?.close()}
          className="m-0 h-dvh max-h-none bg-transparent p-3 backdrop:bg-black/40 md:hidden"
        >
          <Sidebar collapsed={false} onToggle={() => menuRef.current?.close()} className="!flex h-full" />
        </dialog>

        {phase === "upload" && (
          <UploadScreen
            questionPaper={questionPaper}
            answerSheet={answerSheet}
            questionPaperPages={questionPaperPages}
            answerSheetPages={answerSheetPages}
            error={error}
            onQuestionPaper={(files) => {
              setQuestionPaper(files);
              setError(null);
            }}
            onAnswerSheet={(files) => {
              setAnswerSheet(files);
              setError(null);
            }}
            onReject={setError}
            onStart={handleStart}
          />
        )}

        {phase === "processing" && <LoadingScreen stage={stage} />}

        {phase === "results" && result && answerSheet.length > 0 && (
          <MappingScreen
            result={result}
            mappings={mappings}
            answerSheet={answerSheet}
            selected={selected}
            selectedId={selectedId}
            expandedIds={expandedIds}
            overrides={overrides}
            regrading={regrading}
            onSelect={select}
            onToggleExpand={toggleExpand}
            onExpandAll={expandAll}
            onOverride={override}
          />
        )}
      </main>
    </div>
  );
}

/**
 * Total pages across a document's files, for the "2MB · 2 Pages" chip. Purely
 * cosmetic: null while it is unknown, and null stays if any file cannot be read.
 */
function useTotalPages(files: File[]): number | null {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    setTotal(null);
    if (!files.length) return;

    let cancelled = false;
    void Promise.all(files.map(countPages)).then((counts) => {
      if (cancelled) return;
      setTotal(counts.includes(null) ? null : counts.reduce((sum, count) => sum! + count!, 0));
    });
    return () => {
      cancelled = true;
    };
  }, [files]);

  return total;
}

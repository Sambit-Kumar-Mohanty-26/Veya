"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MappingScreen } from "@/components/MappingScreen";
import { Sidebar } from "@/components/Sidebar";
import { MobileTopBar, TopBar } from "@/components/TopBar";
import { UploadScreen } from "@/components/UploadScreen";
import { processAssessment } from "@/lib/api";
import { countPages } from "@/lib/pdf";
import type { Mapping, ProcessResult } from "@/lib/types";

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
  const [questionPaper, setQuestionPaper] = useState<File | null>(null);
  const [answerSheet, setAnswerSheet] = useState<File | null>(null);
  const [pageCounts, setPageCounts] = useState<Record<"question" | "answer", number | null>>({
    question: null,
    answer: null
  });

  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(STAGES[0]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // Page counts feed the "2MB · 2 Pages" chip. A failure here is cosmetic.
  useEffect(() => {
    if (!questionPaper) return;
    void countPages(questionPaper).then((pages) => setPageCounts((prev) => ({ ...prev, question: pages })));
  }, [questionPaper]);

  useEffect(() => {
    if (!answerSheet) return;
    void countPages(answerSheet).then((pages) => setPageCounts((prev) => ({ ...prev, answer: pages })));
  }, [answerSheet]);

  // Advance the stage caption on a timer. It is a progress *indication*, not a
  // report — the backend runs these as one call and cannot stream its position.
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
    if (!questionPaper || !answerSheet) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("processing");
    setStage(STAGES[0]);
    setError(null);
    setResult(null);
    setOverrides({});
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
   * The teacher can swap in a different answer block. Regions come from the
   * full `answers` list, not just the unmatched ones — most alternatives are
   * currently mapped to some other question, and using stale regions would
   * highlight the wrong place on the sheet.
   */
  const selected = useMemo((): Mapping | null => {
    if (!result) return null;
    const base = result.mappings.find((mapping) => mapping.questionId === selectedId);
    if (!base) return null;

    const overrideId = overrides[base.questionId];
    if (!overrideId) return base;

    const answer = result.answers.find((candidate) => candidate.id === overrideId);
    if (!answer) return base;

    return {
      ...base,
      status: "answered",
      reviewStatus: "needs_review",
      answerId: answer.id,
      answerText: answer.normalizedText,
      answerRegions: answer.pages,
      mappingConfidence:
        base.alternativeCandidates.find((alt) => alt.answerId === overrideId)?.mappingScore ?? base.mappingConfidence
    };
  }, [result, selectedId, overrides]);

  const toggleExpand = useCallback((questionId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(questionId)) next.add(questionId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds((prev) =>
      prev.size === (result?.mappings.length ?? 0)
        ? new Set()
        : new Set(result?.mappings.map((mapping) => mapping.questionId))
    );
  }, [result]);

  const select = useCallback((questionId: string) => {
    setSelectedId(questionId);
    setExpandedIds((prev) => new Set(prev).add(questionId));
  }, []);

  const override = useCallback((questionId: string, answerId: string) => {
    setOverrides((prev) => ({ ...prev, [questionId]: answerId }));
  }, []);

  return (
    <div className="flex h-dvh gap-3 p-3">
      <Sidebar collapsed={collapsed || phase !== "upload"} onToggle={() => setCollapsed((value) => !value)} />

      <main className="flex min-w-0 flex-1 flex-col gap-3">
        <TopBar />
        <MobileTopBar />

        {phase === "upload" && (
          <UploadScreen
            questionPaper={questionPaper}
            answerSheet={answerSheet}
            questionPaperPages={pageCounts.question}
            answerSheetPages={pageCounts.answer}
            error={error}
            onQuestionPaper={(file) => {
              setQuestionPaper(file);
              setPageCounts((prev) => ({ ...prev, question: null }));
              setError(null);
            }}
            onAnswerSheet={(file) => {
              setAnswerSheet(file);
              setPageCounts((prev) => ({ ...prev, answer: null }));
              setError(null);
            }}
            onReject={setError}
            onStart={handleStart}
          />
        )}

        {phase === "processing" && <LoadingScreen stage={stage} />}

        {phase === "results" && result && answerSheet && (
          <MappingScreen
            result={result}
            answerSheet={answerSheet}
            selected={selected}
            selectedId={selectedId}
            expandedIds={expandedIds}
            overrides={overrides}
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

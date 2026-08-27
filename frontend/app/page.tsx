"use client";

import { Activity, ArrowRight, CheckCircle2, ServerCrash } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DocumentPreview } from "@/components/DocumentPreview";
import { ProgressSteps, type ProgressStatus } from "@/components/ProgressSteps";
import { UploadCard } from "@/components/UploadCard";
import type { NormalizedRegion } from "@/lib/coordinates";

type ApiHealth = "checking" | "online" | "offline";

type ProcessResponse = {
  requestId: string;
  mappings: Array<{
    questionId: string;
    questionNumber: string;
    questionText: string;
    status: string;
    reviewStatus: string;
    answerText: string | null;
    answerRegions: NormalizedRegion[];
    mappingConfidence: number;
  }>;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const idleSteps = [
  { key: "upload", label: "Waiting for both files", status: "pending" as ProgressStatus },
  { key: "question_extraction", label: "Question extraction", status: "pending" as ProgressStatus },
  { key: "answer_extraction", label: "Answer region detection", status: "pending" as ProgressStatus },
  { key: "mapping", label: "Evidence scoring and mapping", status: "pending" as ProgressStatus }
];

export default function Home() {
  const [questionPaper, setQuestionPaper] = useState<File | null>(null);
  const [answerSheet, setAnswerSheet] = useState<File | null>(null);
  const [health, setHealth] = useState<ApiHealth>("checking");
  const [steps, setSteps] = useState(idleSteps);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then((response) => {
        setHealth(response.ok ? "online" : "offline");
      })
      .catch(() => setHealth("offline"));
  }, []);

  const selectedMapping = useMemo(() => {
    return result?.mappings.find((mapping) => mapping.questionId === selectedQuestionId) ?? result?.mappings[0] ?? null;
  }, [result, selectedQuestionId]);

  const canProcess = Boolean(questionPaper && answerSheet);

  async function handleProcess() {
    if (!questionPaper || !answerSheet) {
      return;
    }

    setError(null);
    setResult(null);
    setSelectedQuestionId(null);
    setSteps([
      { key: "upload", label: "Uploading files", status: "active" },
      { key: "question_extraction", label: "Reading question paper", status: "pending" },
      { key: "answer_extraction", label: "Preparing answer sheet", status: "pending" },
      { key: "mapping", label: "Preparing evidence model", status: "pending" }
    ]);

    const formData = new FormData();
    formData.append("questionPaper", questionPaper);
    formData.append("answerSheet", answerSheet);

    try {
      const response = await fetch(`${apiUrl}/api/process`, {
        method: "POST",
        body: formData
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Processing failed.");
      }

      setSteps([
        { key: "upload", label: "Files uploaded", status: "complete" },
        { key: "question_extraction", label: "Question extraction placeholder ready", status: "complete" },
        { key: "answer_extraction", label: "Answer region placeholder ready", status: "complete" },
        { key: "mapping", label: "Evidence mapping placeholder ready", status: "complete" }
      ]);
      setResult(payload);
      setSelectedQuestionId(payload.mappings?.[0]?.questionId ?? null);
    } catch (caught) {
      setSteps((current) =>
        current.map((step) => (step.status === "active" ? { ...step, status: "error" as ProgressStatus } : step))
      );
      setError(caught instanceof Error ? caught.message : "Processing failed.");
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-sage">VeyaAI assessment mapper</p>
            <h1 className="mt-1 text-3xl font-semibold text-ink">Question to answer evidence review</h1>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm shadow-soft">
            {health === "checking" ? <Activity className="h-4 w-4 animate-pulse text-sky" aria-hidden="true" /> : null}
            {health === "online" ? <CheckCircle2 className="h-4 w-4 text-sage" aria-hidden="true" /> : null}
            {health === "offline" ? <ServerCrash className="h-4 w-4 text-clay" aria-hidden="true" /> : null}
            <span className="font-medium text-ink">Backend</span>
            <span className="text-muted">{health}</span>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="grid content-start gap-4">
            <UploadCard
              id="question-paper"
              title="Question paper"
              description="Printed paper with numbered questions and marks."
              file={questionPaper}
              onChange={setQuestionPaper}
            />
            <UploadCard
              id="answer-sheet"
              title="Answer sheet"
              description="One student's handwritten answer sheet."
              file={answerSheet}
              onChange={setAnswerSheet}
            />
            <button
              type="button"
              disabled={!canProcess}
              onClick={handleProcess}
              className="flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-muted"
            >
              Process assessment
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            {error ? <p className="rounded-md border border-clay/40 bg-clay/10 p-3 text-sm text-clay">{error}</p> : null}
            <ProgressSteps steps={steps} />
          </div>

          <div className="grid min-h-[760px] gap-4 xl:grid-cols-2">
            <DocumentPreview title="Question paper preview" file={questionPaper} />
            <DocumentPreview
              title="Answer sheet preview"
              file={answerSheet}
              selectedRegions={selectedMapping?.answerRegions ?? []}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
            <h2 className="text-sm font-semibold text-ink">Extracted questions</h2>
            <div className="mt-3 grid gap-2">
              {result?.mappings.length ? (
                result.mappings.map((mapping) => (
                  <button
                    key={mapping.questionId}
                    type="button"
                    onClick={() => setSelectedQuestionId(mapping.questionId)}
                    className={`rounded-md border px-3 py-3 text-left transition ${
                      selectedMapping?.questionId === mapping.questionId
                        ? "border-sage bg-[#eef1e8]"
                        : "border-line bg-[#fbfaf6] hover:border-sage"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-ink">Q{mapping.questionNumber}</span>
                      <span className="rounded bg-white px-2 py-1 text-xs text-muted">
                        {Math.round(mapping.mappingConfidence * 100)}%
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted">{mapping.questionText}</p>
                  </button>
                ))
              ) : (
                <p className="rounded-md bg-[#fbfaf6] p-3 text-sm text-muted">
                  Process both files to see extracted questions here.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
            <h2 className="text-sm font-semibold text-ink">Mapped answer</h2>
            {selectedMapping ? (
              <div className="mt-3 rounded-md bg-[#fbfaf6] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-sage px-2 py-1 text-xs font-semibold text-white">
                    {selectedMapping.reviewStatus.replace("_", " ")}
                  </span>
                  <span className="rounded bg-white px-2 py-1 text-xs text-muted">{selectedMapping.status}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink">{selectedMapping.answerText}</p>
                <p className="mt-3 text-xs text-muted">
                  Clicking a question applies normalized answer-region highlights to the answer sheet viewer.
                </p>
              </div>
            ) : (
              <p className="mt-3 rounded-md bg-[#fbfaf6] p-3 text-sm text-muted">
                Select a processed question to review the mapped answer.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

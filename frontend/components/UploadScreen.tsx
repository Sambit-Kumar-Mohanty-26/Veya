"use client";

import { ArrowRight } from "lucide-react";
import { TeacherBadge } from "./Brand";
import { DropZone } from "./DropZone";

type UploadScreenProps = {
  questionPaper: File | null;
  answerSheet: File | null;
  questionPaperPages: number | null;
  answerSheetPages: number | null;
  error: string | null;
  onQuestionPaper: (file: File | null) => void;
  onAnswerSheet: (file: File | null) => void;
  onReject: (message: string) => void;
  onStart: () => void;
};

export function UploadScreen({
  questionPaper,
  answerSheet,
  questionPaperPages,
  answerSheetPages,
  error,
  onQuestionPaper,
  onAnswerSheet,
  onReject,
  onStart
}: UploadScreenProps) {
  const ready = Boolean(questionPaper && answerSheet);

  // `m-auto` on the inner block rather than `justify-center` on the scroller:
  // on a short viewport, centring with justify-content clips the overflow at
  // BOTH ends and the top of the heading becomes unreachable.
  return (
    <div className="thin-scroll flex min-h-0 flex-1 flex-col items-center overflow-y-auto rounded-tl-panel px-4 py-8 sm:px-8">
      <div className="m-auto flex w-full max-w-[764px] flex-col items-center">
        {/* The design highlights the second half only on desktop; the mobile
            frame is plain black across two lines, with no tinted box. */}
        <h1 className="text-center text-[26px] font-bold leading-tight sm:text-[32px]">
          Upload{" "}
          <span className="md:inline-block md:rounded-md md:bg-brand-tint md:px-2.5 md:py-[9px] md:leading-[38px] md:text-brand">
            Question Paper &amp; Answer Sheets
          </span>
        </h1>
        <p className="mt-2 text-center text-[14px] text-ink-muted">Upload both files to get started</p>

        <div className="my-7">
          <TeacherBadge />
        </div>

        {/* The design wraps both dashed cards in one white rounded container,
            so the gap between them reads as part of the panel, not the page. */}
        <div className="grid w-full max-w-[764px] gap-4 rounded-panel bg-surface-sunken p-3 shadow-card sm:grid-cols-2">
          <DropZone
            label="Question Paper"
            file={questionPaper}
            pageCount={questionPaperPages}
            onChange={onQuestionPaper}
            onReject={onReject}
          />
          <DropZone
            label="Answer Sheet"
            file={answerSheet}
            pageCount={answerSheetPages}
            onChange={onAnswerSheet}
            onReject={onReject}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="mt-5 w-full rounded-xl bg-mark-none-bg px-4 py-3 text-center text-[13.5px] text-mark-none"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onStart}
          disabled={!ready}
          // The pill carries a 2px rim in both states — always one step lighter
          // than its own fill, never a fixed colour, so it stays legible when
          // the fill flips from near-black to grey.
          className={`mt-7 flex h-11 items-center gap-2 rounded-full px-6 text-[14px] font-medium text-white ring-2 transition ${
            ready
              ? "bg-ink ring-ink-badge hover:bg-ink-soft"
              : "cursor-not-allowed bg-[#CAC8C8] ring-line-strong"
          }`}
        >
          Start Mapping
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>

        <p className="mt-3 text-center text-[12px] text-ink-muted">
          Once both files are uploaded, you&apos;ll be able to map answers with questions
        </p>
      </div>
    </div>
  );
}

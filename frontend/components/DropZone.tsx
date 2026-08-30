"use client";

import { Upload, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { ACCEPTED_TYPES, formatBytes, validateFile } from "@/lib/api";

type DropZoneProps = {
  /** "Question Paper" / "Answer Sheet" — the orange half of the label. */
  label: string;
  file: File | null;
  pageCount: number | null;
  onChange: (file: File | null) => void;
  onReject: (message: string) => void;
};

export function DropZone({ label, file, pageCount, onChange, onReject }: DropZoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function accept(candidate: File | undefined) {
    if (!candidate) return;
    const problem = validateFile(candidate);
    if (problem) {
      onReject(problem);
      return;
    }
    onChange(candidate);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(false);
    accept(event.dataTransfer.files[0]);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`relative flex min-h-[175px] items-center justify-center rounded-card p-4 transition ${
        isDragging ? "bg-brand-soft/50" : "bg-surface"
      }`}
    >
      {/* CSS `border-style:dashed` ties dash length to border-width, so a
          thin 1-1.5px line always renders tight 3px dashes — there's no CSS
          knob for a longer dash on a thin stroke. An SVG stroke-dasharray
          isn't tied to width, so it can match the design's longer dashes.
          The colour class lives on the svg, not the card div, so it doesn't
          cascade into the "Upload …" text as an inherited text colour. */}
      <svg
        className={`pointer-events-none absolute inset-0 h-full w-full ${
          isDragging ? "text-brand" : "text-line-strong"
        }`}
        aria-hidden="true"
      >
        <rect
          x="1"
          y="1"
          width="calc(100% - 2px)"
          height="calc(100% - 2px)"
          rx="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="6 5"
        />
      </svg>

      {file ? (
        <div className="relative w-full max-w-[300px]">
          <div className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5 shadow-raised">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-mark-none-bg text-[10px] font-bold text-mark-none"
              aria-hidden="true"
            >
              {file.type === "application/pdf" ? "PDF" : "IMG"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">{file.name}</span>
              <span className="block text-[11.5px] text-ink-muted">
                {formatBytes(file.size)}
                {pageCount != null && ` · ${pageCount} ${pageCount === 1 ? "Page" : "Pages"}`}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2.5 -top-2.5 grid h-6 w-6 place-items-center rounded-full bg-ink text-white shadow-raised transition hover:bg-ink-soft"
            aria-label={`Remove ${label}`}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label htmlFor={inputId} className="flex cursor-pointer flex-col items-center text-center">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-surface-list" aria-hidden="true">
            <Upload className="h-4 w-4 text-ink" strokeWidth={2.2} />
          </span>
          <span className="mt-5 text-[15px] font-bold">
            Upload <span className="text-brand">{label}</span>
          </span>
          <span className="mt-1 text-[11.5px] text-ink-faint">Max 10MB</span>
        </label>
      )}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={(event) => {
          accept(event.target.files?.[0]);
          // Let the same file be re-picked after a removal.
          event.target.value = "";
        }}
      />
    </div>
  );
}

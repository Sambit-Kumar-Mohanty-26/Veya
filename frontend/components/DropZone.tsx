"use client";

import { Plus, Upload, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { ACCEPTED_TYPES, MAX_FILES, formatBytes, validateFile } from "@/lib/api";

type DropZoneProps = {
  /** "Question Paper" / "Answer Sheet" — the orange half of the label. */
  label: string;
  /** One document, in page order. Several files when a page was photographed each. */
  files: File[];
  /** Total pages across all of them. */
  pageCount: number | null;
  onChange: (files: File[]) => void;
  onReject: (message: string) => void;
};

/**
 * The design's file chip uses a folded-corner page glyph with the type lettered
 * across it, not a plain rounded tile — the fold is what reads as "document".
 *
 * Red is the colour every file manager gives a PDF, so an image drawn in it
 * reads as a PDF no matter what the lettering says. Photos get the green.
 */
function FileMark({ kind }: { kind: "PDF" | "IMG" }) {
  return (
    <svg
      viewBox="0 0 28 34"
      className={`h-[34px] w-7 shrink-0 ${kind === "PDF" ? "text-mark-none" : "text-mark-full"}`}
      aria-hidden="true"
    >
      <path d="M4 0h14l10 10v20a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4Z" fill="currentColor" />
      <path d="M18 0l10 10h-7a3 3 0 0 1-3-3V0Z" fill="#fff" fillOpacity=".38" />
      <text x="14" y="26" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" letterSpacing="-.3">
        {kind}
      </text>
    </svg>
  );
}

export function DropZone({ label, files, pageCount, onChange, onReject }: DropZoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Files append rather than replace: a teacher adding page 3 to a two-page
  // sheet should not lose the first two, and the order they arrive in is the
  // page order the backend and the viewer both assume.
  function accept(picked: FileList | null) {
    const incoming = Array.from(picked ?? []);
    if (!incoming.length) return;

    if (files.length + incoming.length > MAX_FILES) {
      onReject(`A document can have at most ${MAX_FILES} files.`);
      return;
    }
    const problem = incoming.map(validateFile).find(Boolean);
    if (problem) {
      onReject(problem);
      return;
    }
    onChange([...files, ...incoming]);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(false);
    accept(event.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`relative flex min-h-[clamp(132px,23vh,175px)] items-center justify-center rounded-card p-4 transition ${
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

      {files.length > 0 ? (
        <div className="relative flex w-full max-w-[300px] flex-col gap-2 py-1">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="relative">
              <div className="flex items-center gap-2.5 rounded-2xl bg-surface-list px-3.5 py-2.5">
                <FileMark kind={file.type === "application/pdf" ? "PDF" : "IMG"} />
                <span className="min-w-0 flex-1 text-center">
                  <span className="block truncate text-[13.5px] font-bold">{file.name}</span>
                  <span className="block text-[12px] text-ink-muted">
                    {formatBytes(file.size)}
                    {/* The page total covers the whole document, so it only
                        belongs on the chip while the document is one file. */}
                    {files.length === 1 &&
                      pageCount != null &&
                      ` • ${pageCount} ${pageCount === 1 ? "Page" : "Pages"}`}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#6E6E6E] text-white ring-2 ring-white transition hover:bg-ink-soft"
                aria-label={`Remove ${file.name} from ${label}`}
              >
                <X className="h-3 w-3" strokeWidth={2.75} aria-hidden="true" />
              </button>
            </div>
          ))}

          <label
            htmlFor={inputId}
            className="flex cursor-pointer items-center justify-center gap-1.5 text-[12px] font-medium text-ink-muted transition hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            Add another page
            {files.length > 1 && pageCount != null && (
              <span className="text-ink-faint">
                • {pageCount} {pageCount === 1 ? "Page" : "Pages"}
              </span>
            )}
          </label>
        </div>
      ) : (
        <label htmlFor={inputId} className="flex cursor-pointer flex-col items-center text-center">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-surface-list" aria-hidden="true">
            <Upload className="h-4 w-4 text-ink" strokeWidth={2.2} />
          </span>
          <span className="mt-5 text-[15px] font-bold">
            Upload <span className="text-brand">{label}</span>
          </span>
          <span className="mt-1 text-[11.5px] text-ink-faint">PDF or images • Max 10MB each</span>
        </label>
      )}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={(event) => {
          accept(event.target.files);
          // Let the same file be re-picked after a removal.
          event.target.value = "";
        }}
      />
    </div>
  );
}

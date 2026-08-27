"use client";

import { FileText, ImageIcon, UploadCloud, X } from "lucide-react";
import type { ChangeEvent } from "react";

type UploadCardProps = {
  id: string;
  title: string;
  description: string;
  file: File | null;
  onChange: (file: File | null) => void;
};

const accepted = "application/pdf,image/png,image/jpeg";

export function UploadCard({ id, title, description, file, onChange }: UploadCardProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.files?.[0] ?? null);
  };

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        {file?.type === "application/pdf" ? (
          <FileText className="h-5 w-5 shrink-0 text-clay" aria-hidden="true" />
        ) : (
          <ImageIcon className="h-5 w-5 shrink-0 text-sage" aria-hidden="true" />
        )}
      </div>

      <label
        htmlFor={id}
        className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-sage/70 bg-panel px-4 py-6 text-center transition hover:border-sage hover:bg-[#eef1e8]"
      >
        <UploadCloud className="h-8 w-8 text-sage" aria-hidden="true" />
        <span className="mt-3 text-sm font-medium text-ink">{file ? "Replace file" : "Choose file"}</span>
        <span className="mt-1 text-xs text-muted">PDF, PNG, JPG or JPEG up to 20MB</span>
      </label>
      <input id={id} className="hidden" type="file" accept={accepted} onChange={handleChange} />

      {file ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-line bg-[#fbfaf6] px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{file.name}</p>
            <p className="text-xs text-muted">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line text-muted transition hover:border-clay hover:text-clay"
            aria-label={`Remove ${title}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

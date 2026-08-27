"use client";

import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { NormalizedRegion } from "@/lib/coordinates";
import { toViewportBox } from "@/lib/coordinates";

type DocumentPreviewProps = {
  title: string;
  file: File | null;
  selectedRegions?: NormalizedRegion[];
};

const previewWidth = 520;
const previewHeight = 680;

export function DocumentPreview({ title, file, selectedRegions = [] }: DocumentPreviewProps) {
  const [page, setPage] = useState(1);
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    setPage(1);
  }, [file]);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  const isImage = Boolean(file?.type.startsWith("image/"));
  const isPdf = file?.type === "application/pdf";
  const regionsForPage = selectedRegions.filter((region) => region.page === page);

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-line bg-white shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
          <p className="truncate text-xs text-muted">{file ? file.name : "No file selected"}</p>
        </div>
        {isPdf ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-md border border-line text-muted disabled:opacity-40"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-16 text-center text-xs font-medium text-muted">Page {page}</span>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-md border border-line text-muted"
              onClick={() => setPage((current) => current + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="document-scrollbar min-h-0 flex-1 overflow-auto bg-[#ece9df] p-4">
        <div
          className="relative mx-auto overflow-hidden rounded-md bg-white shadow-sm"
          style={{ width: previewWidth, height: previewHeight, maxWidth: "100%" }}
        >
          {!file || !objectUrl ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center text-muted">
              <FileText className="mb-3 h-8 w-8" aria-hidden="true" />
              <p className="text-sm">Upload a file to preview it here.</p>
            </div>
          ) : null}

          {isImage && objectUrl ? (
            <img src={objectUrl} alt={`${title} preview`} className="h-full w-full object-contain" />
          ) : null}

          {isPdf && objectUrl ? (
            <object data={`${objectUrl}#page=${page}`} type="application/pdf" className="h-full w-full">
              <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted">
                PDF preview is not available in this browser, but the file can still be processed.
              </div>
            </object>
          ) : null}

          {regionsForPage.map((region, index) => {
            const box = toViewportBox(region, previewWidth, previewHeight);

            return (
              <div
                key={`${region.page}-${index}`}
                className="pointer-events-none absolute rounded-md border-2 border-gold bg-gold/25 shadow-[0_0_0_9999px_rgba(23,33,43,0.08)]"
                style={{
                  left: box.left,
                  top: box.top,
                  width: box.width,
                  height: box.height
                }}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

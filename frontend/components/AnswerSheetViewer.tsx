"use client";

import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toViewportBox } from "@/lib/coordinates";
import { loadPdf, renderPage } from "@/lib/pdf";
import type { Region } from "@/lib/types";

const BASE_PAGE_WIDTH = 620;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

type Page = { pageNumber: number; width: number; height: number; canvas: HTMLCanvasElement | null; src?: string };

type AnswerSheetViewerProps = {
  file: File;
  /** Regions to highlight, and the question number to tag them with. */
  regions: Region[];
  tag: string | null;
  /** Shown instead of a highlight when the selected question has no answer. */
  emptyMessage: string | null;
  /** False while the mobile tab switcher is showing the question list instead. */
  active: boolean;
};

/**
 * Renders the answer sheet page by page and draws highlight boxes on top.
 *
 * Pages are rendered to real canvases (never an <object> PDF plugin) because
 * the overlay has to know the exact pixel box each page occupies — a plugin
 * letterboxes the page inside its own viewport and every highlight lands in
 * the wrong place.
 */
export function AnswerSheetViewer({ file, regions, tag, emptyMessage, active }: AnswerSheetViewerProps) {
  const [pages, setPages] = useState<Page[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [zoomIndex, setZoomIndex] = useState(2);
  const [visiblePage, setVisiblePage] = useState(1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());

  // Pages rasterise at a fixed width; on a viewport narrower than that they are
  // scaled down to fit so a phone never has to scroll sideways to read an answer.
  const [fitScale, setFitScale] = useState(1);
  const zoom = ZOOM_STEPS[zoomIndex] * fitScale;

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const observer = new ResizeObserver(([entry]) => {
      const available = entry.contentRect.width;
      if (available > 0) {
        // Uncapped: the design has the sheet filling the panel. Canvases are
        // rasterised at up to 2x device pixels, so mild upscaling stays sharp.
        setFitScale(available / BASE_PAGE_WIDTH);
      }
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Render every page once, at a fixed base width. Zoom is a CSS transform on
  // top, so changing it never re-rasterises the document.
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];

    setStatus("loading");
    setPages([]);

    async function render() {
      try {
        if (file.type !== "application/pdf") {
          const src = URL.createObjectURL(file);
          created.push(src);
          const size = await imageSize(src);
          if (cancelled) return;
          setPages([{ pageNumber: 1, ...scaleToWidth(size, BASE_PAGE_WIDTH), canvas: null, src }]);
          setStatus("ready");
          return;
        }

        const doc = await loadPdf(file);
        const rendered: Page[] = [];
        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
          const page = await renderPage(doc, pageNumber, BASE_PAGE_WIDTH);
          if (cancelled) return;
          rendered.push(page);
          setPages([...rendered]);
        }
        await doc.destroy();
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void render();

    return () => {
      cancelled = true;
      created.forEach(URL.revokeObjectURL);
    };
  }, [file]);

  // Scroll the first highlighted page into view whenever the selection changes.
  useLayoutEffect(() => {
    if (!active) return;
    const target = regions.find((region) => region.bbox)?.page ?? regions[0]?.page;
    if (target == null) return;
    pageRefs.current.get(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [regions, pages.length, active]);

  // Track which page is under the top of the scroll area for the page counter.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || pages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) {
          setVisiblePage(Number((top.target as HTMLElement).dataset.page));
        }
      },
      { root, threshold: 0.1 }
    );

    pageRefs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [pages.length]);

  function jump(delta: number) {
    const next = Math.min(Math.max(visiblePage + delta, 1), pages.length);
    pageRefs.current.get(next)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-panel bg-surface">
      <div className="flex h-[60px] shrink-0 items-center justify-between gap-3 bg-surface-viewer px-5 text-white sm:px-6">
        <h2 className="shrink-0 text-[14px] font-semibold">Answer Sheet</h2>

        <div className="flex items-center gap-3">
          <div className="hidden h-9 items-center gap-1 rounded-lg bg-surface-control px-1.5 sm:flex">
            <ZoomButton label="Zoom out" disabled={zoomIndex === 0} onClick={() => setZoomIndex((i) => i - 1)}>
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </ZoomButton>
            <span className="min-w-[42px] text-center text-[12px] font-medium tabular-nums">
              {Math.round(ZOOM_STEPS[zoomIndex] * 100)}%
            </span>
            <ZoomButton
              label="Zoom in"
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              onClick={() => setZoomIndex((i) => i + 1)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </ZoomButton>
          </div>

          <div className="flex h-9 items-center gap-1 rounded-lg bg-surface-control px-1.5">
            <ZoomButton label="Previous page" disabled={visiblePage <= 1} onClick={() => jump(-1)}>
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </ZoomButton>
            <span className="whitespace-nowrap px-1 text-[12px] font-medium tabular-nums">
              Page {visiblePage} of {pages.length || "…"}
            </span>
            <ZoomButton
              label="Next page"
              disabled={visiblePage >= pages.length}
              onClick={() => jump(1)}
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </ZoomButton>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="thin-scroll min-h-0 flex-1 overflow-auto bg-line">
        {status === "error" && (
          <p className="py-16 text-center text-[13.5px] text-ink-muted">
            This file could not be displayed, but it was still processed.
          </p>
        )}

        {status === "loading" && pages.length === 0 && (
          <div className="h-[560px] w-full animate-pulse bg-line" />
        )}

        {emptyMessage && (
          <p className="bg-mark-none-bg px-4 py-3 text-center text-[13px] text-mark-none">{emptyMessage}</p>
        )}

        {/* Pages sit flush against the panel edges, separated only by a seam. */}
        <div className="flex flex-col items-center gap-px">
          {pages.map((page) => {
            const pageRegions = regions.filter((region) => region.page === page.pageNumber && region.bbox);

            return (
              <div
                key={page.pageNumber}
                data-page={page.pageNumber}
                ref={(element) => {
                  if (element) pageRefs.current.set(page.pageNumber, element);
                  else pageRefs.current.delete(page.pageNumber);
                }}
                className="relative shrink-0 origin-top bg-white"
                style={{
                  width: page.width * zoom,
                  height: page.height * zoom
                }}
              >
                {/* Only the page art is clipped, so a highlight tag sitting
                    above a box near the top edge is not cut off. */}
                <div className="absolute inset-0 overflow-hidden">
                  <PageCanvas page={page} zoom={zoom} />
                </div>

                {pageRegions.map((region, index) => {
                  const box = toViewportBox(region.bbox!, page.width * zoom, page.height * zoom);
                  return (
                    <div
                      key={`${page.pageNumber}-${index}`}
                      className="pointer-events-none absolute rounded-md border-2 border-highlight-border bg-highlight/[0.14] transition-all duration-200"
                      style={box}
                    >
                      {tag && index === 0 && (
                        <span className="absolute -top-[17px] left-0 rounded-t-md bg-highlight-border px-1.5 text-[10px] font-semibold leading-[17px] text-white">
                          {tag}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Mounts the pre-rendered canvas (or the image, for photo uploads). */
function PageCanvas({ page, zoom }: { page: Page; zoom: number }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !page.canvas) return;
    host.replaceChildren(page.canvas);
  }, [page.canvas]);

  if (page.src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={page.src}
        alt={`Answer sheet page ${page.pageNumber}`}
        style={{ width: page.width * zoom, height: page.height * zoom }}
        className="block"
      />
    );
  }

  // The canvas is rasterised once at its natural CSS size; zoom scales it here,
  // so the parent's width already accounts for the factor.
  return (
    <div
      ref={hostRef}
      style={{
        position: "absolute",
        width: page.width,
        height: page.height,
        transform: `scale(${zoom})`,
        transformOrigin: "top left"
      }}
      aria-label={`Answer sheet page ${page.pageNumber}`}
    />
  );
}

function ZoomButton({
  label,
  disabled,
  onClick,
  children
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-6 w-6 place-items-center rounded-full text-white transition hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Could not read the image."));
    image.src = src;
  });
}

function scaleToWidth({ width, height }: { width: number; height: number }, target: number) {
  return { width: target, height: (height / width) * target };
}

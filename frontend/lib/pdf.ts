import type { PDFDocumentProxy } from "pdfjs-dist";

/**
 * pdf.js ships an ESM build plus a worker that must be loaded from a URL.
 * Importing it lazily keeps it out of the server bundle and off the critical
 * path for the upload screen, which does not need it.
 */
let pdfjs: typeof import("pdfjs-dist") | null = null;

async function getPdfjs() {
  if (!pdfjs) {
    const lib = await import("pdfjs-dist");
    lib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    pdfjs = lib;
  }
  return pdfjs;
}

export async function loadPdf(file: File): Promise<PDFDocumentProxy> {
  const lib = await getPdfjs();
  const data = await file.arrayBuffer();
  return lib.getDocument({ data }).promise;
}

/** Page count only - used for the "2MB · 2 Pages" chip on the upload screen. */
export async function countPages(file: File): Promise<number | null> {
  if (file.type !== "application/pdf") {
    return 1;
  }
  try {
    const doc = await loadPdf(file);
    const pages = doc.numPages;
    await doc.destroy();
    return pages;
  } catch {
    return null;
  }
}

export type RenderedPage = { pageNumber: number; width: number; height: number; canvas: HTMLCanvasElement };

/**
 * Render one page to its own canvas at `cssWidth`, scaled up by the device
 * pixel ratio so the handwriting stays sharp. The returned width/height are CSS
 * pixels, which is the space highlight overlays are positioned in.
 */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  cssWidth: number
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = cssWidth / base.width;
  const viewport = page.getViewport({ scale });
  const ratio = Math.min(window.devicePixelRatio || 1, 2);

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width * ratio);
  canvas.height = Math.floor(viewport.height * ratio);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not get a 2D canvas context.");
  }
  context.scale(ratio, ratio);

  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();

  return { pageNumber, width: viewport.width, height: viewport.height, canvas };
}

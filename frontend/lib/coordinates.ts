import type { NormalizedBBox } from "./types";

export type ViewportBox = { left: number; top: number; width: number; height: number };

/** One run of ink rows on a page — in practice one line of handwriting. Fractions of the page. */
export type InkBand = { top: number; bottom: number; left: number; right: number };

/** Darker than this is handwriting; the ruled lines and the red margin are lighter. */
const INK_LUMA = 140;
/** Blank rows this few still belong to the same line — glyphs break, lines do not. */
const GAP_ROWS = 2;
/** Breathing room so the stroke never sits on a glyph. */
const MARGIN = 0.005;
/** A band this tall means the threshold caught the paper itself, not the ink. */
const DEGENERATE = 0.6;
/** How much of a band the model's box must cover before the line counts as its own. */
const CLAIM = 0.5;
/** A new answer's number marker hangs this far into the margin; a continuation line does not. */
const INDENT = 0.02;

/**
 * Every row of ink on a rendered page, grouped into lines.
 *
 * Asked for a box that "tightly encloses the handwriting", the model obliges to
 * within a few pixels — sometimes just inside the first line, sometimes a line
 * past the last. Pixels do not estimate: the rendered page says exactly where
 * the ink is, so `snapToInk` uses the model's box only to *choose* the lines and
 * takes the edges from the ink itself.
 *
 * Returns nothing if one band swallows the page, which means the threshold
 * caught the paper (a dark scan, a photo in shadow) and snapping to it would be
 * worse than the model's own box.
 */
export function findInkBands(canvas: HTMLCanvasElement): InkBand[] {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];

  const { width, height } = canvas;
  const { data } = context.getImageData(0, 0, width, height);
  const bands: InkBand[] = [];

  let open: { top: number; bottom: number; left: number; right: number } | null = null;
  let blank = 0;

  const close = () => {
    // A single stray row is a speck of noise, not a line.
    if (open && open.bottom > open.top) {
      bands.push({
        top: open.top / height,
        bottom: (open.bottom + 1) / height,
        left: open.left / width,
        right: (open.right + 1) / width
      });
    }
    open = null;
  };

  for (let y = 0; y < height; y += 1) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] >= INK_LUMA) continue;
      if (left < 0) left = x;
      right = x;
    }

    if (left < 0) {
      blank += 1;
      if (open && blank > GAP_ROWS) close();
      continue;
    }

    blank = 0;
    open = open
      ? { top: open.top, bottom: y, left: Math.min(open.left, left), right: Math.max(open.right, right) }
      : { top: y, bottom: y, left, right };
  }
  close();

  return bands.some((band) => band.bottom - band.top > DEGENERATE) ? [] : bands;
}

/**
 * Replace the model's edges with the ink's own.
 *
 * A band belongs to this answer when the box covers most of it. A band the box
 * merely clips a sliver of is the line above or below — that is the difference
 * between fixing a box that cuts its own first line and swallowing the next
 * answer whole.
 */
export function snapToInk(bbox: NormalizedBBox, bands: InkBand[]): NormalizedBBox {
  const bottom = bbox.y + bbox.height;
  const overlap = (band: InkBand) => Math.min(bottom, band.bottom) - Math.max(bbox.y, band.top);
  const mine = bands.filter((band) => overlap(band) >= (band.bottom - band.top) * CLAIM);

  // No ink under the box at all: the page is a photo we could not read, or the
  // model pointed at blank paper. Its box is all we have.
  if (!mine.length) return grow(bbox.x, bbox.y, bbox.x + bbox.width, bottom);

  // The box lands within half a line of the truth at either end, so how much of
  // that line it covers cannot say whether the line belongs to this answer.
  // Where the line *starts* can: the student's number marker hangs out into the
  // margin, so a line further left than the one above it opens a new answer,
  // and a line that keeps the margin continues the current one.
  //
  // ponytail: an answer written with no marker, flush under the one above, is
  // indistinguishable this way. Nothing on the page separates them either.
  const opensAnswer = (band: InkBand, previous: InkBand) => band.left < previous.left - INDENT;

  // Covered, but the box ran past the end of its own answer.
  const next = mine.findIndex((band, index) => index > 0 && opensAnswer(band, mine[index - 1]));
  const claim = next < 0 ? mine : mine.slice(0, next);

  const before = bands[bands.indexOf(claim[0]) - 1];
  const after = bands[bands.indexOf(claim[claim.length - 1]) + 1];
  // Above: only the marker line this answer opens with — anything level with
  // the claim is the tail of the answer before it.
  if (before && overlap(before) > 0 && opensAnswer(before, claim[0])) claim.unshift(before);
  // Below: only a line that stayed at the margin, never the next answer's marker.
  if (after && overlap(after) > 0 && !opensAnswer(after, claim[claim.length - 1])) claim.push(after);

  return grow(
    Math.min(...claim.map((band) => band.left)),
    Math.min(...claim.map((band) => band.top)),
    Math.max(...claim.map((band) => band.right)),
    Math.max(...claim.map((band) => band.bottom))
  );
}

function grow(x0: number, y0: number, x1: number, y1: number): NormalizedBBox {
  const left = Math.max(x0 - MARGIN, 0);
  const top = Math.max(y0 - MARGIN, 0);
  return {
    x: left,
    y: top,
    width: Math.min(x1 + MARGIN, 1) - left,
    height: Math.min(y1 + MARGIN, 1) - top
  };
}

/**
 * Normalized coordinates are fractions of the page, so they survive any zoom,
 * viewport, or render scale. Multiply by whatever the page actually rendered at.
 */
export function toViewportBox(bbox: NormalizedBBox, width: number, height: number): ViewportBox {
  return {
    left: bbox.x * width,
    top: bbox.y * height,
    width: bbox.width * width,
    height: bbox.height * height
  };
}

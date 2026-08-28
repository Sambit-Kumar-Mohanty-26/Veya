import type { NormalizedBBox } from "./types";

export type ViewportBox = { left: number; top: number; width: number; height: number };

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

export type NormalizedBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NormalizedRegion = {
  page: number;
  bbox: NormalizedBBox;
  coordinateSpace: "normalized";
  pageWidth?: number;
  pageHeight?: number;
};

export type ViewportBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function toViewportBox(region: NormalizedRegion, renderedWidth: number, renderedHeight: number): ViewportBox {
  return {
    left: region.bbox.x * renderedWidth,
    top: region.bbox.y * renderedHeight,
    width: region.bbox.width * renderedWidth,
    height: region.bbox.height * renderedHeight
  };
}

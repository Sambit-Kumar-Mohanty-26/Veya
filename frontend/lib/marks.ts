import type { Mapping } from "./types";

export type MarkTone = "full" | "part" | "none";

/** The mark pill shown on every question row: "4/5" coloured by how much was earned. */
export function markPill(mapping: Mapping): { label: string; tone: MarkTone } | null {
  const grade = mapping.grade;
  const max = grade?.maxMarks ?? mapping.marks;

  if (grade?.awardedMarks == null || max == null) {
    return null;
  }

  const ratio = max > 0 ? grade.awardedMarks / max : 0;
  const tone: MarkTone = ratio >= 1 ? "full" : ratio > 0 ? "part" : "none";

  // The design spaces the slash: "2 / 2".
  return { label: `${trim(grade.awardedMarks)} / ${trim(max)}`, tone };
}

export const markToneClass: Record<MarkTone, string> = {
  full: "bg-mark-full-bg text-mark-full",
  part: "bg-mark-part-bg text-mark-part",
  none: "bg-mark-none-bg text-mark-none"
};

/** 2 stays "2"; 1.5 stays "1.5". */
function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

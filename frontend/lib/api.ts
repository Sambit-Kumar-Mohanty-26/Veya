import type { ProcessResult } from "./types";

export const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

/** Returns null when the file is acceptable, otherwise the reason it is not. */
export function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Only PDF, PNG, and JPG files are supported.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return `That file is ${formatBytes(file.size)}. The limit is 10MB.`;
  }
  return null;
}

export async function processAssessment(
  questionPaper: File,
  answerSheet: File,
  signal?: AbortSignal
): Promise<ProcessResult> {
  const body = new FormData();
  body.append("questionPaper", questionPaper);
  body.append("answerSheet", answerSheet);

  const response = await fetch(`${apiUrl}/api/process`, { method: "POST", body, signal });

  // A crashed or cold-starting server may not return JSON at all.
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Processing failed (${response.status}).`);
  }
  return payload as ProcessResult;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)}KB`;
  return `${(kb / 1024).toFixed(kb / 1024 < 10 ? 1 : 0)}MB`;
}

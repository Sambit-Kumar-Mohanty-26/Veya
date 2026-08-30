import type { GradeRequestItem, ProcessResult, QuestionGrade } from "./types";

export const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

/** Matches the backend's per-document limit; a page-per-photo sheet is why it is not 1. */
export const MAX_FILES = 20;

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

/** Either document may be several files - one photo per page. Order is page order. */
export async function processAssessment(
  questionPaper: File[],
  answerSheet: File[],
  signal?: AbortSignal
): Promise<ProcessResult> {
  const body = new FormData();
  questionPaper.forEach((file) => body.append("questionPaper", file));
  answerSheet.forEach((file) => body.append("answerSheet", file));

  return request<ProcessResult>("/api/process", { method: "POST", body, signal }, "Processing failed");
}

/**
 * Re-marks the questions whose answer the teacher reassigned. Nothing is stored
 * server-side between requests, so the question and the new answer text go back
 * up with the call.
 */
export async function gradeQuestions(
  items: GradeRequestItem[],
  signal?: AbortSignal
): Promise<Record<string, QuestionGrade>> {
  const payload = await request<{ grades: Record<string, QuestionGrade> }>(
    "/api/grade",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      signal
    },
    "Re-marking failed"
  );
  return payload.grades;
}

async function request<T>(path: string, init: RequestInit, whatFailed: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, init);

  // A crashed or cold-starting server may not return JSON at all.
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `${whatFailed} (${response.status}).`);
  }
  return payload as T;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)}KB`;
  return `${(kb / 1024).toFixed(kb / 1024 < 10 ? 1 : 0)}MB`;
}

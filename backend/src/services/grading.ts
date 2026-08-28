import { z } from "zod";
import type { Evaluation, FinalMapping, GradingSummary, QuestionGrade } from "../types.js";
import { generateJson } from "./gemini.js";

const PROMPT = `You are an experienced teacher marking a student's exam answers.

You will receive a JSON array of question/answer pairs. Mark each one.

Return a JSON object:
{
  "summary": "<two or three sentences on the student's overall performance>",
  "questions": [
    {
      "id": "<the id from the input, copied exactly>",
      "maxMarks": <number — use the provided marks, or a sensible allocation if null>,
      "awardedMarks": <number, may be fractional, never above maxMarks>,
      "evaluation": "correct" | "partially_correct" | "incorrect" | "unanswered",
      "feedback": "<one or two sentences addressed to the student — what was right, what was missing>"
    }
  ]
}

RULES:
- Include an entry for EVERY question in the input, using its exact id.
- A question with a null answer is "unanswered" with 0 awarded marks.
- Be fair: award partial credit where the student showed correct understanding.
- Return ONLY the JSON object.`;

const schema = z.object({
  summary: z.string().nullish(),
  questions: z.array(
    z.object({
      id: z.string(),
      maxMarks: z.number().nullish(),
      awardedMarks: z.number().nullish(),
      evaluation: z.string().nullish(),
      feedback: z.string().nullish()
    })
  )
});

const evaluations: Evaluation[] = ["correct", "partially_correct", "incorrect", "unanswered"];

export async function gradeMappings(
  mappings: FinalMapping[]
): Promise<{ grades: Map<string, QuestionGrade>; summary: GradingSummary }> {
  const payload = mappings.map((mapping) => ({
    id: mapping.questionId,
    question: mapping.questionText,
    marks: mapping.marks,
    answer: mapping.status === "answered" ? mapping.answerText : null
  }));

  const raw = await generateJson("Grading", schema, [PROMPT, JSON.stringify(payload)]);
  const grades = new Map<string, QuestionGrade>();

  for (const item of raw.questions) {
    const maxMarks = numberOrNull(item.maxMarks);
    const awarded = numberOrNull(item.awardedMarks);

    grades.set(item.id, {
      maxMarks,
      // Never let the model award more than the question is worth.
      awardedMarks: awarded == null ? null : clamp(awarded, 0, maxMarks ?? awarded),
      evaluation: toEvaluation(item.evaluation),
      feedback: (item.feedback ?? "").trim()
    });
  }

  const totalMarks = sum(mappings, (mapping) => grades.get(mapping.questionId)?.maxMarks ?? mapping.marks ?? 0);
  const awardedMarks = sum(mappings, (mapping) => grades.get(mapping.questionId)?.awardedMarks ?? 0);

  return {
    grades,
    summary: {
      totalMarks: round(totalMarks),
      awardedMarks: round(awardedMarks),
      percentage: totalMarks > 0 ? round((awardedMarks / totalMarks) * 100) : 0,
      summary: (raw.summary ?? "").trim()
    }
  };
}

function toEvaluation(value: unknown): Evaluation {
  const normalized = String(value ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  return (evaluations as string[]).includes(normalized) ? (normalized as Evaluation) : "incorrect";
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

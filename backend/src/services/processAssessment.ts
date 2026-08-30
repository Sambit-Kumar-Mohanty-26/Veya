import { randomUUID } from "crypto";
import type { UploadedFileSummary } from "../types.js";
import { extractAnswerEvidence } from "./answerExtractor.js";
import { summarizeFile } from "./fileSummary.js";
import { gradeMappings } from "./grading.js";
import { buildCandidateMappings, buildFinalMappings } from "./mapper.js";
import { extractQuestions } from "./questionExtractor.js";

export async function processAssessment(
  questionPaper: Express.Multer.File[],
  answerSheet: Express.Multer.File[]
) {
  const startedAt = Date.now();

  // The two documents are independent, so read them at the same time.
  const [questions, answers] = await Promise.all([
    extractQuestions(questionPaper),
    extractAnswerEvidence(answerSheet)
  ]);

  const candidates = buildCandidateMappings(questions, answers);
  const { mappings, unmatchedAnswers } = buildFinalMappings(questions, answers, candidates);

  // Grading is the one optional stage: if it fails the teacher still gets the
  // mapping and highlighting, which is what the product is actually for.
  let grading = null;
  try {
    const { grades, summary } = await gradeMappings(mappings);
    for (const mapping of mappings) {
      mapping.grade = grades.get(mapping.questionId) ?? null;
    }
    grading = summary;
  } catch (error) {
    console.warn("[grading] skipped:", error instanceof Error ? error.message : String(error));
  }

  const files: Record<"questionPaper" | "answerSheet", UploadedFileSummary[]> = {
    questionPaper: questionPaper.map(summarizeFile),
    answerSheet: answerSheet.map(summarizeFile)
  };

  return {
    requestId: randomUUID(),
    durationMs: Date.now() - startedAt,
    files,
    summary: {
      totalQuestions: questions.length,
      answered: mappings.filter((mapping) => mapping.status === "answered").length,
      unanswered: mappings.filter((mapping) => mapping.status === "unanswered").length,
      needsReview: mappings.filter(
        (mapping) => mapping.status === "answered" && mapping.reviewStatus !== "high_confidence"
      ).length,
      unmatchedAnswers: unmatchedAnswers.length
    },
    grading,
    questions,
    answers,
    candidates,
    mappings,
    unmatchedAnswers
  };
}

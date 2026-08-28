import type { AnswerEvidence, CandidateMapping, ExtractedQuestion, ReviewStatus } from "../types.js";

/** Words too common in exam phrasing to carry any matching signal. */
const stopWords = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "by", "is", "are", "for", "with", "that",
  "one", "two", "give", "state", "explain", "describe", "draw", "what", "which", "how", "why"
]);

export const HIGH_CONFIDENCE = 0.85;
export const NEEDS_REVIEW = 0.6;

/**
 * Collapse the many ways a question number gets written down.
 * "Q11(a)" / "Ans 11 a" / "11.a" / "11(A)" all become "11a".
 */
export function normalizeQuestionNumber(value: string | null): string {
  if (!value) {
    return "";
  }

  return value
    .toLowerCase()
    .replace(/^\s*(?:q(?:uestion)?|ans(?:wer)?)\s*[.:-]?\s*/, "")
    .replace(/[()\s.:,-]+/g, "")
    .trim();
}

export function scoreCandidate(question: ExtractedQuestion, answer: AnswerEvidence): CandidateMapping {
  const questionKey = normalizeQuestionNumber([question.number, question.part].filter(Boolean).join(""));
  const answerKey = normalizeQuestionNumber(answer.detectedQuestionNumber);

  const explicitNumberScore = scoreNumberMatch(questionKey, answerKey);
  const semanticScore = scoreSemantic(question.normalizedText, answer.normalizedText);
  const sequenceScore = scoreSequence(question.order, answer.order);
  const ocrConfidence = answer.ocrConfidence;

  const mappingScore = round(
    explicitNumberScore * 0.45 + semanticScore * 0.25 + sequenceScore * 0.15 + ocrConfidence * 0.15
  );

  return {
    questionId: question.id,
    answerId: answer.id,
    mappingScore,
    status: classify(mappingScore),
    signals: { explicitNumberScore, semanticScore, sequenceScore, ocrConfidence }
  };
}

/**
 * Exact number match is the strongest signal. A partial match ("11" vs "11a")
 * still beats nothing — the student may have written the parent number only.
 */
function scoreNumberMatch(questionKey: string, answerKey: string): number {
  if (!questionKey || !answerKey) {
    return 0;
  }
  if (questionKey === answerKey) {
    return 1;
  }
  return questionKey.startsWith(answerKey) || answerKey.startsWith(questionKey) ? 0.5 : 0;
}

/** Jaccard overlap of content words, scaled — answers rarely repeat the question verbatim. */
function scoreSemantic(questionText: string, answerText: string): number {
  const questionTerms = toTerms(questionText);
  const answerTerms = toTerms(answerText);

  if (!questionTerms.size || !answerTerms.size) {
    return 0;
  }

  const shared = [...questionTerms].filter((term) => answerTerms.has(term)).length;
  const union = new Set([...questionTerms, ...answerTerms]).size;

  return round(Math.min(1, (shared / union) * 2.2));
}

/** Students usually answer in order, so positional distance is weak corroborating evidence. */
function scoreSequence(questionOrder: number, answerOrder: number): number {
  const distance = Math.abs(questionOrder - answerOrder);
  if (distance === 0) return 1;
  if (distance === 1) return 0.72;
  if (distance === 2) return 0.45;
  return 0.2;
}

export function classify(score: number): ReviewStatus {
  if (score >= HIGH_CONFIDENCE) return "high_confidence";
  if (score >= NEEDS_REVIEW) return "needs_review";
  return "uncertain";
}

function toTerms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 2 && !stopWords.has(term))
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

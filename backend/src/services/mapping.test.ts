/**
 * Self-check for the parts of the pipeline that are pure logic.
 * Run with: npm test
 */
import assert from "node:assert/strict";
import type { AnswerEvidence, ExtractedQuestion } from "../types.js";
import { buildCandidateMappings, buildFinalMappings } from "./mapper.js";
import { normalizeQuestionNumber, scoreCandidate } from "./scoring.js";

function question(id: string, number: string, part: string | null, text: string, order: number): ExtractedQuestion {
  return {
    id, number, part, text,
    rawText: text,
    normalizedText: text.toLowerCase(),
    page: 1, bbox: null, coordinateSpace: "normalized", marks: 5, order
  };
}

function answer(id: string, detected: string | null, text: string, order: number): AnswerEvidence {
  return {
    id,
    detectedQuestionNumber: detected,
    rawText: text,
    normalizedText: text,
    pages: [{ page: 1, bbox: { x: 0.1, y: 0.1, width: 0.8, height: 0.1 }, coordinateSpace: "normalized" }],
    ocrConfidence: 0.9,
    evidence: {
      hasQuestionNumberMarker: Boolean(detected),
      containsDiagram: false, containsTable: false, isCrossedOut: false, isContinuation: false
    },
    order
  };
}

// --- question number normalisation -----------------------------------------
for (const [input, expected] of [
  ["Q11(a)", "11a"], ["Ans 11 a", "11a"], ["11(a)", "11a"], ["11.a", "11a"],
  ["Question 3", "3"], ["Q2 -", "2"], ["12(ii)", "12ii"], [null, ""]
] as Array<[string | null, string]>) {
  assert.equal(normalizeQuestionNumber(input), expected, `normalize(${input})`);
}

// --- explicit number match dominates ---------------------------------------
const q1 = question("q_1", "1", null, "Define photosynthesis", 1);
assert.equal(scoreCandidate(q1, answer("a_1", "1", "plants make food", 1)).signals.explicitNumberScore, 1);
assert.equal(scoreCandidate(q1, answer("a_2", "7", "plants make food", 2)).signals.explicitNumberScore, 0);
assert.equal(
  scoreCandidate(question("q_11_a", "11", "a", "Plant A", 1), answer("a_1", "11", "x", 1)).signals.explicitNumberScore,
  0.5,
  "parent-only marker is a partial match"
);

// --- the regression this rewrite exists for --------------------------------
// Answers are out of order: the student answered Q3 first. A per-question
// greedy pass would let Q1 take a_1 on sequence alone and leave Q3 unanswered.
{
  const questions = [
    question("q_1", "1", null, "Define photosynthesis", 1),
    question("q_3", "3", null, "Name the parts of a nephron", 3)
  ];
  const answers = [answer("a_1", "3", "the nephron has a glomerulus", 1)];

  const { mappings, unmatchedAnswers } = buildFinalMappings(
    questions, answers, buildCandidateMappings(questions, answers)
  );

  const q3 = mappings.find((m) => m.questionId === "q_3");
  assert.equal(q3?.answerId, "a_1", "the answer must go to the question whose number it carries");
  assert.equal(mappings.find((m) => m.questionId === "q_1")?.status, "unanswered");
  assert.equal(unmatchedAnswers.length, 0);
}

// --- an answer is never assigned to two questions --------------------------
{
  const questions = [
    question("q_1", "1", null, "Define photosynthesis", 1),
    question("q_2", "2", null, "Define photosynthesis", 2)
  ];
  const answers = [answer("a_1", "2", "photosynthesis is how plants make food", 1)];
  const { mappings } = buildFinalMappings(questions, answers, buildCandidateMappings(questions, answers));

  assert.equal(mappings.filter((m) => m.answerId === "a_1").length, 1, "one answer, one question");
  assert.equal(mappings.find((m) => m.questionId === "q_2")?.answerId, "a_1");
}

// --- unmatched answers are reported, not dropped ---------------------------
{
  const questions = [question("q_1", "1", null, "Define photosynthesis", 1)];
  const answers = [
    answer("a_1", "1", "plants make food using sunlight", 1),
    answer("a_2", "9", "completely unrelated writing", 2)
  ];
  const { unmatchedAnswers } = buildFinalMappings(questions, answers, buildCandidateMappings(questions, answers));
  assert.deepEqual(unmatchedAnswers.map((a) => a.id), ["a_2"]);
}

console.log("mapping self-check passed");

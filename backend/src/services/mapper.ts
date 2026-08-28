import type { AnswerEvidence, CandidateMapping, ExtractedQuestion, FinalMapping } from "../types.js";
import { NEEDS_REVIEW, scoreCandidate } from "./scoring.js";

export function buildCandidateMappings(
  questions: ExtractedQuestion[],
  answers: AnswerEvidence[]
): CandidateMapping[] {
  return questions.flatMap((question) => answers.map((answer) => scoreCandidate(question, answer)));
}

/**
 * Assign answers to questions best-pair-first across the whole candidate set.
 *
 * Walking questions in order and letting each take its own best free answer
 * lets an early weak claim (Q1 -> a1 at 0.62) block a far stronger one later
 * (Q5 -> a1 at 0.95). Sorting every candidate by score first means the most
 * certain pairings are settled before the doubtful ones get to choose.
 *
 * ponytail: greedy over a global sort, not optimal assignment. Swap in
 * Hungarian if papers ever get large enough for the difference to show.
 */
export function buildFinalMappings(
  questions: ExtractedQuestion[],
  answers: AnswerEvidence[],
  candidates: CandidateMapping[]
): { mappings: FinalMapping[]; unmatchedAnswers: AnswerEvidence[] } {
  const bestForQuestion = new Map<string, CandidateMapping>();
  const takenAnswers = new Set<string>();

  for (const candidate of [...candidates].sort((a, b) => b.mappingScore - a.mappingScore)) {
    if (candidate.mappingScore < NEEDS_REVIEW) {
      break;
    }
    if (bestForQuestion.has(candidate.questionId) || takenAnswers.has(candidate.answerId)) {
      continue;
    }
    bestForQuestion.set(candidate.questionId, candidate);
    takenAnswers.add(candidate.answerId);
  }

  const answersById = new Map(answers.map((answer) => [answer.id, answer]));

  const mappings = questions.map((question): FinalMapping => {
    const best = bestForQuestion.get(question.id);
    const answer = best ? answersById.get(best.answerId) : undefined;

    // Alternatives the teacher can switch to, best first, excluding the winner.
    const alternatives = candidates
      .filter((candidate) => candidate.questionId === question.id && candidate.answerId !== best?.answerId)
      .sort((a, b) => b.mappingScore - a.mappingScore)
      .slice(0, 3)
      .map((candidate) => ({
        answerId: candidate.answerId,
        answerText: answersById.get(candidate.answerId)?.normalizedText ?? "",
        mappingScore: candidate.mappingScore
      }));

    const base = {
      questionId: question.id,
      questionNumber: question.number,
      part: question.part,
      questionText: question.text,
      marks: question.marks,
      grade: null,
      alternativeCandidates: alternatives
    };

    if (!best || !answer) {
      return {
        ...base,
        status: "unanswered",
        reviewStatus: "uncertain",
        answerId: null,
        answerText: null,
        answerRegions: [],
        mappingConfidence: 0,
        signals: null
      };
    }

    return {
      ...base,
      status: "answered",
      reviewStatus: best.status,
      answerId: answer.id,
      answerText: answer.normalizedText,
      answerRegions: answer.pages,
      mappingConfidence: best.mappingScore,
      signals: best.signals
    };
  });

  return {
    mappings,
    unmatchedAnswers: answers.filter((answer) => !takenAnswers.has(answer.id))
  };
}

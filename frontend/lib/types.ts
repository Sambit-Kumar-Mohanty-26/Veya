export type NormalizedBBox = { x: number; y: number; width: number; height: number };

/** `bbox` is null when the model could not locate the content on the page. */
export type Region = {
  page: number;
  bbox: NormalizedBBox | null;
  coordinateSpace: "normalized";
};

export type ReviewStatus = "high_confidence" | "needs_review" | "uncertain";
export type Evaluation = "correct" | "partially_correct" | "incorrect" | "unanswered";

export type MappingSignals = {
  explicitNumberScore: number;
  semanticScore: number;
  sequenceScore: number;
  ocrConfidence: number;
};

export type QuestionGrade = {
  maxMarks: number | null;
  awardedMarks: number | null;
  evaluation: Evaluation;
  feedback: string;
};

export type Mapping = {
  questionId: string;
  questionNumber: string;
  part: string | null;
  questionText: string;
  marks: number | null;
  status: "answered" | "unanswered";
  reviewStatus: ReviewStatus;
  answerId: string | null;
  answerText: string | null;
  answerRegions: Region[];
  mappingConfidence: number;
  signals: MappingSignals | null;
  grade: QuestionGrade | null;
  alternativeCandidates: Array<{ answerId: string; answerText: string; mappingScore: number }>;
};

export type AnswerEvidence = {
  id: string;
  detectedQuestionNumber: string | null;
  normalizedText: string;
  pages: Region[];
  ocrConfidence: number;
};

export type ProcessResult = {
  requestId: string;
  durationMs: number;
  summary: {
    totalQuestions: number;
    answered: number;
    unanswered: number;
    needsReview: number;
    unmatchedAnswers: number;
  };
  grading: { totalMarks: number; awardedMarks: number; percentage: number; summary: string } | null;
  answers: AnswerEvidence[];
  mappings: Mapping[];
  unmatchedAnswers: AnswerEvidence[];
};

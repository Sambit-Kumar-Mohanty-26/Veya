export type UploadedFileSummary = {
  originalName: string;
  mimeType: string;
  size: number;
};

export type NormalizedBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * A region on a document page. `bbox` is null when the model could not locate
 * the content — the viewer then shows the answer text without a highlight
 * rather than pointing at the wrong place.
 */
export type Region = {
  page: number;
  bbox: NormalizedBBox | null;
  coordinateSpace: "normalized";
};

export type ExtractedQuestion = {
  id: string;
  number: string;
  /** Sub-part label ("a", "ii") when the question is a labelled part, else null. */
  part: string | null;
  text: string;
  rawText: string;
  normalizedText: string;
  page: number;
  bbox: NormalizedBBox | null;
  coordinateSpace: "normalized";
  marks: number | null;
  order: number;
};

export type AnswerEvidence = {
  id: string;
  detectedQuestionNumber: string | null;
  rawText: string;
  normalizedText: string;
  pages: Region[];
  ocrConfidence: number;
  evidence: {
    hasQuestionNumberMarker: boolean;
    containsDiagram: boolean;
    containsTable: boolean;
    isCrossedOut: boolean;
    isContinuation: boolean;
  };
  order: number;
};

export type MappingSignals = {
  explicitNumberScore: number;
  semanticScore: number;
  sequenceScore: number;
  ocrConfidence: number;
};

export type CandidateMapping = {
  questionId: string;
  answerId: string;
  mappingScore: number;
  status: ReviewStatus;
  signals: MappingSignals;
};

export type ReviewStatus = "high_confidence" | "needs_review" | "uncertain";

export type Evaluation = "correct" | "partially_correct" | "incorrect" | "unanswered";

export type QuestionGrade = {
  maxMarks: number | null;
  awardedMarks: number | null;
  evaluation: Evaluation;
  feedback: string;
};

export type FinalMapping = {
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
  alternativeCandidates: Array<{
    answerId: string;
    answerText: string;
    mappingScore: number;
  }>;
};

export type GradingSummary = {
  totalMarks: number;
  awardedMarks: number;
  percentage: number;
  summary: string;
};

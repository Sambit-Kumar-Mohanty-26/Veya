import { z } from "zod";
import type { AnswerEvidence, Region } from "../types.js";
import { filesToInlineParts, geminiBoxToNormalized, generateJson } from "./gemini.js";
import { normalizeQuestionNumber } from "./scoring.js";

const PROMPT = `You are an expert at analysing handwritten student answer sheets.

TASK: Detect every distinct answer block the student has written.
An answer block is one contiguous region holding the response to a single question.
Look for question-number markers the student wrote ("1.", "Ans 11(a)", "Q2 -", "11 b").

Return a JSON array. Each element has exactly these fields:
{
  "detectedQuestionNumber": "<the number the student wrote, e.g. '1', '11(a)'> or null",
  "rawText": "<verbatim transcription of the handwriting in this block>",
  "normalizedText": "<cleaned, readable version of the same text>",
  "ocrConfidence": <0.0-1.0 confidence in the transcription>,
  "pages": [ { "page": <1-indexed>, "bbox": [ymin, xmin, ymax, xmax] on a 0-1000 scale or null } ],
  "evidence": {
    "hasQuestionNumberMarker": <bool>,
    "containsDiagram": <bool>,
    "containsTable": <bool>,
    "isCrossedOut": <bool>,
    "isContinuation": <bool — this block continues an answer from the previous page>
  }
}

RULES:
- List blocks top-to-bottom, page by page.
- One block never spans a page break. Where an answer runs onto the next page,
  report the part on each page as its own block: same "detectedQuestionNumber",
  and "isContinuation": true on the later one. Each block then has exactly one
  "pages" entry, holding a bbox for the writing on that page alone.
- Never merge answers to different questions into one block.
- The bbox must tightly enclose the handwriting, including any diagram.
- Set a bbox to null rather than guessing. A wrong box highlights the wrong answer.
- Return ONLY the JSON array.`;

const schema = z.array(
  z.object({
    detectedQuestionNumber: z.union([z.string(), z.number()]).nullish(),
    rawText: z.string().nullish(),
    normalizedText: z.string().nullish(),
    ocrConfidence: z.number().nullish(),
    pages: z.array(z.object({ page: z.number().nullish(), bbox: z.unknown().nullish() })).nullish(),
    evidence: z
      .object({
        hasQuestionNumberMarker: z.boolean().nullish(),
        containsDiagram: z.boolean().nullish(),
        containsTable: z.boolean().nullish(),
        isCrossedOut: z.boolean().nullish(),
        isContinuation: z.boolean().nullish()
      })
      .nullish()
  })
);

export async function extractAnswerEvidence(files: Express.Multer.File[]): Promise<AnswerEvidence[]> {
  const raw = await generateJson("Answer extraction", schema, [PROMPT, ...filesToInlineParts(files)]);
  // Numbered after merging, so a rejoined answer is one id and counts once in
  // the sequence signal.
  return mergeContinuations(toEvidence(raw)).map((item, index) => ({
    ...item,
    id: `a_${index + 1}`,
    order: index + 1
  }));
}

/**
 * Rejoin an answer that was written across a page break.
 *
 * Asked for one block with a region per page, the model returns one region and
 * quietly drops the other half's coordinates — measured over three runs of the
 * sample sheet it never once listed both pages. Detecting per page is what a
 * vision model is good at, so it is asked for that instead and the halves are
 * put back together here, where a page number and a question number are just
 * data to compare.
 */
export function mergeContinuations(items: AnswerEvidence[]): AnswerEvidence[] {
  const merged: AnswerEvidence[] = [];

  for (const item of items) {
    const previous = merged[merged.length - 1];
    const continues =
      previous &&
      item.evidence.isContinuation &&
      // A continuation carries either the same number or none at all; a
      // different number means the student started a new answer.
      (!item.detectedQuestionNumber ||
        normalizeQuestionNumber(item.detectedQuestionNumber) ===
          normalizeQuestionNumber(previous.detectedQuestionNumber));

    if (!continues) {
      merged.push(item);
      continue;
    }

    merged[merged.length - 1] = {
      ...previous,
      rawText: `${previous.rawText}\n${item.rawText}`,
      normalizedText: `${previous.normalizedText} ${item.normalizedText}`.trim(),
      pages: [...previous.pages, ...item.pages],
      // The whole answer is only as legible as its worst half.
      ocrConfidence: Math.min(previous.ocrConfidence, item.ocrConfidence),
      evidence: {
        ...previous.evidence,
        containsDiagram: previous.evidence.containsDiagram || item.evidence.containsDiagram,
        containsTable: previous.evidence.containsTable || item.evidence.containsTable,
        isCrossedOut: previous.evidence.isCrossedOut || item.evidence.isCrossedOut
      }
    };
  }

  return merged;
}

function toEvidence(raw: z.infer<typeof schema>): AnswerEvidence[] {
  return raw
    .filter((item) => (item.rawText ?? "").trim())
    .map((item, index): AnswerEvidence => {
      const rawText = (item.rawText ?? "").trim();
      const detected = item.detectedQuestionNumber != null ? String(item.detectedQuestionNumber).trim() : "";
      const ev = item.evidence ?? {};

      const pages: Region[] = (item.pages ?? []).map((page) => ({
        page: page.page && page.page > 0 ? Math.round(page.page) : 1,
        bbox: geminiBoxToNormalized(page.bbox),
        coordinateSpace: "normalized"
      }));

      return {
        id: `a_${index + 1}`,
        detectedQuestionNumber: detected || null,
        rawText,
        normalizedText: (item.normalizedText ?? rawText).trim(),
        // No synthetic fallback: an answer with no located page is still a real
        // answer, it just cannot be highlighted.
        pages,
        ocrConfidence: typeof item.ocrConfidence === "number" ? clamp01(item.ocrConfidence) : 0.75,
        evidence: {
          hasQuestionNumberMarker: Boolean(ev.hasQuestionNumberMarker ?? detected),
          containsDiagram: Boolean(ev.containsDiagram),
          containsTable: Boolean(ev.containsTable),
          isCrossedOut: Boolean(ev.isCrossedOut),
          isContinuation: Boolean(ev.isContinuation)
        },
        order: index + 1
      };
    });
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

import { z } from "zod";
import type { AnswerEvidence, Region } from "../types.js";
import { fileToInlinePart, geminiBoxToNormalized, generateJson } from "./gemini.js";

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
- A multi-page answer is ONE block with several entries in "pages".
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

export async function extractAnswerEvidence(file: Express.Multer.File): Promise<AnswerEvidence[]> {
  const raw = await generateJson("Answer extraction", schema, [PROMPT, fileToInlinePart(file)]);

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

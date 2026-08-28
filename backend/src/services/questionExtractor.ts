import { z } from "zod";
import type { ExtractedQuestion } from "../types.js";
import { fileToInlinePart, geminiBoxToNormalized, generateJson } from "./gemini.js";

const PROMPT = `You are an expert at reading printed exam question papers.

TASK: Extract every question and every labelled sub-part from this document in printed order.
Each labelled sub-part (e.g. "11(a)", "11(b)", "12(i)") MUST be a separate entry.

Return a JSON array. Each element has exactly these fields:
{
  "number": "<parent question number only, e.g. '1', '11', '12'>",
  "part": "<sub-part label without brackets, e.g. 'a', 'ii'> or null if not a sub-part",
  "text": "<question text only, without the number prefix and without the marks>",
  "rawText": "<full line as printed, including number and marks>",
  "marks": <number or null — the mark allocation if printed>,
  "page": <1-indexed page number>,
  "bbox": [ymin, xmin, ymax, xmax] on a 0-1000 scale, or null if you cannot locate it
}

RULES:
- Preserve exact printed order.
- Include ALL questions and ALL sub-parts.
- Set "bbox" to null rather than guessing. A wrong box is worse than no box.
- Return ONLY the JSON array.`;

const schema = z.array(
  z.object({
    number: z.union([z.string(), z.number()]),
    part: z.union([z.string(), z.number()]).nullish(),
    text: z.string().nullish(),
    rawText: z.string().nullish(),
    marks: z.number().nullish(),
    page: z.number().nullish(),
    bbox: z.unknown().nullish()
  })
);

export async function extractQuestions(file: Express.Multer.File): Promise<ExtractedQuestion[]> {
  const raw = await generateJson("Question extraction", schema, [PROMPT, fileToInlinePart(file)]);

  return raw.map((item, index): ExtractedQuestion => {
    const number = String(item.number).trim();
    const part = item.part != null && String(item.part).trim() ? String(item.part).trim() : null;
    const text = (item.text ?? item.rawText ?? "").trim();

    return {
      id: toQuestionId(number, part, index),
      number,
      part,
      text,
      rawText: (item.rawText ?? text).trim(),
      normalizedText: text.toLowerCase(),
      page: item.page && item.page > 0 ? Math.round(item.page) : 1,
      bbox: geminiBoxToNormalized(item.bbox),
      coordinateSpace: "normalized",
      marks: typeof item.marks === "number" ? item.marks : null,
      order: index + 1
    };
  });
}

function toQuestionId(number: string, part: string | null, index: number): string {
  const slug = [number, part].filter(Boolean).join("_").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return slug ? `q_${slug}` : `q_${index + 1}`;
}

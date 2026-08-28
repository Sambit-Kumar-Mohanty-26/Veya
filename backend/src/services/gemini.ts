import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ZodType } from "zod";
import type { NormalizedBBox } from "../types.js";

/**
 * The free tier allows 20 requests per day *per model*, and one assessment
 * costs three calls — so a single pinned model dies after about six runs.
 * The quota is per model, so we walk a chain instead: when one is exhausted,
 * retired, or overloaded, the next one serves.
 *
 * Ordering is full flash models first (best bounding boxes), then the lite
 * variants, which still work but locate handwriting less precisely, then pro
 * as a genuine last resort — its free-tier daily allowance is tiny, so it is
 * only worth a call once everything else is spent.
 *
 * Every name here was probed against a live key: retired models (the 2.5
 * family, now 404 for new keys) are deliberately absent. Set GEMINI_MODEL to
 * a single name, or a comma-separated list, to override the whole chain.
 */
const DEFAULT_MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-pro-preview",
  "gemini-pro-latest"
];

const MODEL_CHAIN = [
  ...new Set(
    (process.env.GEMINI_MODEL?.split(",").map((name) => name.trim()).filter(Boolean) ?? DEFAULT_MODEL_CHAIN)
  )
];

const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 120_000;

// Grading an 8-question paper produces a lot of JSON, and newer Gemini models
// spend output budget on reasoning before they emit any. Too low a ceiling
// truncates the response mid-object, which surfaces as "malformed JSON".
const MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 32_768;

/** Waiting longer than this for a rate limit is worse than trying another model. */
const MAX_WAIT_MS = 15_000;

export const configuredModels = MODEL_CHAIN;

/** Thrown when the model call or its response is unusable. Surfaces to the teacher as a real error. */
export class AiError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AiError";
  }
}

export function hasApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Built on first use, not at import time: ES module imports are evaluated
 * before the importing module's body, so a client constructed here at load
 * would capture the key before server.ts has called dotenv.config().
 */
let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  client ??= new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
  return client;
}

type FilePart = { inlineData: { data: string; mimeType: string } };

export function fileToInlinePart(file: Express.Multer.File): FilePart {
  return { inlineData: { data: file.buffer.toString("base64"), mimeType: file.mimetype } };
}

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------

type Failure = "daily_quota" | "rate_limit" | "overloaded" | "missing_model" | "fatal";

/**
 * A 429 is two very different problems wearing the same status code. A
 * per-minute limit clears in seconds and is worth waiting for; a per-day quota
 * cannot clear today, so retrying it just burns time before the same failure.
 */
function classify(error: unknown): Failure {
  const status = (error as { status?: number }).status;

  if (status === 429) {
    return quotaIds(error).some((id) => id.includes("PerDay")) ? "daily_quota" : "rate_limit";
  }
  if (status === 503 || status === 500) {
    return "overloaded";
  }
  if (status === 404) {
    return "missing_model";
  }
  return "fatal";
}

function quotaIds(error: unknown): string[] {
  const details = (error as { errorDetails?: unknown[] }).errorDetails ?? [];
  return details.flatMap((detail) => {
    const violations = (detail as { violations?: Array<{ quotaId?: string }> }).violations ?? [];
    return violations.map((violation) => String(violation.quotaId ?? ""));
  });
}

/** Gemini tells us how long to wait; prefer its number over a guess. */
function suggestedDelayMs(error: unknown): number | null {
  const details = (error as { errorDetails?: unknown[] }).errorDetails ?? [];
  for (const detail of details) {
    const value = (detail as { retryDelay?: string }).retryDelay;
    const match = /^(\d+(?:\.\d+)?)s$/.exec(String(value ?? ""));
    if (match) {
      return Math.ceil(Number(match[1]) * 1000);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Model bench — stop paying for a model we already know is unavailable
// ---------------------------------------------------------------------------

const benched = new Map<string, number>();

const COOLDOWN_MS: Record<Failure, number> = {
  daily_quota: 30 * 60_000,   // re-probe occasionally; the real reset is midnight PT
  missing_model: 6 * 3600_000, // a retired model is not coming back this session
  overloaded: 5 * 60_000,
  rate_limit: 30_000,
  fatal: 0
};

function bench(model: string, failure: Failure) {
  benched.set(model, Date.now() + COOLDOWN_MS[failure]);
}

function modelsToTry(): string[] {
  const now = Date.now();
  const ready = MODEL_CHAIN.filter((model) => (benched.get(model) ?? 0) <= now);
  // If every model is benched, try them all anyway rather than fail untried.
  return ready.length > 0 ? ready : MODEL_CHAIN;
}

// ---------------------------------------------------------------------------
// The gateway
// ---------------------------------------------------------------------------

/**
 * Single gateway for every model call: model fallback, JSON response mode,
 * timeout, and schema validation. Callers get parsed, trusted data or an
 * AiError — never a silent [].
 */
export async function generateJson<T>(
  label: string,
  schema: ZodType<T>,
  parts: Array<string | FilePart>
): Promise<T> {
  if (!hasApiKey()) {
    throw new AiError("GEMINI_API_KEY is not configured on the server.");
  }

  const candidates = modelsToTry();
  let lastError: unknown;
  let lastFailure: Failure = "fatal";

  for (const [index, model] of candidates.entries()) {
    const isLastCandidate = index === candidates.length - 1;
    try {
      return parseResponse(label, schema, await callModel(model, label, parts, isLastCandidate));
    } catch (error) {
      // A truncated or schema-invalid response is our problem, not the model's
      // availability — another model will not fix it.
      if (error instanceof AiError) {
        throw error;
      }

      const failure = classify(error);
      if (failure === "fatal") {
        throw new AiError(`${label} failed: ${describe(error)}`, error);
      }

      bench(model, failure);
      lastError = error;
      lastFailure = failure;
      console.warn(`[gemini] ${label}: ${model} ${failure}${nextHint(model, candidates)}`);
    }
  }

  throw new AiError(exhaustedMessage(label, lastFailure, candidates), lastError);
}

async function callModel(
  model: string,
  label: string,
  parts: Array<string | FilePart>,
  isLastCandidate: boolean
): Promise<string> {
  const generative = getClient().getGenerativeModel(
    {
      model,
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: MAX_OUTPUT_TOKENS }
    },
    { timeout: TIMEOUT_MS }
  );

  // Waiting on a busy model only makes sense when there is nothing left to fall
  // back to; otherwise another model answers sooner than this one recovers.
  // A daily quota is never retried — it cannot clear today.
  for (let attempt = 0; ; attempt += 1) {
    try {
      const result = await generative.generateContent(parts);

      // A truncated or filtered response still parses as a string, and would
      // otherwise fail later as an unexplained "malformed JSON".
      const finishReason = result.response.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== "STOP") {
        throw new AiError(
          finishReason === "MAX_TOKENS"
            ? `${label} failed: the response was cut off. Raise GEMINI_MAX_OUTPUT_TOKENS.`
            : `${label} failed: the AI stopped early (${finishReason}).`
        );
      }

      if (attempt > 0) {
        console.log(`[gemini] ${label}: ${model} recovered on retry`);
      }
      return result.response.text();
    } catch (error) {
      if (error instanceof AiError) {
        throw error;
      }

      const failure = classify(error);
      const wait = suggestedDelayMs(error) ?? (attempt + 1) * 1500;

      const worthWaiting = failure === "rate_limit" || isLastCandidate;

      if (
        failure === "daily_quota" ||
        failure === "missing_model" ||
        !worthWaiting ||
        attempt >= 1 ||
        wait > MAX_WAIT_MS
      ) {
        throw error;
      }

      console.warn(`[gemini] ${label}: ${model} ${failure}, retrying in ${wait}ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

function parseResponse<T>(label: string, schema: ZodType<T>, text: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(text));
  } catch (error) {
    throw new AiError(`${label} failed: the AI returned malformed JSON.`, error);
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    throw new AiError(`${label} failed: ${validated.error.issues[0]?.message ?? "unexpected shape"}.`);
  }
  return validated.data;
}

function nextHint(model: string, candidates: string[]): string {
  const next = candidates[candidates.indexOf(model) + 1];
  return next ? `, falling back to ${next}` : "";
}

function exhaustedMessage(label: string, failure: Failure, candidates: string[]): string {
  if (failure === "daily_quota") {
    return candidates.length === 1
      ? `${label} failed: ${candidates[0]} has used its free-tier daily quota ` +
          "(20 requests/day). Unset GEMINI_MODEL to fall back to other models, or try again tomorrow."
      : `${label} failed: all ${candidates.length} Gemini models have used their free-tier ` +
          "daily quota (20 requests/day each). The quota resets at midnight Pacific.";
  }
  if (failure === "overloaded") {
    return `${label} failed: every configured Gemini model is overloaded. Try again in a minute.`;
  }
  if (failure === "missing_model") {
    return `${label} failed: no configured Gemini model is available. Check GEMINI_MODEL.`;
  }
  return `${label} failed: the AI service is rate limited. Try again in a moment.`;
}

function describe(error: unknown): string {
  const status = (error as { status?: number }).status;
  if (status === 403) return "the AI API key was rejected.";
  if (status === 400) return "the AI rejected the request.";
  return "the AI service did not respond.";
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Gemini returns boxes as [ymin, xmin, ymax, xmax] on a 0-1000 scale.
 * Returns null for anything unusable — we never invent a region, because a
 * fabricated box highlights the wrong handwriting with full confidence.
 */
export function geminiBoxToNormalized(bbox: unknown): NormalizedBBox | null {
  if (!Array.isArray(bbox) || bbox.length < 4 || !bbox.every((n) => typeof n === "number")) {
    return null;
  }

  const [ymin, xmin, ymax, xmax] = bbox as number[];
  const x = clamp01(xmin / 1000);
  const y = clamp01(ymin / 1000);
  const width = clamp01(xmax / 1000) - x;
  const height = clamp01(ymax / 1000) - y;

  return width > 0.005 && height > 0.005 ? { x, y, width, height } : null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** responseMimeType should prevent fences, but models occasionally add them anyway. */
function stripJsonFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

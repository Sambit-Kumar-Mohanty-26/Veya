import cors from "cors";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { AiError, configuredModels, hasApiKey } from "./services/gemini.js";
import { gradeItems } from "./services/grading.js";
import { processAssessment } from "./services/processAssessment.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** A page-per-image answer sheet is the reason this is not 1. */
const MAX_FILES_PER_DOCUMENT = 20;

const ACCEPTED_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES_PER_DOCUMENT * 2 },
  fileFilter: (_req, file, callback) => {
    if (!ACCEPTED_TYPES.has(file.mimetype)) {
      callback(new Error("Only PDF, PNG, and JPG files are supported."));
      return;
    }
    callback(null, true);
  }
});

app.use(cors({ origin: allowedOrigin.split(",").map((origin) => origin.trim()), credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "veya-backend",
    aiConfigured: hasApiKey(),
    models: configuredModels,
    timestamp: new Date().toISOString()
  });
});

app.post(
  "/api/process",
  upload.fields([
    { name: "questionPaper", maxCount: MAX_FILES_PER_DOCUMENT },
    { name: "answerSheet", maxCount: MAX_FILES_PER_DOCUMENT }
  ]),
  async (req, res, next) => {
    // Either document may arrive as several files - one photo per page. They
    // stay in upload order, which is the page order the extractors are told to
    // assume and the order the viewer rasterises them in.
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const questionPaper = files?.questionPaper ?? [];
    const answerSheet = files?.answerSheet ?? [];

    if (!questionPaper.length || !answerSheet.length) {
      res.status(400).json({
        error: { code: "MISSING_FILES", message: "Upload both a question paper and an answer sheet." }
      });
      return;
    }

    const startedAt = Date.now();
    try {
      const result = await processAssessment(questionPaper, answerSheet);
      console.log(
        `[process] ${result.requestId} ${result.summary.totalQuestions}q ` +
          `${result.summary.answered}a ${Date.now() - startedAt}ms`
      );
      res.json(result);
    } catch (error) {
      console.error(`[process] failed after ${Date.now() - startedAt}ms:`, error);
      next(error);
    }
  }
);

/**
 * Re-marks specific questions. The teacher reassigning an answer is the only
 * caller: the mark on screen was written about the answer that was just
 * replaced, so it has to be replaced too. Nothing is stored between requests,
 * so the client sends back the question and the answer text it wants marked.
 */
app.post("/api/grade", async (req, res, next) => {
  const items: Array<Record<string, unknown>> | null = Array.isArray(req.body?.items) ? req.body.items : null;

  if (!items?.length || items.length > 50) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Send 1-50 questions to mark." } });
    return;
  }

  const normalized = items.map((item) => ({
    id: String(item.id ?? ""),
    question: String(item.question ?? ""),
    marks: typeof item.marks === "number" ? item.marks : null,
    answer: item.answer == null ? null : String(item.answer)
  }));

  if (normalized.some((item) => !item.id || !item.question)) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Each item needs an id and question." } });
    return;
  }

  try {
    const { grades } = await gradeItems(normalized);
    res.json({ grades: Object.fromEntries(grades) });
  } catch (error) {
    next(error);
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `Each file must be ${MAX_FILE_BYTES / 1024 / 1024}MB or smaller.`
        : err.message;
    res.status(400).json({ error: { code: err.code, message } });
    return;
  }

  // An AI failure is the service's fault, not the teacher's - say so, and say why.
  if (err instanceof AiError) {
    res.status(502).json({ error: { code: "AI_FAILED", message: err.message } });
    return;
  }

  const message = err instanceof Error ? err.message : "Something went wrong.";
  res.status(400).json({ error: { code: "REQUEST_FAILED", message } });
});

app.listen(port, () => {
  console.log(`API running on port ${port} (AI ${hasApiKey() ? "configured" : "NOT configured"})`);
});

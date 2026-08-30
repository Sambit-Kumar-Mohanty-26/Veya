import cors from "cors";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { AiError, configuredModels, hasApiKey } from "./services/gemini.js";
import { processAssessment } from "./services/processAssessment.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ACCEPTED_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 2 },
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
    { name: "questionPaper", maxCount: 1 },
    { name: "answerSheet", maxCount: 1 }
  ]),
  async (req, res, next) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const questionPaper = files?.questionPaper?.[0];
    const answerSheet = files?.answerSheet?.[0];

    if (!questionPaper || !answerSheet) {
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

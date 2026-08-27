import cors from "cors";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    const acceptedTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);

    if (!acceptedTypes.has(file.mimetype)) {
      callback(new Error("Only PDF, PNG, JPG, and JPEG files are supported."));
      return;
    }

    callback(null, true);
  }
});

type UploadedFileSummary = {
  originalName: string;
  mimeType: string;
  size: number;
};

type Region = {
  page: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  coordinateSpace: "normalized";
  pageWidth: number;
  pageHeight: number;
};

app.use(
  cors({
    origin: allowedOrigin.split(",").map((origin) => origin.trim()),
    credentials: true
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "veya-backend",
    timestamp: new Date().toISOString()
  });
});

app.post(
  "/api/process",
  upload.fields([
    { name: "questionPaper", maxCount: 1 },
    { name: "answerSheet", maxCount: 1 }
  ]),
  (req, res) => {
    const files = req.files as
      | {
          questionPaper?: Express.Multer.File[];
          answerSheet?: Express.Multer.File[];
        }
      | undefined;

    const questionPaper = files?.questionPaper?.[0];
    const answerSheet = files?.answerSheet?.[0];

    if (!questionPaper || !answerSheet) {
      res.status(400).json({
        error: {
          code: "MISSING_FILES",
          message: "Upload both a question paper and an answer sheet."
        }
      });
      return;
    }

    const sampleRegion: Region = {
      page: 1,
      bbox: {
        x: 0.08,
        y: 0.18,
        width: 0.78,
        height: 0.16
      },
      coordinateSpace: "normalized",
      pageWidth: 2480,
      pageHeight: 3508
    };

    const summarize = (file: Express.Multer.File): UploadedFileSummary => ({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    });

    res.json({
      requestId: randomUUID(),
      phase: "preview_pipeline",
      files: {
        questionPaper: summarize(questionPaper),
        answerSheet: summarize(answerSheet)
      },
      progress: [
        { key: "upload", label: "Files received", status: "complete" },
        { key: "question_extraction", label: "Question extraction pending", status: "pending" },
        { key: "answer_extraction", label: "Answer extraction pending", status: "pending" },
        { key: "mapping", label: "Answer mapping pending", status: "pending" }
      ],
      questions: [
        {
          id: "q_1",
          number: "1",
          text: "Sample extracted question placeholder",
          rawText: "1. Sample extracted question placeholder",
          normalizedText: "Sample extracted question placeholder",
          page: 1,
          bbox: {
            x: 0.08,
            y: 0.12,
            width: 0.82,
            height: 0.06
          },
          coordinateSpace: "normalized",
          marks: null
        }
      ],
      answers: [
        {
          id: "a_1",
          detectedQuestionNumber: "1",
          rawText: "Sample handwritten answer placeholder",
          normalizedText: "Sample handwritten answer placeholder",
          pages: [sampleRegion],
          ocrConfidence: 0.91,
          evidence: {
            hasQuestionNumberMarker: true,
            containsDiagram: false,
            containsTable: false,
            isCrossedOut: false
          }
        }
      ],
      mappings: [
        {
          questionId: "q_1",
          questionNumber: "1",
          questionText: "Sample extracted question placeholder",
          status: "answered",
          reviewStatus: "high_confidence",
          answerId: "a_1",
          answerText: "Sample handwritten answer placeholder",
          answerRegions: [sampleRegion],
          mappingConfidence: 0.94,
          alternativeCandidates: []
        }
      ]
    });
  }
);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({
    error: {
      code: "REQUEST_FAILED",
      message: err.message
    }
  });
});

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});

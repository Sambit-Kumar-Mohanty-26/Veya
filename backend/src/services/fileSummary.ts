import type { UploadedFileSummary } from "../types.js";

export function summarizeFile(file: Express.Multer.File): UploadedFileSummary {
  return {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size
  };
}

import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env";
import {
  deleteJobEvidenceHandler,
  downloadJobEvidenceHandler,
  listJobEvidenceHandler,
  uploadJobEvidenceHandler,
} from "./evidence.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.EVIDENCE_MAX_SIZE_BYTES,
    files: 1,
  },
});

const evidenceRouter = Router({ mergeParams: true });

evidenceRouter.get("/", listJobEvidenceHandler);
evidenceRouter.post("/", upload.single("file"), uploadJobEvidenceHandler);
evidenceRouter.get("/:evidenceId/download", downloadJobEvidenceHandler);
evidenceRouter.delete("/:evidenceId", deleteJobEvidenceHandler);

export { evidenceRouter };

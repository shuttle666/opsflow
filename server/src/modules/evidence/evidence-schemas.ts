import { JobEvidenceKind } from "@prisma/client";
import { z } from "zod";

const optionalNoteSchema = z.string().trim().max(300).optional().or(z.literal(""));

export const jobEvidenceParamsSchema = z.object({
  jobId: z.uuid(),
});

export const jobEvidenceItemParamsSchema = jobEvidenceParamsSchema.extend({
  evidenceId: z.uuid(),
});

export const uploadJobEvidenceBodySchema = z
  .object({
    kind: z.nativeEnum(JobEvidenceKind),
    note: optionalNoteSchema,
  })
  .strict();

export type UploadJobEvidenceBodyInput = z.infer<typeof uploadJobEvidenceBodySchema>;

import { AuditAction, JobEvidenceKind, MembershipRole, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthContext, RequestMetadata } from "../../types/auth";
import { ApiError } from "../../utils/api-error";
import { env } from "../../config/env";
import {
  evidenceStorage,
  supportedEvidenceMimeTypes,
} from "./evidence-storage";

type UploadJobEvidenceInput = {
  kind: JobEvidenceKind;
  note?: string;
  file: Pick<Express.Multer.File, "originalname" | "mimetype" | "buffer" | "size">;
};

export type JobEvidenceItem = {
  id: string;
  kind: JobEvidenceKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  createdAt: Date;
  downloadPath: string;
  uploadedBy: {
    id: string;
    displayName: string;
    email: string;
  };
};

export type JobEvidenceDownload = {
  fileName: string;
  mimeType: string;
  absolutePath: string;
};

type VisibleJob = {
  id: string;
  tenantId: string;
  title: string;
};

type VisibleEvidence = {
  id: string;
  tenantId: string;
  jobId: string;
  kind: JobEvidenceKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  storageKey: string;
  createdAt: Date;
  job: {
    title: string;
  };
  uploadedBy: {
    id: string;
    displayName: string;
    email: string;
  };
};

function normalizeOptionalNote(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildVisibleJobWhere(auth: AuthContext, jobId: string): Prisma.JobWhereInput {
  return {
    id: jobId,
    tenantId: auth.tenantId,
    ...(auth.role === MembershipRole.STAFF ? { assignedToId: auth.userId } : {}),
  };
}

async function getVisibleJobOrThrow(auth: AuthContext, jobId: string): Promise<VisibleJob> {
  const job = await prisma.job.findFirst({
    where: buildVisibleJobWhere(auth, jobId),
    select: {
      id: true,
      tenantId: true,
      title: true,
    },
  });

  if (!job) {
    throw new ApiError(404, "Job not found.");
  }

  return job;
}

async function getVisibleEvidenceOrThrow(
  auth: AuthContext,
  jobId: string,
  evidenceId: string,
): Promise<VisibleEvidence> {
  const evidence = await prisma.jobEvidence.findFirst({
    where: {
      id: evidenceId,
      tenantId: auth.tenantId,
      jobId,
      job: buildVisibleJobWhere(auth, jobId),
    },
    select: {
      id: true,
      tenantId: true,
      jobId: true,
      kind: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      note: true,
      storageKey: true,
      createdAt: true,
      job: {
        select: {
          title: true,
        },
      },
      uploadedBy: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  if (!evidence) {
    throw new ApiError(404, "Evidence not found.");
  }

  return evidence;
}

function mapJobEvidenceItem(item: VisibleEvidence): JobEvidenceItem {
  return {
    id: item.id,
    kind: item.kind,
    fileName: item.fileName,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    note: item.note,
    createdAt: item.createdAt,
    downloadPath: `/jobs/${item.jobId}/evidence/${item.id}/download`,
    uploadedBy: item.uploadedBy,
  };
}

function assertSupportedEvidenceFile(file: UploadJobEvidenceInput["file"]) {
  if (!file) {
    throw new ApiError(400, "Evidence file is required.");
  }

  if (!supportedEvidenceMimeTypes.includes(file.mimetype as (typeof supportedEvidenceMimeTypes)[number])) {
    throw new ApiError(400, "Evidence file type is not supported.");
  }

  if (file.size > env.EVIDENCE_MAX_SIZE_BYTES) {
    throw new ApiError(400, "Evidence file exceeds the maximum allowed size.");
  }
}

export async function listJobEvidence(
  auth: AuthContext,
  jobId: string,
): Promise<JobEvidenceItem[]> {
  await getVisibleJobOrThrow(auth, jobId);

  const items = await prisma.jobEvidence.findMany({
    where: {
      tenantId: auth.tenantId,
      jobId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      tenantId: true,
      jobId: true,
      kind: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      note: true,
      storageKey: true,
      createdAt: true,
      job: {
        select: {
          title: true,
        },
      },
      uploadedBy: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  return items.map(mapJobEvidenceItem);
}

export async function uploadJobEvidence(
  auth: AuthContext,
  jobId: string,
  input: UploadJobEvidenceInput,
  metadata?: RequestMetadata,
): Promise<JobEvidenceItem> {
  const job = await getVisibleJobOrThrow(auth, jobId);
  assertSupportedEvidenceFile(input.file);

  const stored = await evidenceStorage.save({
    tenantId: job.tenantId,
    jobId: job.id,
    fileName: input.file.originalname,
    mimeType: input.file.mimetype,
    buffer: input.file.buffer,
  });

  try {
    const created = await prisma.$transaction(async (tx) => {
      const evidence = await tx.jobEvidence.create({
        data: {
          tenantId: auth.tenantId,
          jobId: job.id,
          uploadedById: auth.userId,
          kind: input.kind,
          fileName: input.file.originalname,
          mimeType: input.file.mimetype,
          sizeBytes: input.file.size,
          storageKey: stored.storageKey,
          note: normalizeOptionalNote(input.note),
        },
        select: {
          id: true,
          tenantId: true,
          jobId: true,
          kind: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          note: true,
          storageKey: true,
          createdAt: true,
          job: {
            select: {
              title: true,
            },
          },
          uploadedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.JOB_EVIDENCE_UPLOADED,
          tenantId: auth.tenantId,
          userId: auth.userId,
          targetType: "job_evidence",
          targetId: evidence.id,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
          metadata: {
            jobTitle: job.title,
            fileName: evidence.fileName,
            mimeType: evidence.mimeType,
            sizeBytes: evidence.sizeBytes,
            kind: evidence.kind,
          },
        },
      });

      return evidence;
    });

    return mapJobEvidenceItem(created);
  } catch (error) {
    await evidenceStorage.remove(stored.storageKey).catch((cleanupError) => {
      console.error("Failed to clean up stored evidence after DB error.", cleanupError);
    });
    throw error;
  }
}

export async function deleteJobEvidence(
  auth: AuthContext,
  jobId: string,
  evidenceId: string,
  metadata?: RequestMetadata,
): Promise<void> {
  const evidence = await getVisibleEvidenceOrThrow(auth, jobId, evidenceId);

  await prisma.$transaction(async (tx) => {
    await tx.jobEvidence.delete({
      where: {
        id: evidence.id,
      },
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.JOB_EVIDENCE_DELETED,
        tenantId: auth.tenantId,
        userId: auth.userId,
        targetType: "job_evidence",
        targetId: evidence.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          jobTitle: evidence.job.title,
          fileName: evidence.fileName,
          mimeType: evidence.mimeType,
          sizeBytes: evidence.sizeBytes,
          kind: evidence.kind,
        },
      },
    });
  });

  await evidenceStorage.remove(evidence.storageKey);
}

export async function getJobEvidenceDownload(
  auth: AuthContext,
  jobId: string,
  evidenceId: string,
): Promise<JobEvidenceDownload> {
  const evidence = await getVisibleEvidenceOrThrow(auth, jobId, evidenceId);
  const stored = await evidenceStorage.open(evidence.storageKey);

  return {
    fileName: evidence.fileName,
    mimeType: evidence.mimeType,
    absolutePath: stored.absolutePath,
  };
}

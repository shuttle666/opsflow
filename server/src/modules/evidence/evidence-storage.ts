import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "../../config/env";

export const supportedEvidenceMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

type EvidenceFileInput = {
  tenantId: string;
  jobId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

export type StoredEvidenceFile = {
  storageKey: string;
  absolutePath: string;
};

export interface EvidenceStorage {
  save(input: EvidenceFileInput): Promise<StoredEvidenceFile>;
  open(storageKey: string): Promise<StoredEvidenceFile>;
  remove(storageKey: string): Promise<void>;
}

function sanitizeFileName(fileName: string) {
  const baseName = path.basename(fileName).trim() || "evidence";
  return baseName.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export class LocalDiskEvidenceStorage implements EvidenceStorage {
  private readonly rootDirectory = path.resolve(process.cwd(), env.EVIDENCE_DIR);

  private resolveStoragePath(storageKey: string) {
    const absolutePath = path.resolve(this.rootDirectory, storageKey);
    const relativePath = path.relative(this.rootDirectory, absolutePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error("Invalid storage key.");
    }

    return absolutePath;
  }

  async save(input: EvidenceFileInput): Promise<StoredEvidenceFile> {
    const safeFileName = sanitizeFileName(input.fileName);
    const storageKey = path.join(
      input.tenantId,
      input.jobId,
      `${randomUUID()}-${safeFileName}`,
    );
    const absolutePath = this.resolveStoragePath(storageKey);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.buffer);

    return {
      storageKey,
      absolutePath,
    };
  }

  async open(storageKey: string): Promise<StoredEvidenceFile> {
    const absolutePath = this.resolveStoragePath(storageKey);
    await fs.access(absolutePath);

    return {
      storageKey,
      absolutePath,
    };
  }

  async remove(storageKey: string): Promise<void> {
    const absolutePath = this.resolveStoragePath(storageKey);
    await fs.rm(absolutePath, { force: true });
  }
}

export const evidenceStorage: EvidenceStorage = new LocalDiskEvidenceStorage();

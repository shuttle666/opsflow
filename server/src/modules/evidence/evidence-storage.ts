import { randomUUID } from "node:crypto";
import { promises as fs, type Dirent } from "node:fs";
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
  removeTenant(tenantId: string): Promise<void>;
  removeAll(): Promise<void>;
}

function sanitizeFileName(fileName: string) {
  const baseName = path.basename(fileName).trim() || "evidence";
  return baseName.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

const uuidDirectoryName =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export class LocalDiskEvidenceStorage implements EvidenceStorage {
  private readonly rootDirectory: string;

  constructor(rootDirectory = path.resolve(process.cwd(), env.EVIDENCE_DIR)) {
    this.rootDirectory = path.resolve(rootDirectory);
  }

  private assertSafePathSegment(value: string, label: string) {
    if (
      value.length === 0 ||
      value.trim() !== value ||
      value === "." ||
      value === ".." ||
      value.includes("\0") ||
      /[\\/]/.test(value)
    ) {
      throw new Error(`Invalid ${label}.`);
    }
  }

  private assertSafeCleanupRoot() {
    const filesystemRoot = path.parse(this.rootDirectory).root;
    const rootToWorkingDirectory = path.relative(this.rootDirectory, process.cwd());
    const containsWorkingDirectory =
      rootToWorkingDirectory === "" ||
      (!rootToWorkingDirectory.startsWith("..") &&
        !path.isAbsolute(rootToWorkingDirectory));

    if (this.rootDirectory === filesystemRoot || containsWorkingDirectory) {
      throw new Error("Refusing to remove an unsafe evidence root directory.");
    }
  }

  private resolveStoragePath(storageKey: string) {
    const absolutePath = path.resolve(this.rootDirectory, storageKey);
    const relativePath = path.relative(this.rootDirectory, absolutePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error("Invalid storage key.");
    }

    return absolutePath;
  }

  async save(input: EvidenceFileInput): Promise<StoredEvidenceFile> {
    this.assertSafePathSegment(input.tenantId, "tenant id");
    this.assertSafePathSegment(input.jobId, "job id");

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

  async removeTenant(tenantId: string): Promise<void> {
    this.assertSafePathSegment(tenantId, "tenant id");
    this.assertSafeCleanupRoot();
    const tenantDirectory = this.resolveStoragePath(tenantId);
    await fs.rm(tenantDirectory, { recursive: true, force: true });
  }

  async removeAll(): Promise<void> {
    this.assertSafeCleanupRoot();
    let entries: Dirent<string>[];

    try {
      entries = await fs.readdir(this.rootDirectory, {
        withFileTypes: true,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }
      throw error;
    }

    // Evidence is always stored below a UUID tenant directory. Delete only
    // known-owned children and keep the configured root itself, so a bad
    // EVIDENCE_DIR cannot recursively erase an arbitrary directory tree.
    await Promise.all(
      entries
        .filter(
          (entry) => entry.isDirectory() && uuidDirectoryName.test(entry.name),
        )
        .map((entry) =>
          fs.rm(path.join(this.rootDirectory, entry.name), {
            recursive: true,
            force: true,
          }),
        ),
    );
  }
}

export const evidenceStorage: EvidenceStorage = new LocalDiskEvidenceStorage();

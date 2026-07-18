import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalDiskEvidenceStorage } from "../src/modules/evidence/evidence-storage";

describe("local disk evidence storage cleanup", () => {
  const firstTenantId = "11111111-1111-4111-8111-111111111111";
  const secondTenantId = "22222222-2222-4222-8222-222222222222";
  let temporaryDirectory: string;
  let storage: LocalDiskEvidenceStorage;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "opsflow-evidence-"));
    storage = new LocalDiskEvidenceStorage(path.join(temporaryDirectory, "evidence"));
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  async function save(tenantId: string, jobId: string, contents: string) {
    return storage.save({
      tenantId,
      jobId,
      fileName: "proof.png",
      mimeType: "image/png",
      buffer: Buffer.from(contents),
    });
  }

  it("removes only the requested tenant directory", async () => {
    const firstTenantFile = await save(firstTenantId, "job-one", "first");
    const secondTenantFile = await save(secondTenantId, "job-two", "second");

    await storage.removeTenant(firstTenantId);

    await expect(fs.access(firstTenantFile.absolutePath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(fs.readFile(secondTenantFile.absolutePath, "utf8")).resolves.toBe(
      "second",
    );
  });

  it("removes all persisted evidence", async () => {
    const firstTenantFile = await save(firstTenantId, "job-one", "first");
    const secondTenantFile = await save(secondTenantId, "job-two", "second");
    const unexpectedDirectory = path.join(
      temporaryDirectory,
      "evidence",
      "application-source",
    );
    await fs.mkdir(unexpectedDirectory, { recursive: true });
    await fs.writeFile(path.join(unexpectedDirectory, "keep.txt"), "keep");

    await storage.removeAll();

    await expect(fs.access(firstTenantFile.absolutePath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(fs.access(secondTenantFile.absolutePath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(
      fs.readFile(path.join(unexpectedDirectory, "keep.txt"), "utf8"),
    ).resolves.toBe("keep");
  });

  it.each(["", ".", "..", "../tenant-two", "tenant-one/../tenant-two"])(
    "rejects an unsafe tenant cleanup path: %j",
    async (tenantId) => {
      const secondTenantFile = await save(secondTenantId, "job-two", "second");

      await expect(storage.removeTenant(tenantId)).rejects.toThrow(
        "Invalid tenant id.",
      );
      await expect(fs.readFile(secondTenantFile.absolutePath, "utf8")).resolves.toBe(
        "second",
      );
    },
  );

  it("refuses to recursively remove the working directory", async () => {
    const unsafeStorage = new LocalDiskEvidenceStorage(process.cwd());

    await expect(unsafeStorage.removeTenant("tenant-one")).rejects.toThrow(
      "Refusing to remove an unsafe evidence root directory.",
    );
    await expect(unsafeStorage.removeAll()).rejects.toThrow(
      "Refusing to remove an unsafe evidence root directory.",
    );
  });
});

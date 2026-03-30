import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobEvidencePanel } from "@/components/job/job-evidence-panel";

describe("JobEvidencePanel", () => {
  const onUpload = vi.fn<({ kind, note, file }: { kind: string; note?: string; file: File }) => Promise<void>>();
  const onDelete = vi.fn<(evidenceId: string) => Promise<void>>();
  const onDownload = vi.fn<(evidence: { id: string }) => Promise<void>>();

  beforeEach(() => {
    vi.clearAllMocks();
    onUpload.mockResolvedValue();
    onDelete.mockResolvedValue();
    onDownload.mockResolvedValue();
  });

  it("submits evidence metadata and file", async () => {
    const user = userEvent.setup();

    render(
      <JobEvidencePanel
        items={[]}
        canUpload
        onUpload={onUpload}
        onDelete={onDelete}
        onDownload={onDownload}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Evidence type"), "COMPLETION_PROOF");
    await user.type(screen.getByLabelText("Note"), "Signed off by customer");
    await user.upload(
      screen.getByLabelText("File"),
      new File(["proof"], "completion.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("button", { name: "Add evidence" }));

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith({
        kind: "COMPLETION_PROOF",
        note: "Signed off by customer",
        file: expect.objectContaining({
          name: "completion.pdf",
          type: "application/pdf",
        }),
      });
    });
  });

  it("deletes an evidence item after confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <JobEvidencePanel
        items={[
          {
            id: "evidence-1",
            kind: "SITE_PHOTO",
            fileName: "before.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 2048,
            note: "Before repair",
            createdAt: "2026-03-30T00:00:00.000Z",
            downloadPath: "/jobs/job-1/evidence/evidence-1/download",
            uploadedBy: {
              id: "user-1",
              displayName: "Owner",
              email: "owner@example.com",
            },
          },
        ]}
        canUpload
        onUpload={onUpload}
        onDelete={onDelete}
        onDownload={onDownload}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith("evidence-1");
    });
  });
});

import { expect, test } from "@playwright/test";
import {
  loginAsManager,
  loginAsOwner,
  loginAsStaff,
  logout,
} from "./fixtures/auth";
import { futureDateTimeLocal, uniqueTestValue } from "./fixtures/test-data";

const completionProofPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test.setTimeout(180_000);

test("owner dispatches work, staff completes it, and manager approves it", async ({
  page,
}, testInfo) => {
  const jobTitle = uniqueTestValue("Role workflow", testInfo);
  const serviceAddress = "18 Collins Street, Melbourne VIC 3000";
  const description = "High-value Playwright coverage for the three-role operational loop.";
  const evidenceFileName = `completion-proof-${testInfo.workerIndex}-${testInfo.retry}.png`;
  const evidenceNote = `Completion proof for ${jobTitle}.`;
  const completionNote = `Completed and verified on site for ${jobTitle}.`;

  await test.step("owner creates, assigns, and schedules the job", async () => {
    await loginAsOwner(page);

    await page.getByRole("link", { name: "Jobs", exact: true }).click();
    await page.getByRole("link", { name: "Create job", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Create Job" })).toBeVisible();

    await page.getByLabel("Customer search").fill("Aiden Murphy");
    await page.getByRole("button", { name: "Search Customer" }).click();
    await page
      .getByLabel("Customer", { exact: true })
      .selectOption({ label: "Aiden Murphy" });
    await page.getByPlaceholder("Leaking kitchen tap").fill(jobTitle);
    await page
      .getByPlaceholder("18 Collins Street, Melbourne VIC 3000")
      .fill(serviceAddress);
    await page
      .getByPlaceholder("Describe the issue or requested work")
      .fill(description);
    await page.getByLabel("Start time").fill(futureDateTimeLocal(24));
    await page.getByRole("button", { name: "Create job" }).click();

    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: jobTitle })).toBeVisible();

    await page.getByLabel("Assign to staff search").fill("Sofia Nguyen");
    await page.getByRole("button", { name: "Search Assign to staff" }).click();
    await page
      .getByLabel("Assign to staff", { exact: true })
      .selectOption({ label: "Sofia Nguyen (staff@acme.example)" });
    await page.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByText("Job assigned successfully.")).toBeVisible();

    await page.getByRole("button", { name: "Edit status" }).click();
    await page.getByRole("button", { name: "Mark scheduled" }).click();
    await expect(page.getByText("Job moved to Scheduled.")).toBeVisible();
  });

  await test.step("assigned staff starts work and submits completion evidence", async () => {
    await logout(page);
    await loginAsStaff(page);

    await page.getByRole("link", { name: "My Jobs", exact: true }).click();
    await page.getByPlaceholder("Search my jobs...").fill(jobTitle);
    await page.getByRole("button", { name: "Apply" }).click();
    await page.getByRole("link", { name: jobTitle, exact: true }).click();

    await expect(page.getByRole("heading", { name: jobTitle })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit job" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit status" })).toHaveCount(0);

    await page.getByRole("button", { name: "Start work" }).click();
    await expect(page.getByText("Job moved to In progress.")).toBeVisible();

    await page.getByRole("button", { name: "Upload evidence" }).click();
    await page
      .getByRole("combobox", { name: "Evidence type" })
      .selectOption("COMPLETION_PROOF");
    await page
      .getByRole("textbox", { name: "Note", exact: true })
      .fill(evidenceNote);
    await page.locator('input[type="file"]').setInputFiles({
      name: evidenceFileName,
      mimeType: "image/png",
      buffer: completionProofPng,
    });
    await page.getByRole("button", { name: "Add evidence" }).click();

    await expect(page.getByText("Evidence uploaded successfully.")).toBeVisible();
    await expect(page.getByText(evidenceFileName, { exact: true })).toBeVisible();

    await page.getByLabel("Completion note", { exact: true }).fill(completionNote);
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(
      page.getByText("Completion submitted for review.", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Waiting for review.")).toBeVisible();
  });

  await test.step("manager reviews the handoff and approves completion", async () => {
    await logout(page);
    await loginAsManager(page);

    await page.getByRole("link", { name: "Jobs", exact: true }).click();
    await page.getByPlaceholder("Search jobs...").fill(jobTitle);
    await page.getByRole("button", { name: "Apply" }).click();
    await page.getByRole("link", { name: jobTitle, exact: true }).click();

    await expect(page.getByRole("heading", { name: jobTitle })).toBeVisible();
    await expect(page.getByText(evidenceFileName, { exact: true })).toBeVisible();
    await expect(page.getByText(evidenceNote, { exact: true })).toBeVisible();
    await expect(page.getByText(completionNote, { exact: true })).toBeVisible();
    await expect(page.getByText(/Submitted by Sofia Nguyen/)).toBeVisible();

    await page.getByRole("button", { name: "Approve completion" }).click();

    await expect(page.getByText("Completion approved.").first()).toBeVisible();
    await expect(page.getByText(/Reviewed by Daniel Brooks/)).toBeVisible();
    const activity = page
      .getByRole("heading", { name: "Recent workflow activity" })
      .locator("..")
      .locator("..");
    await expect(
      activity.getByText("Pending review to Completed", { exact: true }),
    ).toBeVisible();
    await expect(activity.getByText(/Daniel Brooks \|/)).toBeVisible();
    await expect(
      activity.getByText("Completion review approved.", { exact: true }),
    ).toBeVisible();
  });
});

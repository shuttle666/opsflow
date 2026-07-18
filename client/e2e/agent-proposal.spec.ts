import { expect, test, type Page, type Request } from "@playwright/test";
import { loginAsOwner } from "./fixtures/auth";
import {
  findJobsByExactTitle,
  requireBearerAuthorization,
} from "./fixtures/api";

const PROPOSAL_READY_TEXT =
  "The proposal is ready for review. Confirm it in a later message or use the Web approval button.";
const UNSUPPORTED_CONFIRMATION_TEXT =
  "This deterministic provider only supports scripted OpsFlow E2E scenarios.";

type ConfirmProposalResponse = {
  success: true;
  data?: {
    proposalId: string;
    createdJobId?: string;
    createdJobTitle?: string;
  };
};

function isAgentMessageRequest(request: Request) {
  return request.method() === "POST" &&
    /\/agent\/conversations\/[^/]+\/messages$/u.test(
      new URL(request.url()).pathname,
    );
}

function isConfirmProposalRequest(request: Request) {
  return request.method() === "POST" &&
    /\/agent\/conversations\/[^/]+\/proposals\/[^/]+\/confirm$/u.test(
      new URL(request.url()).pathname,
    );
}

function createJobCommand(title: string) {
  return `[opsflow-e2e:create-job] ${JSON.stringify({
    customer: "Aiden Murphy",
    title,
    serviceAddress: "18 Collins Street, Melbourne VIC 3000",
  })}`;
}

function uniqueAiJobTitle(
  scenario: "web" | "chat",
  workerIndex: number,
  retry: number,
) {
  const uniqueToken = `${scenario}${workerIndex}${retry}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `E2E ${uniqueToken}`;
}

async function sendAgentMessage(page: Page, content: string) {
  const messageRequest = page.waitForRequest(isAgentMessageRequest);
  const composer = page.getByPlaceholder("Ask the AI Planner...");
  await expect(composer).toBeEditable();
  await composer.fill(content);
  await page.getByRole("button", { name: "Send" }).click();
  return messageRequest;
}

async function openPendingCreateJobProposal(page: Page, title: string) {
  const messageRequest = await sendAgentMessage(page, createJobCommand(title));

  await expect(page.getByText(PROPOSAL_READY_TEXT, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm plan" })).toBeVisible();
  await expect(page.getByPlaceholder("Ask the AI Planner...")).toBeEditable();

  return requireBearerAuthorization(messageRequest);
}

test.describe("safe AI job proposals", () => {
  test.skip(
    process.env.PLAYWRIGHT_FAKE_AI_ENABLED !== "true",
    "The deterministic AI scenarios require the guarded Fake provider.",
  );
  test.describe.configure({ timeout: 120_000 });

  test("requires Web approval and replays confirmation idempotently", async ({
    page,
    request,
  }, testInfo) => {
    const title = uniqueAiJobTitle("web", testInfo.workerIndex, testInfo.retry);

    await loginAsOwner(page);
    await page.goto("/agent");
    await expect(page.getByPlaceholder("Ask the AI Planner...")).toBeVisible();

    const authorization = await openPendingCreateJobProposal(page, title);

    await expect.poll(async () =>
      (await findJobsByExactTitle(request, authorization, title)).length
    ).toBe(0);

    const confirmResponsePromise = page.waitForResponse((response) =>
      isConfirmProposalRequest(response.request())
    );
    await page.getByRole("button", { name: "Confirm plan" }).click();
    const confirmResponse = await confirmResponsePromise;

    expect(confirmResponse.status()).toBe(201);
    const firstConfirmation =
      (await confirmResponse.json()) as ConfirmProposalResponse;
    const firstResult = firstConfirmation.data;
    expect(firstResult).toEqual(expect.objectContaining({
      createdJobTitle: title,
      createdJobId: expect.any(String),
    }));
    if (!firstResult?.createdJobId) {
      throw new Error("Web confirmation did not return the created Job ID.");
    }
    await expect(page.getByRole("link", { name: "Open job" })).toBeVisible();

    const confirmRequest = confirmResponse.request();
    const replayResponse = await request.post(confirmRequest.url(), {
      headers: {
        Authorization: requireBearerAuthorization(confirmRequest),
      },
    });
    expect(replayResponse.status()).toBe(201);
    const replayedConfirmation =
      (await replayResponse.json()) as ConfirmProposalResponse;
    expect(replayedConfirmation.data).toEqual(expect.objectContaining({
      proposalId: firstResult.proposalId,
      createdJobId: firstResult.createdJobId,
      createdJobTitle: title,
    }));

    await expect.poll(async () =>
      (await findJobsByExactTitle(request, authorization, title)).map(
        (job) => job.id,
      )
    ).toEqual([firstResult.createdJobId]);
  });

  test("rejects a confirmation question and executes an explicit confirmation once", async ({
    page,
    request,
  }, testInfo) => {
    const title = uniqueAiJobTitle("chat", testInfo.workerIndex, testInfo.retry);

    await loginAsOwner(page);
    await page.goto("/agent");
    await expect(page.getByPlaceholder("Ask the AI Planner...")).toBeVisible();

    const authorization = await openPendingCreateJobProposal(page, title);

    await sendAgentMessage(page, "Confirm?");
    await expect(
      page.getByText(UNSUPPORTED_CONFIRMATION_TEXT, { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm plan" })).toBeVisible();
    await expect.poll(async () =>
      (await findJobsByExactTitle(request, authorization, title)).length
    ).toBe(0);

    await sendAgentMessage(page, "Confirm!");
    await expect(
      page.getByText("The proposal was executed successfully.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Open job" })).toBeVisible();

    await expect.poll(async () =>
      (await findJobsByExactTitle(request, authorization, title)).length
    ).toBe(1);
    const [createdJob] = await findJobsByExactTitle(
      request,
      authorization,
      title,
    );
    if (!createdJob) {
      throw new Error("Conversational confirmation did not create a Job.");
    }

    await sendAgentMessage(page, "Confirm!");
    await expect(
      page.getByText("The proposal was already executed.", { exact: true }),
    ).toBeVisible();
    await expect.poll(async () =>
      (await findJobsByExactTitle(request, authorization, title)).map(
        (job) => job.id,
      )
    ).toEqual([createdJob.id]);
  });
});

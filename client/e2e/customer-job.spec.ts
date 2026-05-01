import { expect, test } from "@playwright/test";
import { loginAsOwner } from "./fixtures/auth";
import { futureDateTimeLocal, uniqueTestValue } from "./fixtures/test-data";

test("owner can create a customer and a job for that customer", async ({
  page,
}, testInfo) => {
  const customerName = uniqueTestValue("Customer", testInfo);
  const customerPhone = "0412 000 001";
  const customerEmail = `${customerName.toLowerCase().replaceAll(/[^a-z0-9]+/g, ".")}@example.com`;
  const jobTitle = uniqueTestValue("Job", testInfo);
  const serviceAddress = "18 Collins Street, Melbourne VIC 3000";
  const description = "Created by Playwright E2E smoke coverage.";

  await loginAsOwner(page);

  await page.getByRole("link", { name: "Customers" }).click();
  await page.getByRole("link", { name: "Add Customer" }).click();
  await expect(page.getByRole("heading", { name: "Create Customer" })).toBeVisible();
  await page.getByPlaceholder("Noah Thompson").fill(customerName);
  await page.getByPlaceholder("0412 000 001").fill(customerPhone);
  await page.getByPlaceholder("noah@example.com").fill(customerEmail);
  await page.getByRole("button", { name: "Create customer" }).click();

  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: customerName })).toBeVisible();
  await expect(page.getByText(customerEmail, { exact: true })).toBeVisible();
  await expect(page.getByText(customerPhone, { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Create job" }).click();
  await expect(page.getByRole("heading", { name: "Create Job" })).toBeVisible();
  await expect(page.getByLabel("Customer")).toHaveValue(/.+/);
  await page.getByPlaceholder("Leaking kitchen tap").fill(jobTitle);
  await page.getByPlaceholder("18 Collins Street, Melbourne VIC 3000").fill(serviceAddress);
  await page
    .getByPlaceholder("Describe the issue or requested work")
    .fill(description);
  await page.getByLabel("Start time").fill(futureDateTimeLocal(24));
  await page.getByRole("button", { name: "Create job" }).click();

  await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: jobTitle })).toBeVisible();
  await expect(page.getByText(customerName).first()).toBeVisible();
  await expect(page.getByText(serviceAddress)).toBeVisible();
  await expect(page.getByText(description)).toBeVisible();
});

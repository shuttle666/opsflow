import { expect, type Page } from "@playwright/test";

export async function loginAsOwner(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@acme.example");
  await page.getByLabel("Password").fill("owner-password-123");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

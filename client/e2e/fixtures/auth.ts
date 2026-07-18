import { expect, type Page } from "@playwright/test";

const demoAccounts = {
  owner: {
    email: "owner@acme.example",
    password: "owner-password-123",
  },
  manager: {
    email: "manager@acme.example",
    password: "manager-password-123",
  },
  staff: {
    email: "staff@acme.example",
    password: "staff-password-123",
  },
} as const;

export type DemoAccount = keyof typeof demoAccounts;

export async function loginAs(page: Page, account: DemoAccount) {
  const credentials = demoAccounts[account];

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const emailInput = page.getByLabel("Email");
  const passwordInput = page.getByLabel("Password");
  await passwordInput.fill(credentials.password);
  await emailInput.fill(credentials.email);
  await expect(emailInput).toHaveValue(credentials.email);
  await expect(passwordInput).toHaveValue(credentials.password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function loginAsOwner(page: Page) {
  await loginAs(page, "owner");
}

export async function loginAsManager(page: Page) {
  await loginAs(page, "manager");
}

export async function loginAsStaff(page: Page) {
  await loginAs(page, "staff");
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

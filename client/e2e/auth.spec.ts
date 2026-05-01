import { test } from "@playwright/test";
import { loginAsOwner } from "./fixtures/auth";

test("owner demo account can sign in", async ({ page }) => {
  await loginAsOwner(page);
});

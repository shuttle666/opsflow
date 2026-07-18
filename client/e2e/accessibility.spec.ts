import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page, type TestInfo } from "@playwright/test";
import { loginAsOwner } from "./fixtures/auth";

test.use({ ...devices["Pixel 7"] });

async function expectNoHighImpactViolations(
  page: Page,
  testInfo: TestInfo,
  surface: string,
) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const violations = results.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );

  await testInfo.attach(`axe-${surface}.json`, {
    body: Buffer.from(JSON.stringify(results, null, 2)),
    contentType: "application/json",
  });

  const summary = violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map((node) => node.target),
  }));

  expect(summary, `${surface} has serious or critical axe violations`).toEqual([]);
}

test("representative surfaces pass mobile accessibility smoke checks", async ({
  page,
}, testInfo) => {
  await test.step("public landing page", async () => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "AI prepares the plan. People approve the change.",
      }),
    ).toBeVisible();
    await expectNoHighImpactViolations(page, testInfo, "landing-mobile");
  });

  await test.step("sign-in page", async () => {
    await page.goto("/login");
    await expect(page.getByRole("form", { name: "Sign in" })).toBeVisible();
    await expectNoHighImpactViolations(page, testInfo, "login-mobile");
  });

  await test.step("authenticated dashboard", async () => {
    await loginAsOwner(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText(/^Last updated /)).toBeVisible();
    await expectNoHighImpactViolations(page, testInfo, "dashboard-mobile");
  });
});

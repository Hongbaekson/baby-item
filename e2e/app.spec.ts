import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("opens and closes product details with the keyboard", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "말랑하니 백색소음기 상세 보기",
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/item=/);
  await expect(
    page.getByRole("button", { name: "상품 상세 닫기" }),
  ).toBeFocused();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: /구매처에서 최신가 확인/ })
      .first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).not.toHaveURL(/item=/);
});

test("saves a favorite and filters to the saved list", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "말랑하니 백색소음기 찜하기" })
    .click();
  await page.getByRole("button", { name: /내 찜 1/ }).click();
  await expect(
    page.getByRole("heading", { name: "1개의 육아템" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /내 찜 1/ })).toBeVisible();
});

test("shows products in smaller pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("article")).toHaveCount(9);
  await page.getByRole("button", { name: /육아템 더 보기/ }).click();
  await expect(page.getByRole("article")).toHaveCount(18);
});

test.describe("mobile layout", () => {
  test.skip(({ isMobile }) => !isMobile, "Mobile viewport only");

  test("uses a single horizontally scrollable category row", async ({
    page,
  }) => {
    await page.goto("/");
    const row = page.getByLabel("카테고리 필터", { exact: true });
    await expect(row).toHaveCSS("flex-wrap", "nowrap");
    const sizes = await row.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(sizes.scrollWidth).toBeGreaterThan(sizes.clientWidth);

    const card = page.getByRole("article").first();
    await expect(card).not.toHaveCSS("grid-template-columns", "none");
  });
});

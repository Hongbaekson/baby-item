import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "판매 정보 운영 상태" }),
  ).toContainText("판매 근거 확인 29/31");
  await expect(
    page.getByRole("heading", {
      name: "가격보다 판매 페이지를 먼저 확인합니다",
    }),
  ).toBeVisible();
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
      .getByRole("link", { name: /네이버에서 판매 상품 찾기/ })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: /링크·상품 정보 오류 신고/ }),
  ).toHaveAttribute("href", /github\.com\/Hongbaekson\/baby-item\/issues\/new/);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "공유" }),
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
  const products = page
    .getByRole("region", { name: "제품 목록" })
    .getByRole("article");
  await expect(products).toHaveCount(9);
  await page.getByRole("button", { name: /육아템 더 보기/ }).click();
  await expect(products).toHaveCount(18);
});

test("publishes no Coupang purchase links and hides unverified CTAs", async ({
  page,
}) => {
  await page.goto("/");
  const coupangLinks = await page.locator('a[href*="coupang.com"]').count();
  expect(coupangLinks).toBe(0);

  await page
    .getByRole("searchbox", { name: "제품명 또는 카테고리 검색" })
    .fill("젖병 소독 냄비");
  const card = page
    .getByRole("region", { name: "제품 목록" })
    .getByRole("article");
  await expect(card.getByText("현재 판매 링크 확인 중")).toBeVisible();
  await expect(card.getByRole("link")).toHaveCount(0);
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

    const card = page
      .getByRole("region", { name: "제품 목록" })
      .getByRole("article")
      .first();
    await expect(card).not.toHaveCSS("grid-template-columns", "none");
  });
});

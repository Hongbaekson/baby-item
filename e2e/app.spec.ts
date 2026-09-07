import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const appData = JSON.parse(
  readFileSync(new URL("../src/data/items.json", import.meta.url), "utf8"),
);
const offerPolicy = JSON.parse(
  readFileSync(new URL("../config/offer-policy.json", import.meta.url), "utf8"),
);
const freshnessMs = offerPolicy.purchaseLinkFreshnessHours * 60 * 60 * 1_000;
const hasCurrentPurchaseLink = (item: (typeof appData.items)[number]) =>
  item.purchaseLink.status === "verified" &&
  item.purchaseLink.url &&
  Date.now() - Date.parse(item.purchaseLink.checkedAt) <= freshnessMs;
const verifiedItems = appData.items.filter(hasCurrentPurchaseLink);
const unavailableItem = appData.items.find(
  (item: (typeof appData.items)[number]) => !hasCurrentPurchaseLink(item),
);

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('meta[name="catalog-checked-at"]')).toHaveAttribute(
    "content",
    appData.purchaseLinkPolicy.checkedAt,
  );
  await expect(page.locator('meta[name="catalog-items"]')).toHaveAttribute(
    "content",
    String(appData.items.length),
  );
  await expect(
    page.getByRole("region", { name: "판매 정보 운영 상태" }),
  ).toContainText(
    `공식몰 확인 ${verifiedItems.length}/${appData.items.length}`,
  );
  await expect(
    page.getByRole("heading", {
      name: "상품 검색과 공식 판매처를 구분합니다",
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

test("publishes product search without presenting it as verified sales", async ({
  page,
}) => {
  test.skip(
    !unavailableItem,
    "Every item currently has verified sales evidence",
  );
  if (!unavailableItem) return;

  await page.goto("/");
  const coupangLinks = await page.locator('a[href*="coupang.com"]').count();
  expect(coupangLinks).toBe(0);

  await page
    .getByRole("searchbox", { name: "제품명 또는 카테고리 검색" })
    .fill(unavailableItem.title);
  const card = page
    .getByRole("region", { name: "제품 목록" })
    .getByRole("article");
  await expect(
    card.getByText("상품명으로 검색 · 가격·재고는 판매처 확인"),
  ).toBeVisible();
  const link = card.getByRole("link");
  await expect(link).toContainText("네이버에서 상품 검색");
  const href = await link.getAttribute("href");
  expect(new URL(href!).searchParams.get("query")).toBe(
    unavailableItem.searchQuery,
  );
  await card.getByRole("button", { name: /상세 보기$/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".best-offer-panel")).toHaveAttribute(
    "href",
    href!,
  );
  await expect(dialog.locator(".modal-mobile-cta")).toHaveAttribute(
    "href",
    href!,
  );
});

test("finds a specific model with reordered words and different spacing", async ({
  page,
}) => {
  await page.goto("/?q=6525+브라운");
  await expect(
    page.getByRole("heading", { name: "1개의 육아템" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "브라운 귀체온계 IRT-6525" }),
  ).toBeVisible();
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

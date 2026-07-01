import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const QUALITY_INPUT_PATH = path.join("data", "items.quality.json");
const APP_DATA_OUTPUT_PATH = path.join("src", "data", "items.json");
const DATA_REPORT_OUTPUT_PATH = path.join("data", "data-quality-report.json");

const CATEGORY_PLACEHOLDERS = new Map([
  ["👶300일간 매일 사용한 육아템 정리", "top-used"],
  ["💤수면 아이템", "sleep"],
  ["😎외출 아이템", "outing"],
  ["🍼젖병 열탕 소독", "sterilize"],
  ["🍼수유아이템", "feeding"],
  ["💩신생아 배앓이 꿀템", "colic"],
  ["🎉놀이아이템", "play"],
  ["💩배변아이템", "diaper"],
  ["👶거실매트", "mat"],
  ["🧑‍🍼손목&허리보호대(양육자를 위한 아이템)", "caregiver"],
]);

function getDisplayPrice(item) {
  if (item.price === null) {
    return "가격 확인 필요";
  }

  return `${item.price.toLocaleString("ko-KR")}원`;
}

function getImagePath(item) {
  const placeholderSlug = CATEGORY_PLACEHOLDERS.get(item.primaryCategory) ?? "default";

  return `/images/placeholders/${placeholderSlug}.svg`;
}

function toAppItem(item) {
  return {
    id: item.id,
    title: item.title,
    categories: item.categories,
    primaryCategory: item.primaryCategory,
    partnerLink: item.partnerLink,
    partnerLinks: item.partnerLinks.map((link) => ({
      url: link.url,
      category: link.category,
      sourceItemId: link.sourceItemId,
    })),
    price: item.price,
    priceText: item.priceText,
    displayPrice: getDisplayPrice(item),
    memo: item.memo,
    imagePath: getImagePath(item),
    hasOriginalImage: item.image?.hasImage ?? false,
    placeholderKey: CATEGORY_PLACEHOLDERS.get(item.primaryCategory) ?? "default",
    dataQuality: {
      status: item.dataQuality.status,
      errorCount: item.dataQuality.errorCount,
      warningCount: item.dataQuality.warningCount,
      issues: item.dataQuality.issues.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
      })),
    },
    sourceItemIds: item.sourceItemIds,
  };
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    const qualityRank = {
      ready: 0,
      usable_with_warnings: 1,
      needs_review: 2,
      draft: 3,
    };

    const qualityDiff =
      (qualityRank[a.dataQuality.status] ?? 99) - (qualityRank[b.dataQuality.status] ?? 99);

    if (qualityDiff !== 0) {
      return qualityDiff;
    }

    return a.title.localeCompare(b.title, "ko-KR");
  });
}

function buildCategoryStats(items, categories) {
  return categories.map((category) => ({
    name: category,
    count: items.filter((item) => item.categories.includes(category)).length,
  }));
}

async function main() {
  const quality = JSON.parse(await readFile(QUALITY_INPUT_PATH, "utf8"));
  const appItems = sortItems(
    quality.items
      .filter((item) => item.publicationStatus === "published")
      .map(toAppItem),
  );
  const categoryStats = buildCategoryStats(appItems, quality.categories);

  const appData = {
    generatedAt: new Date().toISOString(),
    site: {
      name: "이은이 육아템",
      affiliateDisclosure:
        "이 페이지의 일부 링크는 제휴 링크이며, 구매 시 일정액의 수수료를 제공받을 수 있습니다.",
    },
    summary: {
      totalItems: appItems.length,
      categories: categoryStats,
      readyItems: appItems.filter((item) => item.dataQuality.status === "ready").length,
      usableWithWarningsItems: appItems.filter(
        (item) => item.dataQuality.status === "usable_with_warnings",
      ).length,
      needsReviewItems: appItems.filter((item) => item.dataQuality.status === "needs_review")
        .length,
    },
    items: appItems,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    source: QUALITY_INPUT_PATH,
    summary: quality.summary.dataQuality,
    needsReviewItems: quality.items
      .filter((item) => item.dataQuality.status === "needs_review")
      .map((item) => ({
        id: item.id,
        title: item.title,
        issues: item.dataQuality.issues,
      })),
    draftItems: quality.draftItems.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      draftReasons: item.draftReasons,
      issues: item.dataQuality.issues,
    })),
  };

  await mkdir(path.dirname(APP_DATA_OUTPUT_PATH), { recursive: true });
  await writeFile(APP_DATA_OUTPUT_PATH, `${JSON.stringify(appData, null, 2)}\n`, "utf8");
  await writeFile(DATA_REPORT_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Wrote ${APP_DATA_OUTPUT_PATH}`);
  console.log(`Wrote ${DATA_REPORT_OUTPUT_PATH}`);
  console.log(JSON.stringify(appData.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isShortUrl } from "./lib/offer-policy.mjs";

const QUALITY_INPUT_PATH = path.join("data", "items.quality.json");
const APP_DATA_OUTPUT_PATH = path.join("src", "data", "items.json");
const DATA_REPORT_OUTPUT_PATH = path.join("data", "data-quality-report.json");
const SITE_NAME = "이은이 아빠가 준비하는 육아템";
const PRICE_CTA = "구매처에서 최신가 확인";
const DEFAULT_OFFER_STATUS = {
  state: "not_synced",
  syncedAt: null,
  checkedOffers: 0,
};

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
  return PRICE_CTA;
}

function getReferencePrice(item) {
  if (item.price === null) {
    return null;
  }

  return `기록가 ${item.price.toLocaleString("ko-KR")}원`;
}

function findFirstHttpsUrl(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value.startsWith("https://") ? value : null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = findFirstHttpsUrl(entry);

      if (url) {
        return url;
      }
    }

    return null;
  }

  if (typeof value === "object") {
    for (const entry of Object.values(value)) {
      const url = findFirstHttpsUrl(entry);

      if (url) {
        return url;
      }
    }
  }

  return null;
}

function getRemoteImageUrl(item) {
  return (
    findFirstHttpsUrl(item.image?.filePropertyRaw) ??
    findFirstHttpsUrl(item.image?.socialMediaImagePreviewUrl)
  );
}

function getImagePath(item) {
  const remoteImageUrl = getRemoteImageUrl(item);

  if (remoteImageUrl) {
    return remoteImageUrl;
  }

  const placeholderSlug =
    CATEGORY_PLACEHOLDERS.get(item.primaryCategory) ?? "default";

  return `/images/placeholders/${placeholderSlug}.svg`;
}

function shouldPreserveDirectLink(item, previousItem) {
  return Boolean(
    previousItem?.partnerLink &&
    !isShortUrl(previousItem.partnerLink) &&
    isShortUrl(item.partnerLink),
  );
}

function toAppItem(item, previousItem) {
  const preserveDirectLink = shouldPreserveDirectLink(item, previousItem);
  const partnerLink = preserveDirectLink
    ? previousItem.partnerLink
    : item.partnerLink;
  const partnerLinks = item.partnerLinks.map((link) => {
    const previousLink = previousItem?.partnerLinks?.find(
      (candidate) => candidate.sourceItemId === link.sourceItemId,
    );

    return {
      url:
        previousLink && !isShortUrl(previousLink.url) && isShortUrl(link.url)
          ? previousLink.url
          : link.url,
      category: link.category,
      sourceItemId: link.sourceItemId,
    };
  });
  const syncedImage =
    previousItem?.imageSource?.imageUrl ??
    previousItem?.bestOffer?.imageUrl ??
    null;

  return {
    id: item.id,
    title: item.title,
    categories: item.categories,
    primaryCategory: item.primaryCategory,
    partnerLink,
    partnerLinks,
    price: item.price,
    priceText: item.priceText,
    displayPrice: previousItem?.displayPrice ?? getDisplayPrice(item),
    referencePrice: getReferencePrice(item),
    bestOffer: previousItem?.bestOffer ?? null,
    purchaseOffers: previousItem?.purchaseOffers ?? [],
    candidateOffers: previousItem?.candidateOffers ?? [],
    rejectedOffers: previousItem?.rejectedOffers ?? [],
    offerStatus: previousItem?.offerStatus ?? { ...DEFAULT_OFFER_STATUS },
    memo: item.memo,
    imagePath: syncedImage ?? getImagePath(item),
    hasOriginalImage: Boolean(syncedImage ?? getRemoteImageUrl(item)),
    placeholderKey:
      CATEGORY_PLACEHOLDERS.get(item.primaryCategory) ?? "default",
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
    ...(previousItem?.imageSource
      ? { imageSource: previousItem.imageSource }
      : {}),
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
      (qualityRank[a.dataQuality.status] ?? 99) -
      (qualityRank[b.dataQuality.status] ?? 99);

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
  const previousAppData = await readFile(APP_DATA_OUTPUT_PATH, "utf8")
    .then((content) => JSON.parse(content))
    .catch(() => ({ items: [] }));
  const previousItemsById = new Map(
    (previousAppData.items ?? []).map((item) => [item.id, item]),
  );
  const appItems = sortItems(
    quality.items
      .filter((item) => item.publicationStatus === "published")
      .map((item) => toAppItem(item, previousItemsById.get(item.id))),
  );
  const categoryStats = buildCategoryStats(appItems, quality.categories);

  const appData = {
    generatedAt: new Date().toISOString(),
    site: {
      name: SITE_NAME,
    },
    summary: {
      totalItems: appItems.length,
      categories: categoryStats,
      readyItems: appItems.filter((item) => item.dataQuality.status === "ready")
        .length,
      usableWithWarningsItems: appItems.filter(
        (item) => item.dataQuality.status === "usable_with_warnings",
      ).length,
      needsReviewItems: appItems.filter(
        (item) => item.dataQuality.status === "needs_review",
      ).length,
    },
    items: appItems,
    ...(previousAppData.offerPolicy
      ? { offerPolicy: previousAppData.offerPolicy }
      : {}),
    ...(previousAppData.offerSync
      ? { offerSync: previousAppData.offerSync }
      : {}),
    ...(previousAppData.imageSync
      ? { imageSync: previousAppData.imageSync }
      : {}),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    source: QUALITY_INPUT_PATH,
    summary: {
      ...appData.summary,
      draftItems: quality.draftItems.length,
      issueCounts: appItems.reduce((counts, item) => {
        for (const issue of item.dataQuality.issues) {
          counts[issue.code] = (counts[issue.code] ?? 0) + 1;
        }
        return counts;
      }, {}),
      verifiedOffers: appItems.reduce(
        (sum, item) => sum + (item.purchaseOffers?.length ?? 0),
        0,
      ),
      candidateOffers: appItems.reduce(
        (sum, item) => sum + (item.candidateOffers?.length ?? 0),
        0,
      ),
      rejectedOffers: appItems.reduce(
        (sum, item) => sum + (item.rejectedOffers?.length ?? 0),
        0,
      ),
    },
    needsReviewItems: appItems
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
  await writeFile(
    APP_DATA_OUTPUT_PATH,
    `${JSON.stringify(appData, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    DATA_REPORT_OUTPUT_PATH,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  console.log(`Wrote ${APP_DATA_OUTPUT_PATH}`);
  console.log(`Wrote ${DATA_REPORT_OUTPUT_PATH}`);
  console.log(JSON.stringify(appData.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

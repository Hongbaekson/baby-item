import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  collectOfferReviewFlags,
  isFreshOffer,
  isShortUrl,
  isTrustedPurchaseUrl,
  isVerifiedOffer,
  sortOffersByEffectivePrice,
} from "./lib/offer-policy.mjs";

const APP_DATA_PATH = path.join("src", "data", "items.json");
const DIRECT_LINK_REPLACEMENTS = new Map([
  [
    "item-95739902b6",
    "https://malanghoney.com/product/detail.html?product_no=648&cate_no=271&display_group=1",
  ],
  ["item-8e7ce75a58", "https://search.shopping.naver.com/catalog/41067307356"],
  [
    "item-e9d15fbf7f",
    "https://www.whittlestore.com/views/shop/shopview?pack_content_id=5926",
  ],
]);

function addReviewFlags(item, offer) {
  return {
    ...offer,
    reviewFlags: collectOfferReviewFlags(item.title, offer),
  };
}

function dedupeByUrl(offers) {
  const byUrl = new Map();

  for (const offer of offers) {
    if (!byUrl.has(offer.url)) {
      byUrl.set(offer.url, offer);
    }
  }

  return [...byUrl.values()];
}

function migrateLinks(item) {
  const replacement = DIRECT_LINK_REPLACEMENTS.get(item.id);

  if (!replacement) {
    return item;
  }

  return {
    ...item,
    partnerLink: replacement,
    partnerLinks: (item.partnerLinks ?? []).map((link) =>
      isShortUrl(link.url) ? { ...link, url: replacement } : link,
    ),
  };
}

function migrateItem(rawItem) {
  const item = migrateLinks(rawItem);
  const sourceOffers = dedupeByUrl([
    ...(item.purchaseOffers ?? []),
    ...(item.candidateOffers ?? []),
    ...(item.rejectedOffers ?? []),
    ...(item.bestOffer ? [item.bestOffer] : []),
  ]).map((offer) => addReviewFlags(item, offer));
  const rejectedOffers = sourceOffers.filter(
    (offer) =>
      !isTrustedPurchaseUrl(offer.url) || (offer.reviewFlags?.length ?? 0) > 0,
  );
  const acceptedOffers = sourceOffers.filter(
    (offer) =>
      isTrustedPurchaseUrl(offer.url) && (offer.reviewFlags?.length ?? 0) === 0,
  );
  const verifiedOffers = sortOffersByEffectivePrice(
    acceptedOffers.filter(isVerifiedOffer),
  );
  const candidateOffers = sortOffersByEffectivePrice(
    acceptedOffers.filter((offer) => !isVerifiedOffer(offer)),
  );
  const bestOffer = verifiedOffers[0] ?? null;
  const hasFreshVerified = bestOffer ? isFreshOffer(bestOffer) : false;
  const state = bestOffer
    ? hasFreshVerified
      ? "available"
      : "stale"
    : candidateOffers.length > 0
      ? "candidates_available"
      : rejectedOffers.length > 0
        ? "needs_review"
        : "no_available_offer";
  const preferredImageOffer = verifiedOffers[0] ?? candidateOffers[0] ?? null;

  return {
    ...item,
    displayPrice:
      state === "available" && bestOffer
        ? `최저가 ${bestOffer.totalPrice.toLocaleString("ko-KR")}원`
        : candidateOffers.length > 0
          ? "구매처에서 최신가 확인"
          : "가격 정보 확인 중",
    bestOffer,
    purchaseOffers: verifiedOffers,
    candidateOffers,
    rejectedOffers,
    offerStatus: {
      ...item.offerStatus,
      state,
      syncedAt:
        bestOffer?.syncedAt ??
        candidateOffers[0]?.syncedAt ??
        rejectedOffers[0]?.syncedAt ??
        item.offerStatus?.syncedAt ??
        null,
      checkedOffers: sourceOffers.length,
    },
    imagePath: preferredImageOffer?.imageUrl ?? item.imagePath,
    imageSource: preferredImageOffer?.imageUrl
      ? {
          imageUrl: preferredImageOffer.imageUrl,
          matchConfidence: preferredImageOffer.matchConfidence,
          platform: preferredImageOffer.platform,
          mallName: preferredImageOffer.mallName,
          productName: preferredImageOffer.productName,
          source: preferredImageOffer.source,
          syncedAt: preferredImageOffer.syncedAt,
        }
      : item.imageSource,
  };
}

const appData = JSON.parse(await readFile(APP_DATA_PATH, "utf8"));
appData.items = (appData.items ?? []).map(migrateItem);
appData.summary = {
  ...appData.summary,
  totalItems: appData.items.length,
  readyItems: appData.items.filter(
    (item) => item.dataQuality?.status === "ready",
  ).length,
  usableWithWarningsItems: appData.items.filter(
    (item) => item.dataQuality?.status === "usable_with_warnings",
  ).length,
  needsReviewItems: appData.items.filter(
    (item) => item.dataQuality?.status === "needs_review",
  ).length,
};
appData.offerPolicy = {
  migratedAt: new Date().toISOString(),
  freshnessHours: 48,
  verifiedOffers: appData.items.reduce(
    (sum, item) => sum + (item.purchaseOffers?.length ?? 0),
    0,
  ),
  candidateOffers: appData.items.reduce(
    (sum, item) => sum + (item.candidateOffers?.length ?? 0),
    0,
  ),
  rejectedOffers: appData.items.reduce(
    (sum, item) => sum + (item.rejectedOffers?.length ?? 0),
    0,
  ),
};

await writeFile(APP_DATA_PATH, `${JSON.stringify(appData, null, 2)}\n`, "utf8");
console.log(JSON.stringify(appData.offerPolicy, null, 2));

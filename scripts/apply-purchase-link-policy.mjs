import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  isBlockedPurchaseUrl,
  isCurrentPurchaseEvidence,
  isFreshOffer,
  isTrustedPurchaseUrl,
  offerPolicy,
  sortOffersByEffectivePrice,
} from "./lib/offer-policy.mjs";

const APP_DATA_PATH = path.join("src", "data", "items.json");
const OFFICIAL_LINKS_PATH = path.join("config", "official-purchase-links.json");

function isCoupangEntry(entry) {
  return Boolean(
    entry &&
    (isBlockedPurchaseUrl(entry.url) ||
      /coupang|쿠팡/i.test(`${entry.platform ?? ""} ${entry.mallName ?? ""}`)),
  );
}

function withoutCoupang(entries = []) {
  return entries.filter((entry) => !isCoupangEntry(entry));
}

function validEvidenceOffers(item) {
  return [...(item.purchaseOffers ?? []), ...(item.candidateOffers ?? [])]
    .filter(
      (offer) =>
        !isCoupangEntry(offer) &&
        offer.platform === "naver" &&
        isTrustedPurchaseUrl(offer.url) &&
        (offer.reviewFlags?.length ?? 0) === 0 &&
        isCurrentPurchaseEvidence(offer.syncedAt),
    )
    .sort((a, b) => Date.parse(b.syncedAt) - Date.parse(a.syncedAt));
}

function createNaverSearchUrl(title) {
  const url = new URL("https://search.shopping.naver.com/search/all");
  url.searchParams.set("query", String(title).replace(/\s+/g, " ").trim());
  return url.toString();
}

function offerStatusFor(item) {
  if (item.bestOffer) {
    return isFreshOffer(item.bestOffer) ? "available" : "stale";
  }
  if (item.candidateOffers.length > 0) return "candidates_available";
  if (item.rejectedOffers.length > 0) return "needs_review";
  return "no_available_offer";
}

function latestOfferTimestamp(item) {
  return [
    ...(item.purchaseOffers ?? []),
    ...(item.candidateOffers ?? []),
    ...(item.rejectedOffers ?? []),
  ]
    .map((offer) => offer.syncedAt)
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

function applyPurchaseQuality(item, hasVerifiedLink) {
  const issues = (item.dataQuality?.issues ?? []).filter(
    (issue) =>
      ![
        "missing_partner_link",
        "invalid_partner_link",
        "no_verified_purchase_link",
      ].includes(issue.code),
  );

  if (!hasVerifiedLink) {
    issues.push({
      code: "no_verified_purchase_link",
      severity: "warning",
      message: "최근 판매 근거를 확인하지 못해 구매 링크를 공개하지 않습니다.",
    });
  }

  const errorCount = issues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;
  const infoCount = issues.filter((issue) => issue.severity === "info").length;
  const status =
    item.dataQuality?.status === "draft"
      ? "draft"
      : errorCount > 0
        ? "needs_review"
        : warningCount > 0
          ? "usable_with_warnings"
          : "ready";

  return { status, errorCount, warningCount, infoCount, issues };
}

function applyToItem(item, officialLinks) {
  const purchaseOffers = withoutCoupang(item.purchaseOffers);
  const candidateOffers = withoutCoupang(item.candidateOffers);
  const rejectedOffers = withoutCoupang(item.rejectedOffers);
  const bestOffer = sortOffersByEffectivePrice(purchaseOffers)[0] ?? null;
  const filteredItem = {
    ...item,
    bestOffer,
    purchaseOffers,
    candidateOffers,
    rejectedOffers,
  };
  const official = officialLinks.get(item.id);
  const evidence = validEvidenceOffers(filteredItem)[0];
  const currentOfficial =
    official &&
    !isBlockedPurchaseUrl(official.url) &&
    isTrustedPurchaseUrl(official.url) &&
    isCurrentPurchaseEvidence(official.checkedAt)
      ? official
      : null;
  const purchaseLink = currentOfficial
    ? {
        status: "verified",
        kind: "official",
        url: currentOfficial.url,
        checkedAt: currentOfficial.checkedAt,
        source: currentOfficial.source,
      }
    : evidence
      ? {
          status: "verified",
          kind: "naver_search",
          url: createNaverSearchUrl(item.title),
          checkedAt: evidence.syncedAt,
          source: evidence.source,
        }
      : {
          status: "unavailable",
          kind: "none",
          url: null,
          checkedAt: null,
          source: "no-current-non-coupang-evidence",
        };
  const hasVerifiedLink = purchaseLink.status === "verified";
  const next = {
    ...filteredItem,
    partnerLink: purchaseLink.url ?? "",
    partnerLinks: purchaseLink.url
      ? [
          {
            url: purchaseLink.url,
            category: item.primaryCategory,
            sourceItemId: `purchase-policy:${item.id}`,
          },
        ]
      : [],
    purchaseLink,
    dataQuality: applyPurchaseQuality(item, hasVerifiedLink),
  };
  const syncedAt = latestOfferTimestamp(next);

  return {
    ...next,
    offerStatus: {
      state: offerStatusFor(next),
      syncedAt: syncedAt ?? null,
      checkedOffers:
        next.purchaseOffers.length +
        next.candidateOffers.length +
        next.rejectedOffers.length,
    },
  };
}

function summarize(items) {
  return {
    totalItems: items.length,
    verifiedPurchaseLinks: items.filter(
      (item) => item.purchaseLink.status === "verified",
    ).length,
    hiddenPurchaseLinks: items.filter(
      (item) => item.purchaseLink.status !== "verified",
    ).length,
    naverSearchLinks: items.filter(
      (item) => item.purchaseLink.kind === "naver_search",
    ).length,
    officialLinks: items.filter((item) => item.purchaseLink.kind === "official")
      .length,
    remainingBlockedPurchaseEntries: items.reduce(
      (count, item) =>
        count +
        [
          ...(item.partnerLinks ?? []),
          ...(item.purchaseOffers ?? []),
          ...(item.candidateOffers ?? []),
          ...(item.rejectedOffers ?? []),
        ].filter(isCoupangEntry).length,
      0,
    ),
  };
}

async function main() {
  const [data, officialConfig] = await Promise.all([
    readFile(APP_DATA_PATH, "utf8").then(JSON.parse),
    readFile(OFFICIAL_LINKS_PATH, "utf8").then(JSON.parse),
  ]);
  const officialLinks = new Map(
    officialConfig.links.map((entry) => [entry.itemId, entry]),
  );
  const beforeCoupangCount = data.items.reduce(
    (sum, item) =>
      sum +
      [
        ...(item.purchaseOffers ?? []),
        ...(item.candidateOffers ?? []),
        ...(item.rejectedOffers ?? []),
      ].filter(isCoupangEntry).length,
    0,
  );
  const items = data.items.map((item) => applyToItem(item, officialLinks));
  const linkSummary = summarize(items);
  const summary = {
    ...data.summary,
    readyItems: items.filter((item) => item.dataQuality.status === "ready")
      .length,
    usableWithWarningsItems: items.filter(
      (item) => item.dataQuality.status === "usable_with_warnings",
    ).length,
    needsReviewItems: items.filter(
      (item) => item.dataQuality.status === "needs_review",
    ).length,
  };
  const appliedOfferPolicy = {
    ...data.offerPolicy,
    freshnessHours: offerPolicy.freshnessHours,
    purchaseLinkFreshnessHours: offerPolicy.purchaseLinkFreshnessHours,
    blockedPurchaseHosts: offerPolicy.blockedPurchaseHosts,
    verifiedOffers: items.reduce(
      (count, item) => count + item.purchaseOffers.length,
      0,
    ),
    candidateOffers: items.reduce(
      (count, item) => count + item.candidateOffers.length,
      0,
    ),
    rejectedOffers: items.reduce(
      (count, item) => count + item.rejectedOffers.length,
      0,
    ),
  };
  const output = {
    ...data,
    summary,
    offerPolicy: appliedOfferPolicy,
    purchaseLinkPolicy: linkSummary,
    items,
  };

  await writeFile(APP_DATA_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(
    JSON.stringify(
      { ...linkSummary, removedBlockedEntriesThisRun: beforeCoupangCount },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

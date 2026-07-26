import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const APP_DATA_PATH = path.join("src", "data", "items.json");
const REPORT_PATH = path.join("data", "data-quality-report.json");
const appData = JSON.parse(readFileSync(APP_DATA_PATH, "utf8"));
const items = appData.items ?? [];

const countOffers = (key) =>
  items.reduce((sum, item) => sum + (item[key]?.length ?? 0), 0);

const offerStates = Object.fromEntries(
  [
    "available",
    "stale",
    "candidates_available",
    "needs_review",
    "no_available_offer",
    "not_synced",
  ].map((state) => [
    state,
    items.filter((item) => item.offerStatus?.state === state).length,
  ]),
);

const issueCounts = {};
for (const item of items) {
  for (const issue of item.dataQuality?.issues ?? []) {
    issueCounts[issue.code] = (issueCounts[issue.code] ?? 0) + 1;
  }
}

const report = {
  generatedAt: appData.generatedAt,
  source: APP_DATA_PATH.replaceAll(path.sep, "/"),
  summary: {
    totalItems: items.length,
    readyItems: items.filter((item) => item.dataQuality?.status === "ready")
      .length,
    usableWithWarningsItems: items.filter(
      (item) => item.dataQuality?.status === "usable_with_warnings",
    ).length,
    needsReviewItems: items.filter(
      (item) => item.dataQuality?.status === "needs_review",
    ).length,
    issueCounts,
  },
  pricing: {
    freshnessHours: appData.offerPolicy?.freshnessHours ?? null,
    verifiedOffers: countOffers("purchaseOffers"),
    candidateOffers: countOffers("candidateOffers"),
    rejectedOffers: countOffers("rejectedOffers"),
    offerStates,
  },
  purchaseLinks: {
    freshnessHours: appData.offerPolicy?.purchaseLinkFreshnessHours ?? null,
    verified: items.filter((item) => item.purchaseLink?.status === "verified")
      .length,
    hidden: items.filter((item) => item.purchaseLink?.status !== "verified")
      .length,
    naverSearch: items.filter(
      (item) => item.purchaseLink?.kind === "naver_search",
    ).length,
    official: items.filter((item) => item.purchaseLink?.kind === "official")
      .length,
  },
  needsReviewItems: items
    .filter(
      (item) =>
        item.dataQuality?.status === "needs_review" ||
        item.offerStatus?.state === "needs_review",
    )
    .map((item) => ({
      id: item.id,
      title: item.title,
      dataIssues: item.dataQuality?.issues ?? [],
      rejectedOffers: item.rejectedOffers ?? [],
    })),
};

writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${REPORT_PATH}`);

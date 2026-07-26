import { readFileSync } from "node:fs";
import path from "node:path";
import {
  hostFrom,
  isBlockedPurchaseUrl,
  isTrustedPurchaseUrl,
  offerPolicy,
  purchaseLinkAgeHours,
} from "./lib/offer-policy.mjs";

const APP_DATA_PATH = path.join("src", "data", "items.json");
const data = JSON.parse(readFileSync(APP_DATA_PATH, "utf8"));
const strict = process.argv.includes("--strict");
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function isCoupangEntry(entry) {
  return Boolean(
    entry &&
    (isBlockedPurchaseUrl(entry.url) ||
      /coupang|쿠팡/i.test(`${entry.platform ?? ""} ${entry.mallName ?? ""}`)),
  );
}

function validateNaverSearch(item, url) {
  const parsed = new URL(url);
  if (
    parsed.hostname !== "search.shopping.naver.com" ||
    parsed.pathname !== "/search/all"
  ) {
    fail(`bad Naver search URL: ${item.title} -> ${url}`);
    return;
  }

  const query = parsed.searchParams.get("query")?.replace(/\s+/g, " ").trim();
  const title = item.title.replace(/\s+/g, " ").trim();
  if (!query || query !== title) {
    fail(`Naver search query must equal the item title: ${item.title}`);
  }
}

for (const item of data.items ?? []) {
  const purchaseLink = item.purchaseLink;
  if (!purchaseLink || typeof purchaseLink.status !== "string") {
    fail(`missing purchaseLink state: ${item.title}`);
    continue;
  }

  const allEntries = [
    ...(item.partnerLinks ?? []),
    ...(item.purchaseOffers ?? []),
    ...(item.candidateOffers ?? []),
    ...(item.rejectedOffers ?? []),
  ];
  for (const entry of allEntries) {
    if (isCoupangEntry(entry)) {
      fail(
        `Coupang entry must not be published: ${item.title} -> ${entry.url}`,
      );
    }
  }

  if (purchaseLink.status === "verified") {
    if (!purchaseLink.url || item.partnerLink !== purchaseLink.url) {
      fail(`verified purchase link is not the primary link: ${item.title}`);
    } else if (!isTrustedPurchaseUrl(purchaseLink.url)) {
      fail(`untrusted verified purchase link: ${item.title}`);
    }
    if (
      item.partnerLinks.length !== 1 ||
      item.partnerLinks[0]?.url !== purchaseLink.url
    ) {
      fail(`verified item must expose exactly one primary link: ${item.title}`);
    }

    const checkedAge = purchaseLinkAgeHours(purchaseLink.checkedAt);
    if (checkedAge > offerPolicy.purchaseLinkFreshnessHours) {
      const message = `expired purchase-link evidence (${Math.floor(checkedAge / 24)}d): ${item.title}`;
      if (strict) fail(message);
      else warn(message);
    }

    if (purchaseLink.kind === "naver_search") {
      validateNaverSearch(item, purchaseLink.url);
    } else if (purchaseLink.kind !== "official") {
      fail(`unknown purchase-link kind: ${item.title} -> ${purchaseLink.kind}`);
    }
  } else if (purchaseLink.status === "unavailable") {
    if (
      purchaseLink.url !== null ||
      item.partnerLink ||
      item.partnerLinks.length
    ) {
      fail(`unavailable item must not expose a link: ${item.title}`);
    }
  } else {
    fail(
      `unknown purchase-link status: ${item.title} -> ${purchaseLink.status}`,
    );
  }
}

const summary = {
  items: data.items.length,
  verified: data.items.filter(
    (item) => item.purchaseLink?.status === "verified",
  ).length,
  hidden: data.items.filter((item) => item.purchaseLink?.status !== "verified")
    .length,
  naverSearch: data.items.filter(
    (item) => item.purchaseLink?.kind === "naver_search",
  ).length,
  official: data.items.filter((item) => item.purchaseLink?.kind === "official")
    .length,
  blockedHosts: [
    ...new Set(
      (data.items ?? []).flatMap((item) =>
        [
          item.purchaseLink?.url,
          ...(item.partnerLinks ?? []).map((link) => link.url),
          ...(item.purchaseOffers ?? []).map((offer) => offer.url),
          ...(item.candidateOffers ?? []).map((offer) => offer.url),
          ...(item.rejectedOffers ?? []).map((offer) => offer.url),
        ]
          .filter(isBlockedPurchaseUrl)
          .map(hostFrom),
      ),
    ),
  ],
  warnings: warnings.length,
  failures: failures.length,
};

console.log(JSON.stringify(summary, null, 2));
for (const message of warnings) console.warn(message);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

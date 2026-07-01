import { readFileSync } from "node:fs";
import path from "node:path";

const APP_DATA_PATH = path.join("src", "data", "items.json");
const SHORT_URL_HOSTS = new Set(["bit.ly", "naver.me", "tinyurl.com", "t.co", "goo.gl"]);

function hostFrom(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "invalid";
  }
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

const appData = JSON.parse(readFileSync(APP_DATA_PATH, "utf8"));
const items = appData.items ?? [];
const hosts = new Map();
const shortLinks = [];
let itemsWithReferencePrice = 0;
let itemsWithBestOffer = 0;
let purchaseOffers = 0;
let noAvailableOfferItems = 0;

for (const item of items) {
  if (item.referencePrice) {
    itemsWithReferencePrice += 1;
  }

  if (item.bestOffer) {
    itemsWithBestOffer += 1;
  }

  purchaseOffers += item.purchaseOffers?.length ?? 0;

  if (item.offerStatus?.state === "no_available_offer") {
    noAvailableOfferItems += 1;
  }

  for (const link of item.partnerLinks ?? []) {
    const host = hostFrom(link.url);
    increment(hosts, host);

    if (SHORT_URL_HOSTS.has(host)) {
      shortLinks.push({ itemId: item.id, title: item.title, url: link.url, host });
    }
  }
}

const env = {
  naverShoppingApiReady: Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET),
  coupangApiReady: Boolean(process.env.COUPANG_ACCESS_KEY && process.env.COUPANG_SECRET_KEY),
};

const summary = {
  totalItems: items.length,
  itemsWithReferencePrice,
  itemsWithoutReferencePrice: items.length - itemsWithReferencePrice,
  itemsWithBestOffer,
  purchaseOffers,
  noAvailableOfferItems,
  partnerLinkHosts: Object.fromEntries([...hosts.entries()].sort(([a], [b]) => a.localeCompare(b))),
  shortLinks: shortLinks.length,
  env,
  nextAction:
    env.naverShoppingApiReady || env.coupangApiReady
      ? "Run platform collectors, merge candidates, then apply only verified in-stock offers with shipping-inclusive totals."
      : "Configure official shopping API credentials before enabling automated price candidates.",
};

console.log(JSON.stringify(summary, null, 2));

if (shortLinks.length > 0) {
  console.warn(
    `${shortLinks.length} short links remain. Replace them with final destination URLs before strict automated matching.`,
  );
}

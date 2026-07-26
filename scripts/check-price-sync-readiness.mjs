import { readFileSync } from "node:fs";
import path from "node:path";
import {
  hostFrom,
  isFreshOffer,
  isShortUrl,
  isTrustedPurchaseUrl,
  offerAgeHours,
} from "./lib/offer-policy.mjs";

const APP_DATA_PATH = path.join("src", "data", "items.json");
const strict = process.argv.includes("--strict");
const requireApi = process.argv.includes("--require-api");
const appData = JSON.parse(readFileSync(APP_DATA_PATH, "utf8"));
const items = appData.items ?? [];
const hosts = new Map();
const shortLinks = [];
const untrustedLinks = [];

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

for (const item of items) {
  for (const link of item.partnerLinks ?? []) {
    const host = hostFrom(link.url);
    increment(hosts, host);

    if (isShortUrl(link.url)) {
      shortLinks.push({ itemId: item.id, title: item.title, url: link.url });
    }
    if (!isTrustedPurchaseUrl(link.url)) {
      untrustedLinks.push({
        itemId: item.id,
        title: item.title,
        url: link.url,
      });
    }
  }
}

const env = {
  naverShoppingApiReady: Boolean(
    process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET,
  ),
};
const verifiedOffers = items.flatMap((item) => item.purchaseOffers ?? []);
const candidateOffers = items.flatMap((item) => item.candidateOffers ?? []);
const rejectedOffers = items.flatMap((item) => item.rejectedOffers ?? []);
const staleVerifiedOffers = verifiedOffers.filter(
  (offer) => !isFreshOffer(offer),
);
const newestOfferAgeHours = Math.min(
  ...[...verifiedOffers, ...candidateOffers].map((offer) =>
    offerAgeHours(offer),
  ),
);
const failures = [];

if (shortLinks.length > 0)
  failures.push(`${shortLinks.length} short links remain`);
if (untrustedLinks.length > 0) {
  failures.push(`${untrustedLinks.length} untrusted partner links remain`);
}
if (requireApi && !env.naverShoppingApiReady) {
  failures.push("Naver Shopping API credentials are not configured");
}

const summary = {
  totalItems: items.length,
  itemsWithReferencePrice: items.filter((item) => item.referencePrice).length,
  verifiedOffers: verifiedOffers.length,
  candidateOffers: candidateOffers.length,
  rejectedOffers: rejectedOffers.length,
  freshVerifiedOffers: verifiedOffers.length - staleVerifiedOffers.length,
  staleVerifiedOffers: staleVerifiedOffers.length,
  newestOfferAgeHours: Number.isFinite(newestOfferAgeHours)
    ? Math.round(newestOfferAgeHours)
    : null,
  partnerLinkHosts: Object.fromEntries(
    [...hosts.entries()].sort(([a], [b]) => a.localeCompare(b)),
  ),
  shortLinks: shortLinks.length,
  untrustedLinks: untrustedLinks.length,
  env,
  strict,
  ready: failures.length === 0,
  nextAction:
    verifiedOffers.length === staleVerifiedOffers.length
      ? "Refresh official price sources. The UI will treat all current prices as old candidates."
      : "Keep the scheduled refresh running and review rejected candidates.",
};

console.log(JSON.stringify(summary, null, 2));

if (strict && failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

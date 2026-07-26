import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  isFreshOffer,
  isShortUrl,
  isTrustedImageUrl,
  isTrustedPurchaseUrl,
  isVerifiedOffer,
  offerAgeHours,
  offerPolicy,
} from "./lib/offer-policy.mjs";

const APP_DATA_PATH = path.join("src", "data", "items.json");
const data = JSON.parse(readFileSync(APP_DATA_PATH, "utf8"));
const items = data.items ?? [];
const failures = [];
const warnings = [];
const OFFER_STATES = new Set([
  "not_synced",
  "available",
  "stale",
  "candidates_available",
  "no_available_offer",
  "needs_review",
]);

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function validateTimestamp(value, label) {
  if (!value || !Number.isFinite(Date.parse(String(value)))) {
    fail(`${label} has invalid syncedAt: ${value}`);
  }
}

function validateBaseOffer(item, offer, label) {
  if (!isTrustedPurchaseUrl(offer.url)) {
    fail(`${label} has untrusted purchase URL: ${item.title} -> ${offer.url}`);
  }

  if (offer.inStock !== true) {
    fail(`${label} must be in stock: ${item.title}`);
  }

  if (!Number.isFinite(offer.price) || offer.price <= 0) {
    fail(`${label} has bad price: ${item.title}`);
  }

  if (offer.imageUrl && !isTrustedImageUrl(offer.imageUrl)) {
    fail(
      `${label} image host is not trusted: ${item.title} -> ${offer.imageUrl}`,
    );
  }

  validateTimestamp(offer.syncedAt, `${label} for ${item.title}`);
}

function validateVerifiedOffer(item, offer, label) {
  validateBaseOffer(item, offer, label);
  if (!isVerifiedOffer(offer)) {
    fail(`${label} is not a shipping-included verified offer: ${item.title}`);
  }
}

function validateCandidateOffer(item, offer, label) {
  validateBaseOffer(item, offer, label);
  if (isVerifiedOffer(offer)) {
    fail(`${label} belongs in purchaseOffers: ${item.title}`);
  }
  if ((offer.reviewFlags?.length ?? 0) > 0) {
    fail(`${label} contains review flags: ${item.title}`);
  }
}

function validateRejectedOffer(item, offer, label) {
  if ((offer.reviewFlags?.length ?? 0) === 0) {
    fail(`${label} must explain why it was rejected: ${item.title}`);
  }
  validateTimestamp(offer.syncedAt, `${label} for ${item.title}`);
}

function expectedOfferState(item) {
  if (item.bestOffer) {
    return isFreshOffer(item.bestOffer) ? "available" : "stale";
  }
  if ((item.candidateOffers?.length ?? 0) > 0) return "candidates_available";
  if ((item.rejectedOffers?.length ?? 0) > 0) return "needs_review";
  if (item.offerStatus?.state === "not_synced") return "not_synced";
  return "no_available_offer";
}

const ids = new Set();
for (const item of items) {
  if (!item.id) fail(`missing id: ${item.title || "(untitled)"}`);
  if (ids.has(item.id)) fail(`duplicate id: ${item.id}`);
  ids.add(item.id);

  if (!item.title?.trim()) fail(`missing title: ${item.id}`);
  if (!Array.isArray(item.categories) || item.categories.length === 0) {
    fail(`missing categories: ${item.title}`);
  }
  if (!item.categories?.includes(item.primaryCategory)) {
    fail(`primary category is not included in categories: ${item.title}`);
  }
  if (!OFFER_STATES.has(item.offerStatus?.state)) {
    fail(`bad offer status: ${item.title} -> ${item.offerStatus?.state}`);
  }

  for (const [label, value] of [
    ["purchaseOffers", item.purchaseOffers],
    ["candidateOffers", item.candidateOffers],
    ["rejectedOffers", item.rejectedOffers],
    ["partnerLinks", item.partnerLinks],
  ]) {
    if (!Array.isArray(value)) fail(`${label} must be an array: ${item.title}`);
  }

  if (item.imagePath?.startsWith("/images/")) {
    const localImagePath = path.join(
      "public",
      item.imagePath.replace(/^\//, ""),
    );
    if (!existsSync(localImagePath))
      fail(`missing image file: ${item.imagePath}`);
  } else if (!isTrustedImageUrl(item.imagePath)) {
    fail(`bad or untrusted image path: ${item.title} -> ${item.imagePath}`);
  }

  if (!isTrustedPurchaseUrl(item.partnerLink)) {
    fail(
      `untrusted primary partner link: ${item.title} -> ${item.partnerLink}`,
    );
  }

  for (const link of item.partnerLinks ?? []) {
    if (!isTrustedPurchaseUrl(link.url)) {
      fail(`untrusted partner link: ${item.title} -> ${link.url}`);
    }
    if (isShortUrl(link.url)) {
      fail(`short partner link must be resolved: ${item.title} -> ${link.url}`);
    }
  }

  if (item.bestOffer) {
    validateVerifiedOffer(item, item.bestOffer, "bestOffer");
    if (item.bestOffer.url !== item.purchaseOffers?.[0]?.url) {
      fail(`bestOffer must equal purchaseOffers[0]: ${item.title}`);
    }
  }

  for (const [index, offer] of (item.purchaseOffers ?? []).entries()) {
    validateVerifiedOffer(item, offer, `purchaseOffers[${index}]`);
  }
  for (const [index, offer] of (item.candidateOffers ?? []).entries()) {
    validateCandidateOffer(item, offer, `candidateOffers[${index}]`);
  }
  for (const [index, offer] of (item.rejectedOffers ?? []).entries()) {
    validateRejectedOffer(item, offer, `rejectedOffers[${index}]`);
  }

  for (const key of ["purchaseOffers", "candidateOffers"]) {
    if ((item[key]?.length ?? 0) > offerPolicy.maxOffersPerItem) {
      fail(`too many ${key}: ${item.title}`);
    }
  }

  const allVisibleUrls = [
    ...(item.purchaseOffers ?? []),
    ...(item.candidateOffers ?? []),
  ].map((offer) => offer.url);
  if (new Set(allVisibleUrls).size !== allVisibleUrls.length) {
    fail(`duplicate visible offer URL: ${item.title}`);
  }

  const expectedState = expectedOfferState(item);
  if (item.offerStatus?.state !== expectedState) {
    fail(
      `offer state mismatch: ${item.title} -> ${item.offerStatus?.state}, expected ${expectedState}`,
    );
  }

  if (item.bestOffer && !isFreshOffer(item.bestOffer)) {
    warn(
      `stale verified offer (${Math.floor(offerAgeHours(item.bestOffer) / 24)}d): ${item.title}`,
    );
  }
}

const computedSummary = {
  totalItems: items.length,
  readyItems: items.filter((item) => item.dataQuality?.status === "ready")
    .length,
  usableWithWarningsItems: items.filter(
    (item) => item.dataQuality?.status === "usable_with_warnings",
  ).length,
  needsReviewItems: items.filter(
    (item) => item.dataQuality?.status === "needs_review",
  ).length,
};

for (const [key, expected] of Object.entries(computedSummary)) {
  if (data.summary?.[key] !== expected) {
    fail(`summary.${key} is ${data.summary?.[key]}, expected ${expected}`);
  }
}

for (const category of data.summary?.categories ?? []) {
  const expectedCount = items.filter((item) =>
    item.categories.includes(category.name),
  ).length;
  if (category.count !== expectedCount) {
    fail(
      `category count mismatch: ${category.name} -> ${category.count}, expected ${expectedCount}`,
    );
  }
}

const summary = {
  items: items.length,
  ready: computedSummary.readyItems,
  usableWithWarnings: computedSummary.usableWithWarningsItems,
  needsReview: computedSummary.needsReviewItems,
  verifiedOffers: items.reduce(
    (sum, item) => sum + (item.purchaseOffers?.length ?? 0),
    0,
  ),
  candidateOffers: items.reduce(
    (sum, item) => sum + (item.candidateOffers?.length ?? 0),
    0,
  ),
  rejectedOffers: items.reduce(
    (sum, item) => sum + (item.rejectedOffers?.length ?? 0),
    0,
  ),
  staleItems: items.filter((item) => item.offerStatus?.state === "stale")
    .length,
  warnings: warnings.length,
  failures: failures.length,
};

console.log(JSON.stringify(summary, null, 2));
for (const message of warnings) console.warn(message);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

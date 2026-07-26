import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  collectOfferReviewFlags,
  hostFrom,
  isFreshOffer,
  isHttpsUrl,
  isTrustedImageUrl,
  isVerifiedOffer,
  sortOffersByEffectivePrice,
} from "./lib/offer-policy.mjs";

const APP_DATA_PATH = path.join("src", "data", "items.json");
const DEFAULT_CANDIDATES_PATH = path.join("data", "price-candidates.json");
const PRICE_CTA = "구매처에서 최신가 확인";
const MIN_REFERENCE_PRICE_RATIO = 0.45;
const MAX_REFERENCE_PRICE_RATIO = 2.5;
const args = process.argv.slice(2);
const candidatesPath =
  args.find((arg) => !arg.startsWith("--")) ?? DEFAULT_CANDIDATES_PATH;
const includeReferenceCandidates = args.includes(
  "--include-reference-candidates",
);
const maxOffers = getArgNumber("--max-offers", 4);

function getArgNumber(name, fallback) {
  const prefix = `${name}=`;
  const arg = args.find((value) => value.startsWith(prefix));

  if (!arg) {
    return fallback;
  }

  const value = Number(arg.slice(prefix.length));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalTrustedImageUrl(value) {
  const url = String(value ?? "");
  return isTrustedImageUrl(url) ? url : null;
}

function referencePriceReviewFlag(item, price) {
  const referencePrice = toNumber(item.price);

  if (referencePrice === null || referencePrice <= 0) {
    return null;
  }

  if (price < referencePrice * MIN_REFERENCE_PRICE_RATIO) {
    return "price_too_low_vs_reference";
  }

  if (price > referencePrice * MAX_REFERENCE_PRICE_RATIO) {
    return "price_too_high_vs_reference";
  }

  return null;
}

function isInStock(candidate) {
  if (
    candidate.soldOut === true ||
    candidate.inStock === false ||
    candidate.available === false
  ) {
    return false;
  }

  if (
    candidate.inStock === true ||
    candidate.available === true ||
    candidate.soldOut === false
  ) {
    return true;
  }

  const status = String(
    candidate.stockStatus ?? candidate.status ?? "",
  ).toLowerCase();
  return ["in_stock", "available", "on_sale", "판매중", "재고있음"].includes(
    status,
  );
}

function normalizeConfidence(value) {
  const confidence = String(value ?? "low").toLowerCase();
  return confidence === "high" || confidence === "medium" ? confidence : "low";
}

function flattenCandidateInput(input) {
  if (Array.isArray(input.items)) {
    return input.items.map((entry) => ({
      itemId: entry.itemId ?? entry.id,
      syncedAt: entry.syncedAt ?? input.syncedAt ?? input.generatedAt ?? null,
      offers: entry.offers ?? entry.candidates ?? [],
    }));
  }

  if (Array.isArray(input.offers)) {
    const byItemId = new Map();

    for (const offer of input.offers) {
      const itemId = offer.itemId ?? offer.id;
      if (!itemId) continue;

      const entry = byItemId.get(itemId) ?? {
        itemId,
        syncedAt: offer.syncedAt ?? input.syncedAt ?? input.generatedAt ?? null,
        offers: [],
      };
      entry.offers.push(offer);
      byItemId.set(itemId, entry);
    }

    return [...byItemId.values()];
  }

  throw new Error("Candidate file must contain an items[] or offers[] array.");
}

function normalizeOffer(raw, fallbackSyncedAt, item) {
  const url = String(raw.url ?? raw.productUrl ?? raw.link ?? "");
  const price = toNumber(raw.price ?? raw.salePrice ?? raw.lprice);
  const rawShippingFee = raw.shippingFee ?? raw.deliveryFee ?? raw.shipping;
  const explicitTotalPrice = toNumber(raw.totalPrice ?? raw.total);
  let shippingFee = toNumber(rawShippingFee);

  if (
    shippingFee === null &&
    explicitTotalPrice !== null &&
    price !== null &&
    explicitTotalPrice >= price
  ) {
    shippingFee = explicitTotalPrice - price;
  }

  const totalPrice =
    explicitTotalPrice ??
    (price === null || shippingFee === null ? null : price + shippingFee);
  const matchConfidence = normalizeConfidence(
    raw.matchConfidence ?? raw.confidence,
  );

  if (!isHttpsUrl(url)) {
    return { accepted: false, reason: "non_https_url", url };
  }

  if (price === null || price <= 0) {
    return { accepted: false, reason: "bad_price", url };
  }

  if (!isInStock(raw)) {
    return { accepted: false, reason: "not_in_stock", url };
  }

  const reviewFlags = collectOfferReviewFlags(item.title, {
    ...raw,
    url,
  });
  const priceFlag = referencePriceReviewFlag(item, price);
  if (priceFlag) reviewFlags.push(priceFlag);
  if (matchConfidence !== "high") reviewFlags.push("low_match_confidence");

  const offer = {
    url,
    platform: String(raw.platform ?? raw.channel ?? "manual"),
    mallName: String(raw.mallName ?? raw.mall ?? raw.seller ?? hostFrom(url)),
    price,
    shippingFee,
    totalPrice,
    priceBasis:
      shippingFee === null || totalPrice === null
        ? "listed_price"
        : "shipping_included",
    inStock: true,
    source: String(raw.source ?? "manual-candidate"),
    syncedAt: String(
      raw.syncedAt ?? fallbackSyncedAt ?? new Date().toISOString(),
    ),
    matchConfidence,
    productName: raw.productName ?? raw.name ?? raw.title ?? null,
    imageUrl: optionalTrustedImageUrl(
      raw.imageUrl ?? raw.image ?? raw.thumbnail,
    ),
    note: raw.note ?? null,
    reviewFlags: [...new Set(reviewFlags)],
  };

  return { accepted: true, offer };
}

function dedupeOffersByUrl(offers) {
  return [...new Map(offers.map((offer) => [offer.url, offer])).values()];
}

function offerStatusFor(verifiedOffers, candidateOffers, rejectedOffers) {
  if (verifiedOffers.length > 0) {
    return isFreshOffer(verifiedOffers[0]) ? "available" : "stale";
  }

  if (candidateOffers.length > 0) return "candidates_available";
  if (rejectedOffers.length > 0) return "needs_review";
  return "no_available_offer";
}

async function main() {
  const appData = JSON.parse(await readFile(APP_DATA_PATH, "utf8"));
  const candidateInput = JSON.parse(await readFile(candidatesPath, "utf8"));
  const candidateEntries = flattenCandidateInput(candidateInput);
  const itemsById = new Map(
    (appData.items ?? []).map((item) => [item.id, item]),
  );
  const skipped = [];
  let applied = 0;

  for (const entry of candidateEntries) {
    const item = itemsById.get(entry.itemId);

    if (!item) {
      skipped.push({ itemId: entry.itemId, reason: "unknown_item" });
      continue;
    }

    const normalizedOffers = [];

    for (const rawOffer of entry.offers ?? []) {
      const result = normalizeOffer(rawOffer, entry.syncedAt, item);
      if (!result.accepted) {
        skipped.push({
          itemId: item.id,
          title: item.title,
          reason: result.reason,
          url: result.url,
        });
        continue;
      }
      normalizedOffers.push(result.offer);
    }

    const sortedOffers = dedupeOffersByUrl(
      sortOffersByEffectivePrice(normalizedOffers),
    );
    const rejectedOffers = sortedOffers.filter(
      (offer) => offer.reviewFlags.length > 0,
    );
    const acceptedOffers = sortedOffers.filter(
      (offer) => offer.reviewFlags.length === 0,
    );
    const verifiedOffers = acceptedOffers
      .filter(isVerifiedOffer)
      .slice(0, maxOffers);
    const candidateOffers = includeReferenceCandidates
      ? acceptedOffers
          .filter((offer) => !isVerifiedOffer(offer))
          .slice(0, maxOffers)
      : [];
    const state = offerStatusFor(
      verifiedOffers,
      candidateOffers,
      rejectedOffers,
    );
    const syncedAt =
      verifiedOffers[0]?.syncedAt ??
      candidateOffers[0]?.syncedAt ??
      rejectedOffers[0]?.syncedAt ??
      entry.syncedAt ??
      candidateInput.generatedAt ??
      new Date().toISOString();

    item.bestOffer = verifiedOffers[0] ?? null;
    item.purchaseOffers = verifiedOffers;
    item.candidateOffers = candidateOffers;
    item.rejectedOffers = rejectedOffers;
    item.offerStatus = {
      state,
      syncedAt: String(syncedAt),
      checkedOffers: (entry.offers ?? []).length,
    };
    item.displayPrice =
      state === "available" && item.bestOffer
        ? `최저가 ${item.bestOffer.totalPrice.toLocaleString("ko-KR")}원`
        : PRICE_CTA;
    applied += 1;
  }

  const appliedAt = new Date().toISOString();
  appData.generatedAt = appliedAt;
  appData.offerSync = {
    candidateFile: candidatesPath,
    appliedAt,
    applied,
    verifiedOffers: (appData.items ?? []).reduce(
      (sum, item) => sum + (item.purchaseOffers?.length ?? 0),
      0,
    ),
    candidateOffers: (appData.items ?? []).reduce(
      (sum, item) => sum + (item.candidateOffers?.length ?? 0),
      0,
    ),
    rejectedOffers: (appData.items ?? []).reduce(
      (sum, item) => sum + (item.rejectedOffers?.length ?? 0),
      0,
    ),
    skipped: skipped.length,
  };

  await writeFile(
    APP_DATA_PATH,
    `${JSON.stringify(appData, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(appData.offerSync, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

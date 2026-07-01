import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const APP_DATA_PATH = path.join("src", "data", "items.json");
const DEFAULT_CANDIDATES_PATH = path.join("data", "price-candidates.json");
const PRICE_CTA = "구매처에서 최신가 확인";
const SHORT_URL_HOSTS = new Set(["bit.ly", "naver.me", "tinyurl.com", "t.co", "goo.gl"]);
const MIN_REFERENCE_PRICE_RATIO = 0.45;
const NON_MAIN_PRODUCT_RULES = [
  { pattern: /쇼핑백|선물\s*쇼핑백/i },
  { pattern: /어댑터|충전기/i, allowedTitlePattern: /어댑터|충전기/i },
  { pattern: /호환/i, allowedTitlePattern: /호환/i },
  { pattern: /대여|렌탈/i },
  { pattern: /별도\s*판매|별도판매|구성품/i },
  { pattern: /케이스|커버/i, allowedTitlePattern: /케이스|커버/i },
];

const args = process.argv.slice(2);
const candidatesPath = args.find((arg) => !arg.startsWith("--")) ?? DEFAULT_CANDIDATES_PATH;
const allowMediumConfidence = args.includes("--allow-medium");
const allowUnknownShipping = args.includes("--allow-unknown-shipping");
const maxOffers = getArgNumber("--max-offers", 0);

function getArgNumber(name, fallback) {
  const prefix = `${name}=`;
  const arg = args.find((value) => value.startsWith(prefix));

  if (!arg) {
    return fallback;
  }

  const value = Number(arg.slice(prefix.length));

  return Number.isFinite(value) ? value : fallback;
}

function formatWon(value) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function hostFrom(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isHttpsUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function optionalHttpsUrl(value) {
  const url = String(value ?? "");

  return isHttpsUrl(url) ? url : null;
}

function isTooLowComparedWithReference(item, price) {
  const referencePrice = toNumber(item.price);

  return (
    referencePrice !== null &&
    referencePrice > 0 &&
    price < referencePrice * MIN_REFERENCE_PRICE_RATIO
  );
}

function isLikelyNonMainProduct(itemTitle, raw) {
  const candidateName = String(raw.productName ?? raw.name ?? raw.title ?? "");

  return NON_MAIN_PRODUCT_RULES.some((rule) => {
    if (!rule.pattern.test(candidateName)) {
      return false;
    }

    return !rule.allowedTitlePattern?.test(itemTitle);
  });
}

function isInStock(candidate) {
  if (candidate.soldOut === true || candidate.inStock === false || candidate.available === false) {
    return false;
  }

  if (candidate.inStock === true || candidate.available === true || candidate.soldOut === false) {
    return true;
  }

  const status = String(candidate.stockStatus ?? candidate.status ?? "").toLowerCase();

  return ["in_stock", "available", "on_sale", "판매중", "재고있음"].includes(status);
}

function normalizeConfidence(value) {
  const confidence = String(value ?? "low").toLowerCase();

  if (confidence === "high" || confidence === "medium") {
    return confidence;
  }

  return "low";
}

function flattenCandidateInput(input) {
  if (Array.isArray(input.items)) {
    return input.items.map((entry) => ({
      itemId: entry.itemId ?? entry.id,
      title: entry.title,
      syncedAt: entry.syncedAt ?? input.syncedAt ?? input.generatedAt ?? null,
      offers: entry.offers ?? entry.candidates ?? [],
    }));
  }

  if (Array.isArray(input.offers)) {
    const byItemId = new Map();

    for (const offer of input.offers) {
      const itemId = offer.itemId ?? offer.id;

      if (!itemId) {
        continue;
      }

      const entry = byItemId.get(itemId) ?? {
        itemId,
        title: offer.title,
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

  if (shippingFee === null && explicitTotalPrice !== null && price !== null && explicitTotalPrice >= price) {
    shippingFee = explicitTotalPrice - price;
  }

  const hasUnknownShipping = shippingFee === null && allowUnknownShipping;
  const totalPrice =
    explicitTotalPrice ?? (price === null || shippingFee === null ? null : price + shippingFee);
  const matchConfidence = normalizeConfidence(raw.matchConfidence ?? raw.confidence);

  if (!isHttpsUrl(url)) {
    return { skipped: true, reason: "non_https_url", url };
  }

  if (price === null || price <= 0) {
    return { skipped: true, reason: "bad_price", url };
  }

  if (isTooLowComparedWithReference(item, price)) {
    return { skipped: true, reason: "price_too_low_vs_reference", url };
  }

  if (isLikelyNonMainProduct(item.title, raw)) {
    return { skipped: true, reason: "likely_non_main_product", url };
  }

  if (!hasUnknownShipping && (shippingFee === null || shippingFee < 0)) {
    return { skipped: true, reason: "missing_shipping_fee", url };
  }

  if (!hasUnknownShipping && (totalPrice === null || totalPrice <= 0 || totalPrice < price)) {
    return { skipped: true, reason: "bad_total_price", url };
  }

  if (!isInStock(raw)) {
    return { skipped: true, reason: "not_in_stock", url };
  }

  if (matchConfidence !== "high" && !(allowMediumConfidence && matchConfidence === "medium")) {
    return { skipped: true, reason: "low_match_confidence", url };
  }

  const host = hostFrom(url);

  return {
    skipped: false,
    offer: {
      url,
      platform: String(raw.platform ?? raw.channel ?? "manual"),
      mallName: String(raw.mallName ?? raw.mall ?? raw.seller ?? host),
      price,
      shippingFee,
      totalPrice,
      priceBasis: hasUnknownShipping ? "listed_price" : "shipping_included",
      inStock: true,
      source: String(raw.source ?? "manual-candidate"),
      syncedAt: String(raw.syncedAt ?? fallbackSyncedAt ?? new Date().toISOString()),
      matchConfidence,
      productName: raw.productName ?? raw.name ?? null,
      imageUrl: optionalHttpsUrl(raw.imageUrl ?? raw.image ?? raw.thumbnail),
      note: raw.note ?? null,
      isShortUrl: SHORT_URL_HOSTS.has(host),
    },
  };
}

function sortOffers(offers) {
  return [...offers].sort((a, b) => {
    const aSortPrice = a.totalPrice ?? a.price;
    const bSortPrice = b.totalPrice ?? b.price;

    if (aSortPrice !== bSortPrice) {
      return aSortPrice - bSortPrice;
    }

    if (a.isShortUrl !== b.isShortUrl) {
      return a.isShortUrl ? 1 : -1;
    }

    return a.price - b.price;
  });
}

function stripInternalOfferFields(offer) {
  const { isShortUrl: _isShortUrl, ...offerForApp } = offer;

  return offerForApp;
}

function dedupeOffersByUrl(offers) {
  const seen = new Set();
  const deduped = [];

  for (const offer of offers) {
    if (seen.has(offer.url)) {
      continue;
    }

    seen.add(offer.url);
    deduped.push(offer);
  }

  return deduped;
}

async function main() {
  const appData = JSON.parse(await readFile(APP_DATA_PATH, "utf8"));
  const candidateInput = JSON.parse(await readFile(candidatesPath, "utf8"));
  const candidateEntries = flattenCandidateInput(candidateInput);
  const itemsById = new Map((appData.items ?? []).map((item) => [item.id, item]));
  const skipped = [];
  let applied = 0;
  let noAvailableOffer = 0;

  for (const entry of candidateEntries) {
    const item = itemsById.get(entry.itemId);

    if (!item) {
      skipped.push({ itemId: entry.itemId, reason: "unknown_item" });
      continue;
    }

    const normalizedOffers = [];

    for (const rawOffer of entry.offers ?? []) {
      const normalized = normalizeOffer(rawOffer, entry.syncedAt, item);

      if (normalized.skipped) {
        skipped.push({
          itemId: item.id,
          title: item.title,
          reason: normalized.reason,
          url: normalized.url,
        });
        continue;
      }

      normalizedOffers.push(normalized.offer);
    }

    const sortedOffers = dedupeOffersByUrl(sortOffers(normalizedOffers));
    const bestOffer = sortedOffers[0];
    const syncedAt = String(entry.syncedAt ?? candidateInput.syncedAt ?? candidateInput.generatedAt ?? new Date().toISOString());

    if (!bestOffer) {
      item.bestOffer = null;
      item.purchaseOffers = [];
      item.offerStatus = {
        state: "no_available_offer",
        syncedAt,
        checkedOffers: (entry.offers ?? []).length,
      };
      item.displayPrice = PRICE_CTA;
      noAvailableOffer += 1;
      continue;
    }

    const purchaseOffers = sortedOffers
      .slice(0, maxOffers > 0 ? maxOffers : undefined)
      .map(stripInternalOfferFields);

    item.bestOffer = purchaseOffers[0];
    item.purchaseOffers = purchaseOffers;
    item.offerStatus = {
      state: "available",
      syncedAt: bestOffer.syncedAt,
      checkedOffers: (entry.offers ?? []).length,
    };
    item.displayPrice = `최저가 ${formatWon(bestOffer.totalPrice ?? bestOffer.price)}${
      bestOffer.totalPrice === null ? "부터" : ""
    }`;
    applied += 1;
  }

  appData.generatedAt = new Date().toISOString();
  appData.offerSync = {
    candidateFile: candidatesPath,
    appliedAt: new Date().toISOString(),
    applied,
    purchaseOffers: (appData.items ?? []).reduce(
      (sum, item) => sum + (item.purchaseOffers?.length ?? 0),
      0,
    ),
    noAvailableOffer,
    skipped: skipped.length,
  };

  await writeFile(APP_DATA_PATH, `${JSON.stringify(appData, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        candidateFile: candidatesPath,
        applied,
        noAvailableOffer,
        purchaseOffers: (appData.items ?? []).reduce(
          (sum, item) => sum + (item.purchaseOffers?.length ?? 0),
          0,
        ),
        skipped: skipped.length,
        skipReasons: skipped.reduce((acc, item) => {
          acc[item.reason] = (acc[item.reason] ?? 0) + 1;
          return acc;
        }, {}),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

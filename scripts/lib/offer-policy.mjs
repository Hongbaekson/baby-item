import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const POLICY_PATH = fileURLToPath(
  new URL("../../config/offer-policy.json", import.meta.url),
);

export const offerPolicy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
export const trustedPurchaseHosts = new Set(offerPolicy.trustedPurchaseHosts);
export const trustedImageHosts = new Set(offerPolicy.trustedImageHosts);
export const shortUrlHosts = new Set(offerPolicy.shortUrlHosts);

const STOPWORDS = new Set([
  "현재",
  "품절",
  "단품",
  "정품",
  "공식",
  "한국공식",
  "전용",
  "세트",
  "슈퍼적립",
  "개",
  "개입",
  "장",
  "용",
  "단독",
  "무료배송",
]);

export function normalizeText(value) {
  return String(value ?? "")
    .replace(/<\/?b>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .toLowerCase()
    .replace(/\([^)]*\b품절\b[^)]*\)/g, " ")
    .replace(/[\[\](){},/_+&-]+/g, " ")
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function significantTokens(value) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

export function hostFrom(value) {
  try {
    return new URL(String(value ?? "")).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

export function isHttpsUrl(value) {
  try {
    return new URL(String(value ?? "")).protocol === "https:";
  } catch {
    return false;
  }
}

export function isTrustedPurchaseUrl(value) {
  const host = hostFrom(value);
  return isHttpsUrl(value) && trustedPurchaseHosts.has(host);
}

export function isTrustedImageUrl(value) {
  const host = hostFrom(value);
  return isHttpsUrl(value) && trustedImageHosts.has(host);
}

export function isShortUrl(value) {
  return shortUrlHosts.has(hostFrom(value));
}

export function titleMatch(itemTitle, candidateTitle) {
  const itemTokens = significantTokens(itemTitle);
  const candidateText = normalizeText(candidateTitle);

  if (itemTokens.length === 0 || !candidateText) {
    return {
      confidence: "low",
      coverage: 0,
      matchedTokens: [],
      missingTokens: itemTokens,
    };
  }

  const matchedTokens = itemTokens.filter((token) =>
    candidateText.includes(token),
  );
  const missingTokens = itemTokens.filter(
    (token) => !candidateText.includes(token),
  );
  const coverage = matchedTokens.length / itemTokens.length;
  const hasDistinctiveToken = matchedTokens.some(
    (token) => token.length >= 3 || /[0-9]/.test(token),
  );
  const confidence =
    coverage >= 0.8 && hasDistinctiveToken
      ? "high"
      : coverage >= 0.6 && hasDistinctiveToken
        ? "medium"
        : "low";

  return { confidence, coverage, matchedTokens, missingTokens };
}

function includesReviewTerm(text, terms) {
  const normalized = normalizeText(text);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

export function collectOfferReviewFlags(itemTitle, candidate) {
  const candidateTitle = String(
    candidate.productName ?? candidate.name ?? candidate.title ?? "",
  );
  const flags = [];

  if (
    !isTrustedPurchaseUrl(
      candidate.url ?? candidate.productUrl ?? candidate.link,
    )
  ) {
    flags.push("untrusted_purchase_host");
  }

  const titleResult = titleMatch(itemTitle, candidateTitle);
  if (titleResult.confidence !== "high") {
    flags.push("title_mismatch");
  }

  for (const [code, terms] of Object.entries(offerPolicy.reviewTerms)) {
    if (!includesReviewTerm(candidateTitle, terms)) {
      continue;
    }

    if (
      (code === "rental_mismatch" || code === "accessory_mismatch") &&
      includesReviewTerm(itemTitle, terms)
    ) {
      continue;
    }

    flags.push(code);
  }

  return [...new Set(flags)];
}

export function isVerifiedOffer(offer) {
  return Boolean(
    offer &&
    offer.inStock === true &&
    Number.isFinite(offer.price) &&
    offer.price > 0 &&
    Number.isFinite(offer.shippingFee) &&
    offer.shippingFee >= 0 &&
    Number.isFinite(offer.totalPrice) &&
    offer.totalPrice >= offer.price &&
    offer.priceBasis === "shipping_included" &&
    isTrustedPurchaseUrl(offer.url) &&
    (offer.reviewFlags?.length ?? 0) === 0,
  );
}

export function offerAgeHours(offer, now = new Date()) {
  const syncedAt = Date.parse(String(offer?.syncedAt ?? ""));

  if (!Number.isFinite(syncedAt)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, (now.getTime() - syncedAt) / 3_600_000);
}

export function isFreshOffer(offer, now = new Date()) {
  return offerAgeHours(offer, now) <= offerPolicy.freshnessHours;
}

export function sortOffersByEffectivePrice(offers) {
  return [...offers].sort((a, b) => {
    const aPrice = a.totalPrice ?? a.price;
    const bPrice = b.totalPrice ?? b.price;
    return aPrice - bPrice || a.price - b.price || a.url.localeCompare(b.url);
  });
}

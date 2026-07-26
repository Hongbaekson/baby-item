import offerPolicy from "../../config/offer-policy.json";
import type { Item, Offer, QualityStatus } from "../types";

const FRESHNESS_MS = offerPolicy.freshnessHours * 60 * 60 * 1000;
const PURCHASE_LINK_FRESHNESS_MS =
  offerPolicy.purchaseLinkFreshnessHours * 60 * 60 * 1000;

export function qualityLabel(status: QualityStatus) {
  if (status === "ready") return "확인 완료";
  if (status === "needs_review") return "정보 확인 중";
  if (status === "draft") return "비공개";
  return "일부 확인 필요";
}

export function issueLabel(code: string) {
  if (code === "missing_price") return "기록가 없음";
  if (code === "missing_image") return "기본 이미지 사용";
  if (code === "suspicious_unrelated_memo") return "메모 확인 필요";
  if (code === "normalized_partner_link") return "링크 보정됨";
  if (code === "no_verified_purchase_link") return "확인된 판매처 없음";
  return "정보 확인 필요";
}

export function reviewFlagLabel(code: string) {
  if (code === "expiry_risk") return "소비·유통기한 확인 필요";
  if (code === "title_mismatch") return "상품명 불일치";
  if (code === "untrusted_purchase_host") return "허용되지 않은 판매처";
  if (code === "used_or_refurbished") return "중고·리퍼 가능성";
  if (code === "rental_mismatch") return "대여 상품 불일치";
  if (code === "accessory_mismatch") return "부속품 상품 가능성";
  if (code === "price_too_low_vs_reference") return "기록가 대비 지나치게 낮음";
  if (code === "price_too_high_vs_reference")
    return "기록가 대비 지나치게 높음";
  if (code === "low_match_confidence") return "낮은 매칭 신뢰도";
  return "자동 검토 제외";
}

export function linkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "외부 링크";
  }
}

export function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function offerPriceLabel(offer: Offer) {
  return offer.totalPrice === null
    ? `${formatWon(offer.price)}부터`
    : formatWon(offer.totalPrice);
}

export function offerShippingLabel(offer: Offer) {
  if (offer.shippingFee === null || offer.totalPrice === null) {
    return "배송비·품절 여부 구매처 확인";
  }
  return offer.shippingFee > 0
    ? `배송비 ${formatWon(offer.shippingFee)} 포함`
    : "배송비 포함 총액";
}

export function platformLabel(platform: string | undefined, mallName: string) {
  if (platform === "naver") return "네이버";
  return mallName;
}

export function offerAgeMs(offer: Offer, now = Date.now()) {
  const syncedAt = Date.parse(offer.syncedAt);
  return Number.isFinite(syncedAt)
    ? Math.max(0, now - syncedAt)
    : Number.POSITIVE_INFINITY;
}

export function isFreshOffer(offer: Offer, now = Date.now()) {
  return offerAgeMs(offer, now) <= FRESHNESS_MS;
}

export function formatOfferDate(offer: Offer) {
  const date = new Date(offer.syncedAt);
  if (!Number.isFinite(date.getTime())) return "확인 시각 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatCheckedDate(value: string | null | undefined) {
  const date = new Date(String(value ?? ""));
  if (!Number.isFinite(date.getTime())) return "확인 중";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export function currentVerifiedOffers(item: Item) {
  return (item.purchaseOffers ?? []).filter((offer) => isFreshOffer(offer));
}

export function referenceOffers(item: Item) {
  const staleVerified = (item.purchaseOffers ?? []).filter(
    (offer) => !isFreshOffer(offer),
  );
  return [...staleVerified, ...(item.candidateOffers ?? [])].sort(
    (a, b) => (a.totalPrice ?? a.price) - (b.totalPrice ?? b.price),
  );
}

export function itemPriceLabel(item: Item) {
  const verified = currentVerifiedOffers(item)[0];
  if (verified?.totalPrice !== null && verified?.totalPrice !== undefined) {
    return `최저가 ${formatWon(verified.totalPrice)}`;
  }

  const candidates = referenceOffers(item);
  if (candidates.length > 0) {
    return candidates.some((offer) => isFreshOffer(offer))
      ? `가격 후보 ${formatWon(candidates[0].price)}부터`
      : "가격 다시 확인";
  }

  return "구매처에서 최신가 확인";
}

export function itemOfferStatusLabel(item: Item) {
  const verified = currentVerifiedOffers(item)[0];
  if (verified) {
    return `${verified.mallName} · ${offerShippingLabel(verified)} · 최근 확인`;
  }

  const candidates = referenceOffers(item);
  if (candidates.length > 0) {
    const newest = [...candidates].sort(
      (a, b) => Date.parse(b.syncedAt) - Date.parse(a.syncedAt),
    )[0];
    return candidates.some((offer) => isFreshOffer(offer))
      ? `${formatOfferDate(newest)} 확인 · 배송비·재고 확인 필요`
      : `${formatOfferDate(newest)} 확인 · 오래된 가격 후보`;
  }

  if ((item.rejectedOffers?.length ?? 0) > 0) {
    return `자동 제외된 후보 ${item.rejectedOffers.length}개 · 상품 정보 검토 중`;
  }

  return "확인된 가격 후보가 없습니다.";
}

export function hasCurrentPurchaseLink(item: Item, now = Date.now()) {
  const checkedAt = Date.parse(String(item.purchaseLink?.checkedAt ?? ""));
  return Boolean(
    item.purchaseLink?.status === "verified" &&
    item.purchaseLink.url &&
    Number.isFinite(checkedAt) &&
    Math.max(0, now - checkedAt) <= PURCHASE_LINK_FRESHNESS_MS,
  );
}

export function primaryPurchaseUrl(item: Item) {
  return hasCurrentPurchaseLink(item) ? item.purchaseLink.url : null;
}

export function primaryActionLabel(item: Item) {
  if (!hasCurrentPurchaseLink(item)) return "검증된 판매처 없음";
  return item.purchaseLink.kind === "naver_search"
    ? "네이버에서 판매 상품 찾기"
    : "공식 판매처 보기";
}

export function purchaseLinkStatusLabel(item: Item) {
  if (!hasCurrentPurchaseLink(item)) {
    return "현재 확인된 판매 페이지가 없어 링크를 숨겼습니다.";
  }
  return item.purchaseLink.kind === "naver_search"
    ? `${formatCheckedDate(item.purchaseLink.checkedAt)} 네이버 판매 결과 확인`
    : `${formatCheckedDate(item.purchaseLink.checkedAt)} 공식 판매 페이지 확인`;
}

export function productImageUrl(item: Item) {
  return currentVerifiedOffers(item)[0]?.imageUrl ?? item.imagePath;
}

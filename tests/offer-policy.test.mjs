import assert from "node:assert/strict";
import test from "node:test";
import {
  collectOfferReviewFlags,
  isFreshOffer,
  isTrustedPurchaseUrl,
  isVerifiedOffer,
  titleMatch,
} from "../scripts/lib/offer-policy.mjs";

test("title matching only trusts the candidate product title", () => {
  const result = titleMatch(
    "올투게더나우 허리보호대",
    "물리치료사가 판매하는 올투게더나우 다이어트 복부 스웨트 벨트",
  );

  assert.notEqual(result.confidence, "high");
  assert.deepEqual(result.missingTokens, ["허리보호대"]);
});

test("expiry-risk products are rejected even when the title otherwise matches", () => {
  const flags = collectOfferReviewFlags("앱솔루트 명작 분유 1단계 800g", {
    url: "https://smartstore.naver.com/main/products/1",
    productName: "소비기한 임박 앱솔루트 명작 분유 1단계 800g",
  });

  assert.ok(flags.includes("expiry_risk"));
});

test("unknown purchase hosts are rejected", () => {
  assert.equal(isTrustedPurchaseUrl("https://example.com/product/1"), false);
  assert.equal(
    isTrustedPurchaseUrl("https://smartstore.naver.com/main/products/1"),
    true,
  );
});

test("verified offers require shipping-included totals", () => {
  const baseOffer = {
    url: "https://brand.naver.com/example/products/1",
    price: 10_000,
    shippingFee: 3_000,
    totalPrice: 13_000,
    priceBasis: "shipping_included",
    inStock: true,
    reviewFlags: [],
  };

  assert.equal(isVerifiedOffer(baseOffer), true);
  assert.equal(
    isVerifiedOffer({
      ...baseOffer,
      shippingFee: null,
      totalPrice: null,
      priceBasis: "listed_price",
    }),
    false,
  );
});

test("offer freshness expires after the configured window", () => {
  const now = new Date("2026-07-26T00:00:00.000Z");
  assert.equal(
    isFreshOffer({ syncedAt: "2026-07-25T00:00:00.000Z" }, now),
    true,
  );
  assert.equal(
    isFreshOffer({ syncedAt: "2026-07-20T00:00:00.000Z" }, now),
    false,
  );
});

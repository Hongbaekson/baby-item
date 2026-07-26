import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appData = JSON.parse(await readFile("src/data/items.json", "utf8"));
const dataReport = JSON.parse(
  await readFile("data/data-quality-report.json", "utf8"),
);
const html = await readFile("index.html", "utf8");
const footerSource = await readFile("src/components/SiteFooter.tsx", "utf8");

test("summary and category counts are derived from the item collection", () => {
  assert.equal(appData.summary.totalItems, appData.items.length);

  for (const category of appData.summary.categories) {
    assert.equal(
      category.count,
      appData.items.filter((item) => item.categories.includes(category.name))
        .length,
      category.name,
    );
  }
});

test("the generated data report describes the current app data", () => {
  assert.equal(dataReport.generatedAt, appData.generatedAt);
  assert.equal(dataReport.summary.totalItems, appData.items.length);
  assert.equal(
    dataReport.pricing.verifiedOffers,
    appData.items.reduce((sum, item) => sum + item.purchaseOffers.length, 0),
  );
  assert.equal(
    dataReport.purchaseLinks.verified,
    appData.items.filter((item) => item.purchaseLink.status === "verified")
      .length,
  );
});

test("every current offer state matches its data tier", () => {
  for (const item of appData.items) {
    if (
      item.offerStatus.state === "available" ||
      item.offerStatus.state === "stale"
    ) {
      assert.ok(item.bestOffer, item.title);
      assert.equal(item.bestOffer.url, item.purchaseOffers[0].url, item.title);
    }
    if (item.offerStatus.state === "candidates_available") {
      assert.equal(item.bestOffer, null, item.title);
      assert.ok(item.candidateOffers.length > 0, item.title);
    }
    if (item.offerStatus.state === "needs_review") {
      assert.ok(item.rejectedOffers.length > 0, item.title);
    }
  }
});

test("only verified non-Coupang purchase links are published", () => {
  const blockedHost = (value) => {
    try {
      const host = new URL(value).hostname.replace(/^www\./, "");
      return host === "coupang.com" || host === "link.coupang.com";
    } catch {
      return false;
    }
  };

  for (const item of appData.items) {
    const purchaseEntries = [
      ...(item.partnerLinks ?? []),
      ...(item.purchaseOffers ?? []),
      ...(item.candidateOffers ?? []),
      ...(item.rejectedOffers ?? []),
    ];
    assert.equal(
      purchaseEntries.some((entry) => blockedHost(entry.url)),
      false,
      item.title,
    );

    if (item.purchaseLink.status === "verified") {
      assert.equal(item.partnerLink, item.purchaseLink.url, item.title);
      assert.equal(item.partnerLinks.length, 1, item.title);
    } else {
      assert.equal(item.partnerLink, "", item.title);
      assert.equal(item.partnerLinks.length, 0, item.title);
    }
  }
});

test("dead direct product pages are not exposed as purchase CTAs", () => {
  const publishedUrls = appData.items.flatMap((item) => [
    item.partnerLink,
    ...(item.partnerLinks ?? []).map((link) => link.url),
  ]);
  assert.equal(
    publishedUrls.some((url) => url?.includes("product.29cm.co.kr")),
    false,
  );
});

test("published product images do not request Coupang CDN", () => {
  for (const item of appData.items) {
    assert.doesNotMatch(item.imagePath, /coupangcdn\.com/i, item.title);
    assert.doesNotMatch(
      item.imageSource?.imageUrl ?? "",
      /coupangcdn\.com/i,
      item.title,
    );
  }
});

test("public metadata uses the production HTTPS origin", () => {
  assert.match(html, /https:\/\/sonleeeun\.site\//);
  assert.doesNotMatch(html, /134\.185\.110\.26|http:\/\/sonleeeun\.site/);
});

test("the application includes an affiliate disclosure", () => {
  assert.match(footerSource, /제휴 링크/);
  assert.match(footerSource, /구매 가격에는 영향을 주지 않습니다/);
});

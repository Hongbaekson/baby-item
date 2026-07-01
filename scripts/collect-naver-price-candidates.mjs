import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const APP_DATA_PATH = path.join("src", "data", "items.json");
const DEFAULT_OUTPUT_PATH = path.join("data", "price-candidates.naver.json");
const NAVER_SHOPPING_API_URL = "https://openapi.naver.com/v1/search/shop.json";
const DEFAULT_DISPLAY = 10;
const DEFAULT_DELAY_MS = 120;
const SAFE_HTTP_UPGRADE_HOSTS = new Set([
  "brand.naver.com",
  "m.shopping.naver.com",
  "openapi.naver.com",
  "search.shopping.naver.com",
  "shopping.naver.com",
  "shopping.phinf.naver.net",
  "smartstore.naver.com",
]);
const STOPWORDS = new Set([
  "현재",
  "품절",
  "단품",
  "정품",
  "공식",
  "전용",
  "세트",
  "개",
  "용",
]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const outputPath = getArgValue("--output") ?? process.env.PRICE_CANDIDATE_OUTPUT ?? DEFAULT_OUTPUT_PATH;
const display = clampNumber(getArgNumber("--display", Number(process.env.NAVER_PRICE_DISPLAY) || DEFAULT_DISPLAY), 1, 100);
const limit = getArgNumber("--limit", Number(process.env.PRICE_SYNC_LIMIT) || 0);
const delayMs = Math.max(0, getArgNumber("--delay-ms", Number(process.env.NAVER_PRICE_DELAY_MS) || DEFAULT_DELAY_MS));

function getArgValue(name) {
  const prefix = `${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));

  return match ? match.slice(prefix.length) : null;
}

function getArgNumber(name, fallback) {
  const value = getArgValue(name);

  if (value === null) {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<\/?b>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function normalizeText(value) {
  return stripHtml(value)
    .toLowerCase()
    .replace(/\([^)]*\b품절\b[^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(value) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function matchConfidence(itemTitle, candidate) {
  const tokens = significantTokens(itemTitle);
  const candidateText = normalizeText(
    [
      candidate.title,
      candidate.brand,
      candidate.maker,
      candidate.mallName,
      candidate.category1,
      candidate.category2,
      candidate.category3,
      candidate.category4,
    ].join(" "),
  );

  if (tokens.length === 0 || candidateText.length === 0) {
    return "low";
  }

  const matched = tokens.filter((token) => candidateText.includes(token));
  const coverage = matched.length / tokens.length;
  const hasDistinctiveToken = matched.some((token) => token.length >= 3 || /[0-9]/.test(token));

  if (coverage === 1 && hasDistinctiveToken) {
    return "high";
  }

  if (coverage >= 0.6 && hasDistinctiveToken) {
    return "medium";
  }

  return "low";
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (url.protocol === "http:" && SAFE_HTTP_UPGRADE_HOSTS.has(host)) {
      url.protocol = "https:";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function isLikelyActiveProduct(productType) {
  const type = Number(productType);

  return type === 1 || type === 2 || type === 3;
}

function normalizeOffer(item, rawOffer, syncedAt) {
  const price = Number(rawOffer.lprice);
  const url = normalizeUrl(rawOffer.link);
  const productType = Number(rawOffer.productType);
  const activeProduct = isLikelyActiveProduct(productType);

  return {
    url,
    imageUrl: normalizeUrl(rawOffer.image),
    platform: "naver",
    mallName: stripHtml(rawOffer.mallName) || "네이버 쇼핑",
    price: Number.isFinite(price) ? price : null,
    shippingFee: null,
    totalPrice: null,
    inStock: activeProduct,
    stockStatus: activeProduct ? "listed_by_naver_search" : "not_active_product_type",
    source: "naver-shopping-search-api",
    syncedAt,
    matchConfidence: matchConfidence(item.title, rawOffer),
    productName: stripHtml(rawOffer.title),
    productId: String(rawOffer.productId ?? ""),
    brand: stripHtml(rawOffer.brand),
    maker: stripHtml(rawOffer.maker),
    categoryPath: [rawOffer.category1, rawOffer.category2, rawOffer.category3, rawOffer.category4]
      .map(stripHtml)
      .filter(Boolean),
    note: "네이버 쇼핑 검색 API 후보입니다. API 응답에 배송비와 결제 단계 재고가 없어 자동 반영 전 별도 확인이 필요합니다.",
    requiresReview: ["shipping_fee_missing", "stock_status_inferred"],
  };
}

function createSearchUrl(query) {
  const url = new URL(NAVER_SHOPPING_API_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(display));
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "asc");
  url.searchParams.set("exclude", "used:rental:cbshop");

  return url;
}

async function fetchNaverOffers(item, clientId, clientSecret) {
  const query = normalizeText(item.title);
  const response = await fetch(createSearchUrl(query), {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Naver shopping API failed for ${item.id}: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const syncedAt = new Date().toISOString();

  return {
    itemId: item.id,
    title: item.title,
    query,
    syncedAt,
    offers: (payload.items ?? []).map((offer) => normalizeOffer(item, offer, syncedAt)),
  };
}

async function main() {
  const appData = JSON.parse(await readFile(APP_DATA_PATH, "utf8"));
  const items = (appData.items ?? []).slice(0, limit > 0 ? limit : undefined);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          outputPath,
          display,
          itemCount: items.length,
          queries: items.map((item) => ({ itemId: item.id, title: item.title, query: normalizeText(item.title) })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("NAVER_CLIENT_ID and NAVER_CLIENT_SECRET are required.");
  }

  const candidateItems = [];

  for (const [index, item] of items.entries()) {
    candidateItems.push(await fetchNaverOffers(item, clientId, clientSecret));

    if (delayMs > 0 && index < items.length - 1) {
      await sleep(delayMs);
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: "naver-shopping-search-api",
    display,
    items: candidateItems,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        outputPath,
        items: candidateItems.length,
        offers: candidateItems.reduce((sum, item) => sum + item.offers.length, 0),
        note: "Naver Search API candidates need shipping fee and stock verification before strict auto-apply.",
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

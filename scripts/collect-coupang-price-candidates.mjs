import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const APP_DATA_PATH = path.join("src", "data", "items.json");
const DEFAULT_OUTPUT_PATH = path.join("data", "price-candidates.coupang.json");
const DEFAULT_API_HOST = "api-gateway.coupang.com";
const DEFAULT_SEARCH_PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search";
const DEFAULT_DISPLAY = 10;
const DEFAULT_DELAY_MS = 180;
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
const display = clampNumber(getArgNumber("--display", Number(process.env.COUPANG_PRICE_DISPLAY) || DEFAULT_DISPLAY), 1, 100);
const limit = getArgNumber("--limit", Number(process.env.PRICE_SYNC_LIMIT) || 0);
const delayMs = Math.max(0, getArgNumber("--delay-ms", Number(process.env.COUPANG_PRICE_DELAY_MS) || DEFAULT_DELAY_MS));

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
      candidate.productName,
      candidate.brand,
      candidate.maker,
      candidate.mallName,
      candidate.categoryName,
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

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(String(value).replace(/,/g, ""));

  return Number.isFinite(number) ? number : null;
}

function firstValue(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== "");
}

function normalizeUrl(value) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (url.protocol === "http:" && (host.endsWith("coupang.com") || host.endsWith("coupangcdn.com"))) {
      url.protocol = "https:";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function createEndpointUrl(query) {
  const host = process.env.COUPANG_API_HOST ?? DEFAULT_API_HOST;
  const pathOrUrl =
    getArgValue("--path") ??
    process.env.COUPANG_SEARCH_PATH ??
    process.env.COUPANG_PRODUCTS_SEARCH_PATH ??
    DEFAULT_SEARCH_PATH;
  const endpoint = pathOrUrl.startsWith("https://")
    ? new URL(pathOrUrl)
    : new URL(`https://${host}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`);

  endpoint.searchParams.set("keyword", query);
  endpoint.searchParams.set("limit", String(display));

  const subId = process.env.COUPANG_SUB_ID;

  if (subId) {
    endpoint.searchParams.set("subId", subId);
  }

  return endpoint;
}

function signedDate() {
  const now = new Date();
  const year = String(now.getUTCFullYear()).slice(-2);
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  const minute = String(now.getUTCMinutes()).padStart(2, "0");
  const second = String(now.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

function createAuthorization(method, endpoint, accessKey, secretKey) {
  const date = signedDate();
  const queryString = endpoint.searchParams.toString();
  const message = `${date}${method}${endpoint.pathname}${queryString}`;
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${date}, signature=${signature}`;
}

function extractOfferNodes(payload) {
  const offers = [];
  const seen = new Set();

  function looksLikeOffer(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const hasName = Boolean(value.productName ?? value.displayProductName ?? value.sellerProductName ?? value.title);
    const hasPrice = Boolean(value.productPrice ?? value.salePrice ?? value.price ?? value.finalPrice);
    const hasUrl = Boolean(value.productUrl ?? value.url ?? value.link ?? value.landingUrl);
    const hasStockSignal = value.isOutOfStock !== undefined || value.inStock !== undefined || value.maximumBuyCount !== undefined;

    return hasName && (hasPrice || hasUrl || hasStockSignal);
  }

  function visit(value, depth = 0) {
    if (depth > 8 || value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry, depth + 1);
      }

      return;
    }

    if (typeof value !== "object") {
      return;
    }

    if (looksLikeOffer(value)) {
      const key = [
        value.productId,
        value.vendorItemId,
        value.sellerProductId,
        value.productUrl,
        value.productName,
      ].join("|");

      if (!seen.has(key)) {
        offers.push(value);
        seen.add(key);
      }
    }

    for (const entry of Object.values(value)) {
      visit(entry, depth + 1);
    }
  }

  visit(payload);

  return offers;
}

function getShippingFee(rawOffer, price) {
  const explicitShipping = toNumber(
    firstValue(rawOffer.shippingFee, rawOffer.deliveryFee, rawOffer.deliveryCharge, rawOffer.shipping),
  );

  if (explicitShipping !== null) {
    return explicitShipping;
  }

  const deliveryChargeType = String(rawOffer.deliveryChargeType ?? "").toUpperCase();
  const freeShipOverAmount = toNumber(rawOffer.freeShipOverAmount);

  if (
    rawOffer.isFreeShipping === true ||
    rawOffer.freeShipping === true ||
    deliveryChargeType === "FREE" ||
    (freeShipOverAmount !== null && price !== null && price >= freeShipOverAmount)
  ) {
    return 0;
  }

  return null;
}

function isInStock(rawOffer, price, url) {
  if (rawOffer.isOutOfStock === true || rawOffer.soldOut === true || rawOffer.inStock === false) {
    return false;
  }

  const quantity = toNumber(
    firstValue(rawOffer.maximumBuyCount, rawOffer.stockQuantity, rawOffer.quantity, rawOffer.inventoryQuantity),
  );

  if (quantity === 0) {
    return false;
  }

  if (rawOffer.isOutOfStock === false || rawOffer.inStock === true || quantity === null || quantity > 0) {
    const statusText = normalizeText(
      [
        rawOffer.status,
        rawOffer.statusName,
        rawOffer.stockStatus,
        rawOffer.saleStatus,
        rawOffer.displayStatus,
      ].join(" "),
    );
    const unavailable = ["품절", "판매중지", "상품삭제", "삭제", "종료", "반려", "soldout", "unavailable", "out of stock"];

    if (unavailable.some((token) => statusText.includes(token))) {
      return false;
    }

    if (rawOffer.isOutOfStock === false || rawOffer.inStock === true || quantity > 0) {
      return true;
    }

    return Boolean(price && price > 0 && url);
  }

  return false;
}

function normalizeOffer(item, rawOffer, syncedAt) {
  const productName = stripHtml(
    firstValue(rawOffer.productName, rawOffer.displayProductName, rawOffer.sellerProductName, rawOffer.title),
  );
  const url = normalizeUrl(
    firstValue(rawOffer.productUrl, rawOffer.url, rawOffer.link, rawOffer.landingUrl, rawOffer.mobileUrl),
  );
  const imageUrl = normalizeUrl(
    firstValue(rawOffer.productImage, rawOffer.imageUrl, rawOffer.image, rawOffer.thumbnail, rawOffer.cdnPath),
  );
  const price = toNumber(firstValue(rawOffer.productPrice, rawOffer.salePrice, rawOffer.price, rawOffer.finalPrice));
  const shippingFee = getShippingFee(rawOffer, price);
  const totalPrice = price === null || shippingFee === null ? null : price + shippingFee;

  return {
    url,
    imageUrl,
    platform: "coupang",
    mallName: stripHtml(firstValue(rawOffer.mallName, rawOffer.vendorName, rawOffer.sellerName)) || "쿠팡",
    price,
    shippingFee,
    totalPrice,
    inStock: isInStock(rawOffer, price, url),
    stockStatus:
      rawOffer.isOutOfStock === false || rawOffer.inStock === true
        ? "available_by_coupang_api"
        : "active_candidate_by_coupang_api",
    source: "coupang-open-api",
    syncedAt,
    matchConfidence: matchConfidence(item.title, {
      ...rawOffer,
      productName,
      mallName: "쿠팡",
    }),
    productName,
    productId: String(firstValue(rawOffer.productId, rawOffer.vendorItemId, rawOffer.sellerProductId) ?? ""),
    brand: stripHtml(rawOffer.brand),
    maker: stripHtml(rawOffer.maker),
    categoryPath: [rawOffer.categoryName, rawOffer.category1, rawOffer.category2, rawOffer.category3, rawOffer.category4]
      .map(stripHtml)
      .filter(Boolean),
    note:
      shippingFee === null
        ? "쿠팡 API 후보입니다. 배송비가 없어 자동 반영 전 보강이 필요합니다."
        : "쿠팡 API 후보입니다.",
    requiresReview: shippingFee === null ? ["shipping_fee_missing"] : [],
  };
}

async function fetchCoupangOffers(item, accessKey, secretKey) {
  const query = normalizeText(item.title);
  const endpoint = createEndpointUrl(query);
  const authorization = createAuthorization("GET", endpoint, accessKey, secretKey);
  const response = await fetch(endpoint, {
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json;charset=UTF-8",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Coupang API failed for ${item.id}: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const syncedAt = new Date().toISOString();

  return {
    itemId: item.id,
    title: item.title,
    query,
    syncedAt,
    offers: extractOfferNodes(payload).map((offer) => normalizeOffer(item, offer, syncedAt)),
  };
}

async function main() {
  const appData = JSON.parse(await readFile(APP_DATA_PATH, "utf8"));
  const items = (appData.items ?? []).slice(0, limit > 0 ? limit : undefined);
  const endpoint = createEndpointUrl("example");

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          outputPath,
          display,
          endpointHost: endpoint.hostname,
          endpointPath: endpoint.pathname,
          itemCount: items.length,
          queries: items.map((item) => ({ itemId: item.id, title: item.title, query: normalizeText(item.title) })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error("COUPANG_ACCESS_KEY and COUPANG_SECRET_KEY are required.");
  }

  const candidateItems = [];

  for (const [index, item] of items.entries()) {
    candidateItems.push(await fetchCoupangOffers(item, accessKey, secretKey));

    if (delayMs > 0 && index < items.length - 1) {
      await sleep(delayMs);
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: "coupang-open-api",
    endpointPath: endpoint.pathname,
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

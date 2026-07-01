import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const RAW_INPUT_PATH = path.join("data", "items.raw.json");
const NORMALIZED_OUTPUT_PATH = path.join("data", "items.normalized.json");

function parsePriceText(priceText) {
  const normalized = String(priceText ?? "").replace(/[^\d]/g, "");

  if (!normalized) {
    return null;
  }

  return Number(normalized);
}

function getDraftReasons(item) {
  const reasons = [];

  if (!item.extracted.title) {
    reasons.push("empty_title");
  }

  return reasons;
}

function normalizeItem(item) {
  const draftReasons = getDraftReasons(item);
  const publicationStatus = draftReasons.length > 0 ? "draft" : "published";
  const category = item.extracted.category || item.groupCategory || "";

  return {
    id: item.id,
    source: {
      notionPageId: item.id,
      originalOrder: item.originalOrder,
      groupCategory: item.groupCategory,
      createdTime: item.notion.createdTime,
      lastEditedTime: item.notion.lastEditedTime,
    },
    publicationStatus,
    draftReasons,
    title: item.extracted.title,
    category,
    categories: category ? [category] : [],
    partnerLink: item.extracted.partnerLink,
    priceText: item.extracted.price,
    price: parsePriceText(item.extracted.price),
    status: item.extracted.status,
    memo: item.extracted.memo,
    image: item.extracted.image,
  };
}

async function main() {
  const raw = JSON.parse(await readFile(RAW_INPUT_PATH, "utf8"));
  const items = raw.items.map(normalizeItem);
  const publishedItems = items.filter((item) => item.publicationStatus === "published");
  const draftItems = items.filter((item) => item.publicationStatus === "draft");

  const output = {
    normalizedAt: new Date().toISOString(),
    source: {
      rawFile: RAW_INPUT_PATH,
      notion: raw.source,
    },
    summary: {
      totalItems: items.length,
      publishedItems: publishedItems.length,
      draftItems: draftItems.length,
      emptyTitleDraftItems: draftItems.filter((item) =>
        item.draftReasons.includes("empty_title"),
      ).length,
      totalCategories: raw.categories.length,
      missingPartnerLinkItems: items.filter((item) => !item.partnerLink).length,
      missingPriceItems: items.filter((item) => item.price === null).length,
      itemsWithImage: items.filter((item) => item.image.hasImage).length,
    },
    categories: raw.categories,
    items,
  };

  await writeFile(NORMALIZED_OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Wrote ${NORMALIZED_OUTPUT_PATH}`);
  console.log(JSON.stringify(output.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

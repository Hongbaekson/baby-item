import rawAppData from "../data/items.json";
import type { AppData, Item } from "../types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid app data: ${message}`);
  }
}

function validateItem(item: unknown, index: number): asserts item is Item {
  assert(
    typeof item === "object" && item !== null,
    `items[${index}] must be an object`,
  );
  const candidate = item as Partial<Item>;
  assert(
    typeof candidate.id === "string" && candidate.id.length > 0,
    `items[${index}].id`,
  );
  assert(
    typeof candidate.title === "string" && candidate.title.trim().length > 0,
    `items[${index}].title`,
  );
  assert(Array.isArray(candidate.categories), `items[${index}].categories`);
  assert(
    typeof candidate.partnerLink === "string",
    `items[${index}].partnerLink`,
  );
  assert(
    typeof candidate.purchaseLink?.status === "string",
    `items[${index}].purchaseLink`,
  );
  assert(Array.isArray(candidate.partnerLinks), `items[${index}].partnerLinks`);
  assert(
    Array.isArray(candidate.purchaseOffers),
    `items[${index}].purchaseOffers`,
  );
  assert(
    Array.isArray(candidate.candidateOffers),
    `items[${index}].candidateOffers`,
  );
  assert(
    Array.isArray(candidate.rejectedOffers),
    `items[${index}].rejectedOffers`,
  );
  assert(
    typeof candidate.offerStatus?.state === "string",
    `items[${index}].offerStatus`,
  );
  assert(typeof candidate.imagePath === "string", `items[${index}].imagePath`);
  assert(
    Array.isArray(candidate.dataQuality?.issues),
    `items[${index}].dataQuality`,
  );
}

function parseAppData(value: unknown): AppData {
  assert(typeof value === "object" && value !== null, "root must be an object");
  const candidate = value as Partial<AppData>;
  assert(typeof candidate.generatedAt === "string", "generatedAt");
  assert(typeof candidate.site?.name === "string", "site.name");
  assert(Number.isInteger(candidate.summary?.totalItems), "summary.totalItems");
  assert(Array.isArray(candidate.summary?.categories), "summary.categories");
  assert(Array.isArray(candidate.items), "items");
  candidate.items.forEach(validateItem);
  assert(
    candidate.summary.totalItems === candidate.items.length,
    "summary.totalItems must match items.length",
  );
  return candidate as AppData;
}

export const data = parseAppData(rawAppData);

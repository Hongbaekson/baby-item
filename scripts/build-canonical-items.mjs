import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const NORMALIZED_INPUT_PATH = path.join("data", "items.normalized.json");
const CANONICAL_OUTPUT_PATH = path.join("data", "items.canonical.json");

const CURATED_GROUPS = [
  {
    key: "malanghani-white-noise",
    displayTitle: "말랑하니 백색소음기",
    titles: ["말랑하니 백색소음기", "말랑하니 백색소음"],
  },
  {
    key: "magiccan-hippo-27l-trash-bin",
    displayTitle: "매직캔 히포 2 크롬 27L 휴지통",
    titles: ["매직캔 휴지통", "매직캔 히포 2 크롬 27L 휴지통"],
  },
  {
    key: "upang-signature-2-bottle-sterilizer",
    displayTitle: "유팡 시그니처 2 젖병 소독기",
    titles: ["유팡 시그니처 2 젖병 소독기", "유팡 시그니처 2 젖병 UV 살균"],
  },
];

function normalizeTitle(title) {
  return String(title ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[()[\]{}]/g, "")
    .replace(/[×x&·,._\-\s]/g, "")
    .trim();
}

function buildCuratedAliasMap() {
  const aliases = new Map();

  for (const group of CURATED_GROUPS) {
    for (const title of group.titles) {
      aliases.set(normalizeTitle(title), {
        key: group.key,
        displayTitle: group.displayTitle,
        matchType: "curated_alias",
      });
    }
  }

  return aliases;
}

function stableIdForKey(key) {
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 10);
  return `item-${hash}`;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = keyFn(item);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function firstBy(items, predicate) {
  return items.find(predicate) ?? null;
}

function selectCanonicalTitle(sourceItems, canonicalDisplayTitle) {
  if (canonicalDisplayTitle) {
    return canonicalDisplayTitle;
  }

  const withPrice = firstBy(sourceItems, (item) => item.price !== null);

  if (withPrice?.title) {
    return withPrice.title;
  }

  return sourceItems[0].title;
}

function selectPrice(sourceItems) {
  const withPrice = firstBy(sourceItems, (item) => item.price !== null);

  return {
    price: withPrice?.price ?? null,
    priceText: withPrice?.priceText ?? "",
    sourceItemId: withPrice?.id ?? null,
  };
}

function selectImage(sourceItems) {
  const withImage = firstBy(sourceItems, (item) => item.image?.hasImage);

  return withImage?.image ?? {
    hasImage: false,
    filePropertyRaw: null,
    socialMediaImagePreviewUrl: "",
  };
}

function selectMemo(sourceItems) {
  const withMemo = firstBy(sourceItems, (item) => item.memo);

  return withMemo?.memo ?? "";
}

function buildCanonicalItem(group) {
  const sourceItems = [...group.items].sort(
    (a, b) => (a.source.originalOrder ?? 9999) - (b.source.originalOrder ?? 9999),
  );
  const categories = uniqueBy(
    sourceItems.flatMap((item) => item.categories),
    (category) => category,
  );
  const partnerLinks = uniqueBy(
    sourceItems
      .filter((item) => item.partnerLink)
      .map((item) => ({
        url: item.partnerLink,
        sourceItemId: item.id,
        category: item.category,
      })),
    (link) => link.url,
  );
  const selectedPrice = selectPrice(sourceItems);

  return {
    id: stableIdForKey(group.key),
    canonicalKey: group.key,
    canonicalMatchType: group.matchType,
    publicationStatus: "published",
    title: selectCanonicalTitle(sourceItems, group.displayTitle),
    categories,
    primaryCategory: categories[0] ?? "",
    partnerLink: partnerLinks[0]?.url ?? "",
    partnerLinks,
    price: selectedPrice.price,
    priceText: selectedPrice.priceText,
    priceSourceItemId: selectedPrice.sourceItemId,
    memo: selectMemo(sourceItems),
    image: selectImage(sourceItems),
    sourceItemIds: sourceItems.map((item) => item.id),
    sourceItems: sourceItems.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      partnerLink: item.partnerLink,
      price: item.price,
      priceText: item.priceText,
      originalOrder: item.source.originalOrder,
    })),
  };
}

async function main() {
  const normalized = JSON.parse(await readFile(NORMALIZED_INPUT_PATH, "utf8"));
  const curatedAliases = buildCuratedAliasMap();
  const groups = new Map();
  const publishedItems = normalized.items.filter(
    (item) => item.publicationStatus === "published",
  );
  const draftItems = normalized.items.filter((item) => item.publicationStatus === "draft");

  for (const item of publishedItems) {
    const normalizedTitle = normalizeTitle(item.title);
    const alias = curatedAliases.get(normalizedTitle);
    const key = alias?.key ?? `title:${normalizedTitle}`;
    const matchType = alias?.matchType ?? "normalized_title";

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        matchType,
        displayTitle: alias?.displayTitle ?? "",
        items: [],
      });
    }

    groups.get(key).items.push(item);
  }

  const canonicalItems = Array.from(groups.values())
    .map(buildCanonicalItem)
    .sort((a, b) => {
      const firstA = Math.min(...a.sourceItems.map((item) => item.originalOrder ?? 9999));
      const firstB = Math.min(...b.sourceItems.map((item) => item.originalOrder ?? 9999));

      return firstA - firstB;
    });

  const duplicateGroups = canonicalItems.filter((item) => item.sourceItemIds.length > 1);
  const output = {
    canonicalizedAt: new Date().toISOString(),
    source: {
      normalizedFile: NORMALIZED_INPUT_PATH,
      notion: normalized.source.notion,
    },
    summary: {
      sourcePublishedItems: publishedItems.length,
      canonicalPublishedItems: canonicalItems.length,
      mergedDuplicateGroups: duplicateGroups.length,
      mergedSourceItemCount: duplicateGroups.reduce(
        (total, item) => total + item.sourceItemIds.length,
        0,
      ),
      draftItems: draftItems.length,
      totalCategories: normalized.categories.length,
      missingPrimaryPartnerLinkItems: canonicalItems.filter((item) => !item.partnerLink).length,
      missingPriceItems: canonicalItems.filter((item) => item.price === null).length,
      itemsWithImage: canonicalItems.filter((item) => item.image.hasImage).length,
    },
    canonicalRules: {
      automatic: "same normalized title",
      curatedGroups: CURATED_GROUPS,
    },
    categories: normalized.categories,
    items: canonicalItems,
    draftItems,
  };

  await writeFile(CANONICAL_OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Wrote ${CANONICAL_OUTPUT_PATH}`);
  console.log(JSON.stringify(output.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

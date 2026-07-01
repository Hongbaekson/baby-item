import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_INPUT_PATHS = [
  path.join("data", "price-candidates.coupang.json"),
  path.join("data", "price-candidates.naver.json"),
];
const DEFAULT_OUTPUT_PATH = path.join("data", "price-candidates.json");
const args = process.argv.slice(2);
const outputPath = getArgValue("--output") ?? DEFAULT_OUTPUT_PATH;
const inputPaths = args.filter((arg) => !arg.startsWith("--"));

function getArgValue(name) {
  const prefix = `${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));

  return match ? match.slice(prefix.length) : null;
}

function flattenCandidateInput(input) {
  if (Array.isArray(input.items)) {
    return input.items.map((entry) => ({
      itemId: entry.itemId ?? entry.id,
      title: entry.title,
      query: entry.query ?? null,
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
        query: offer.query ?? null,
        syncedAt: offer.syncedAt ?? input.syncedAt ?? input.generatedAt ?? null,
        offers: [],
      };

      entry.offers.push(offer);
      byItemId.set(itemId, entry);
    }

    return [...byItemId.values()];
  }

  return [];
}

function offerKey(offer) {
  return [
    offer.platform,
    offer.url,
    offer.productId,
    offer.productName,
    offer.price,
    offer.totalPrice,
  ].join("|");
}

async function main() {
  const sources = inputPaths.length > 0 ? inputPaths : DEFAULT_INPUT_PATHS;
  const byItemId = new Map();
  const usedSources = [];
  let skippedSources = 0;

  for (const sourcePath of sources) {
    if (!existsSync(sourcePath)) {
      skippedSources += 1;
      continue;
    }

    const input = JSON.parse(await readFile(sourcePath, "utf8"));
    usedSources.push({
      path: sourcePath,
      source: input.source ?? "unknown",
      generatedAt: input.generatedAt ?? null,
    });

    for (const entry of flattenCandidateInput(input)) {
      if (!entry.itemId) {
        continue;
      }

      const merged = byItemId.get(entry.itemId) ?? {
        itemId: entry.itemId,
        title: entry.title,
        queries: [],
        syncedAt: entry.syncedAt,
        offers: [],
      };
      const seen = new Set(merged.offers.map(offerKey));

      if (entry.query && !merged.queries.includes(entry.query)) {
        merged.queries.push(entry.query);
      }

      for (const offer of entry.offers ?? []) {
        const key = offerKey(offer);

        if (!seen.has(key)) {
          merged.offers.push(offer);
          seen.add(key);
        }
      }

      byItemId.set(entry.itemId, merged);
    }
  }

  const items = [...byItemId.values()].sort((a, b) => a.itemId.localeCompare(b.itemId));
  const output = {
    generatedAt: new Date().toISOString(),
    source: "merged-price-candidates",
    sources: usedSources,
    items,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        outputPath,
        sources: usedSources.length,
        skippedSources,
        items: items.length,
        offers: items.reduce((sum, item) => sum + item.offers.length, 0),
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

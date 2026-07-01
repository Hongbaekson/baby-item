import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const APP_DATA_PATH = path.join("src", "data", "items.json");
const DEFAULT_CANDIDATES_PATH = path.join("data", "price-candidates.naver.json");
const ALLOWED_IMAGE_HOSTS = new Set([
  "image1.coupangcdn.com",
  "image2.coupangcdn.com",
  "image3.coupangcdn.com",
  "image4.coupangcdn.com",
  "image5.coupangcdn.com",
  "image6.coupangcdn.com",
  "image7.coupangcdn.com",
  "image8.coupangcdn.com",
  "image9.coupangcdn.com",
  "image10.coupangcdn.com",
  "thumbnail.coupangcdn.com",
  "shopping.phinf.naver.net",
  "shopping-phinf.pstatic.net",
  "shop-phinf.pstatic.net",
]);

const args = process.argv.slice(2);
const candidatesPath = args.find((arg) => !arg.startsWith("--")) ?? DEFAULT_CANDIDATES_PATH;
const allowMediumConfidence = args.includes("--allow-medium");
const overwriteExisting = args.includes("--overwrite");

function isPlaceholderImage(imagePath) {
  return String(imagePath ?? "").startsWith("/images/placeholders/");
}

function normalizeConfidence(value) {
  const confidence = String(value ?? "low").toLowerCase();

  if (confidence === "high" || confidence === "medium") {
    return confidence;
  }

  return "low";
}

function remoteImageHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeHttpsUrl(value) {
  try {
    const url = new URL(String(value ?? ""));

    if (url.protocol !== "https:") {
      return null;
    }

    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    return ALLOWED_IMAGE_HOSTS.has(host) ? url.toString() : null;
  } catch {
    return null;
  }
}

function flattenCandidateInput(input) {
  if (Array.isArray(input.items)) {
    return input.items.map((entry) => ({
      itemId: entry.itemId ?? entry.id,
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
        syncedAt: offer.syncedAt ?? input.syncedAt ?? input.generatedAt ?? null,
        offers: [],
      };

      entry.offers.push(offer);
      byItemId.set(itemId, entry);
    }

    return [...byItemId.values()];
  }

  throw new Error("Candidate file must contain an items[] or offers[] array.");
}

function normalizeImageCandidate(rawOffer, fallbackSyncedAt) {
  const imageUrl = normalizeHttpsUrl(rawOffer.imageUrl ?? rawOffer.image ?? rawOffer.thumbnail);

  if (!imageUrl) {
    return null;
  }

  const matchConfidence = normalizeConfidence(rawOffer.matchConfidence ?? rawOffer.confidence);

  if (matchConfidence !== "high" && !(allowMediumConfidence && matchConfidence === "medium")) {
    return null;
  }

  return {
    imageUrl,
    matchConfidence,
    platform: rawOffer.platform ?? rawOffer.channel ?? null,
    mallName: rawOffer.mallName ?? rawOffer.mall ?? rawOffer.seller ?? null,
    productName: rawOffer.productName ?? rawOffer.name ?? rawOffer.title ?? null,
    source: rawOffer.source ?? "price-candidate",
    syncedAt: rawOffer.syncedAt ?? fallbackSyncedAt ?? null,
  };
}

function sortImageCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    const confidenceRank = { high: 0, medium: 1, low: 2 };
    const confidenceDiff =
      (confidenceRank[a.matchConfidence] ?? 99) - (confidenceRank[b.matchConfidence] ?? 99);

    if (confidenceDiff !== 0) {
      return confidenceDiff;
    }

    return remoteImageHost(a.imageUrl).localeCompare(remoteImageHost(b.imageUrl));
  });
}

function recalculateStatus(dataQuality) {
  const issues = dataQuality.issues ?? [];
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    ...dataQuality,
    status:
      errorCount > 0 ? "needs_review" : warningCount > 0 ? "usable_with_warnings" : "ready",
    errorCount,
    warningCount,
    issues,
  };
}

function recalculateSummary(appData) {
  const items = appData.items ?? [];

  appData.summary = {
    ...appData.summary,
    readyItems: items.filter((item) => item.dataQuality?.status === "ready").length,
    usableWithWarningsItems: items.filter(
      (item) => item.dataQuality?.status === "usable_with_warnings",
    ).length,
    needsReviewItems: items.filter((item) => item.dataQuality?.status === "needs_review").length,
  };
}

async function main() {
  const appData = JSON.parse(await readFile(APP_DATA_PATH, "utf8"));
  const candidateInput = JSON.parse(await readFile(candidatesPath, "utf8"));
  const candidateEntries = flattenCandidateInput(candidateInput);
  const itemsById = new Map((appData.items ?? []).map((item) => [item.id, item]));
  let applied = 0;
  let skippedExistingImage = 0;
  let skippedNoCandidate = 0;

  for (const entry of candidateEntries) {
    const item = itemsById.get(entry.itemId);

    if (!item) {
      continue;
    }

    if (!overwriteExisting && !isPlaceholderImage(item.imagePath)) {
      skippedExistingImage += 1;
      continue;
    }

    const candidates = sortImageCandidates(
      (entry.offers ?? [])
        .map((offer) => normalizeImageCandidate(offer, entry.syncedAt))
        .filter(Boolean),
    );
    const bestImage = candidates[0];

    if (!bestImage) {
      skippedNoCandidate += 1;
      continue;
    }

    item.imagePath = bestImage.imageUrl;
    item.hasOriginalImage = true;
    item.imageSource = bestImage;

    if (item.dataQuality?.issues) {
      item.dataQuality.issues = item.dataQuality.issues.filter(
        (issue) => issue.code !== "missing_image",
      );
      item.dataQuality = recalculateStatus(item.dataQuality);
    }

    applied += 1;
  }

  appData.generatedAt = new Date().toISOString();
  appData.imageSync = {
    candidateFile: candidatesPath,
    appliedAt: new Date().toISOString(),
    applied,
    allowMediumConfidence,
    overwriteExisting,
    skippedExistingImage,
    skippedNoCandidate,
  };

  recalculateSummary(appData);

  await writeFile(APP_DATA_PATH, `${JSON.stringify(appData, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        candidateFile: candidatesPath,
        applied,
        allowMediumConfidence,
        overwriteExisting,
        skippedExistingImage,
        skippedNoCandidate,
        remainingPlaceholderImages: (appData.items ?? []).filter((item) =>
          isPlaceholderImage(item.imagePath),
        ).length,
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

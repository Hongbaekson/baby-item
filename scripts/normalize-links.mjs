import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CANONICAL_INPUT_PATH = path.join("data", "items.canonical.json");
const LINKS_OUTPUT_PATH = path.join("data", "items.links.json");

function hasProtocol(url) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
}

function looksLikeDomainPath(url) {
  return /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:\/|$)/i.test(url);
}

function normalizeExternalUrl(rawUrl) {
  const originalUrl = String(rawUrl ?? "").trim();

  if (!originalUrl) {
    return {
      url: "",
      originalUrl,
      wasNormalized: false,
      status: "missing",
      reason: "empty_url",
    };
  }

  let url = originalUrl;
  let reason = "";

  if (url.startsWith("//")) {
    url = `https:${url}`;
    reason = "protocol_relative_url";
  } else if (!hasProtocol(url) && looksLikeDomainPath(url)) {
    url = `https://${url}`;
    reason = "missing_protocol";
  }

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol === "http:") {
      parsedUrl.protocol = "https:";
      url = parsedUrl.toString();
      reason = reason ? `${reason},upgraded_http_to_https` : "upgraded_http_to_https";
    }

    return {
      url,
      originalUrl,
      wasNormalized: url !== originalUrl,
      status: "valid",
      reason,
    };
  } catch {
    return {
      url,
      originalUrl,
      wasNormalized: url !== originalUrl,
      status: "invalid",
      reason: reason || "invalid_url",
    };
  }
}

function normalizePartnerLinks(partnerLinks) {
  return partnerLinks.map((link) => {
    const normalized = normalizeExternalUrl(link.url);

    return {
      ...link,
      url: normalized.url,
      originalUrl: normalized.originalUrl,
      wasNormalized: normalized.wasNormalized,
      linkStatus: normalized.status,
      normalizationReason: normalized.reason,
    };
  });
}

function normalizeSourceItems(sourceItems) {
  return sourceItems.map((sourceItem) => {
    const normalized = normalizeExternalUrl(sourceItem.partnerLink);

    return {
      ...sourceItem,
      partnerLink: normalized.url,
      originalPartnerLink: normalized.originalUrl,
      partnerLinkWasNormalized: normalized.wasNormalized,
      partnerLinkStatus: normalized.status,
      partnerLinkNormalizationReason: normalized.reason,
    };
  });
}

function normalizeItem(item) {
  const partnerLinks = normalizePartnerLinks(item.partnerLinks);
  const primaryLink = partnerLinks[0] ?? normalizeExternalUrl(item.partnerLink);

  return {
    ...item,
    partnerLink: primaryLink.url,
    originalPartnerLink: primaryLink.originalUrl,
    partnerLinkWasNormalized: primaryLink.wasNormalized,
    partnerLinkStatus: primaryLink.linkStatus ?? primaryLink.status,
    partnerLinkNormalizationReason:
      primaryLink.normalizationReason ?? primaryLink.reason,
    partnerLinks,
    sourceItems: normalizeSourceItems(item.sourceItems),
  };
}

function collectLinkStats(items) {
  const allLinks = items.flatMap((item) => [
    {
      itemId: item.id,
      title: item.title,
      scope: "primary",
      url: item.partnerLink,
      originalUrl: item.originalPartnerLink,
      status: item.partnerLinkStatus,
      wasNormalized: item.partnerLinkWasNormalized,
      reason: item.partnerLinkNormalizationReason,
    },
    ...item.partnerLinks.map((link) => ({
      itemId: item.id,
      title: item.title,
      scope: "partnerLinks",
      url: link.url,
      originalUrl: link.originalUrl,
      status: link.linkStatus,
      wasNormalized: link.wasNormalized,
      reason: link.normalizationReason,
    })),
  ]);

  return {
    totalCheckedLinks: allLinks.length,
    normalizedLinks: allLinks.filter((link) => link.wasNormalized).length,
    invalidLinks: allLinks.filter((link) => link.status === "invalid").length,
    missingLinks: allLinks.filter((link) => link.status === "missing").length,
    normalizedDetails: allLinks.filter((link) => link.wasNormalized),
    invalidDetails: allLinks.filter((link) => link.status === "invalid"),
  };
}

async function main() {
  const canonical = JSON.parse(await readFile(CANONICAL_INPUT_PATH, "utf8"));
  const items = canonical.items.map(normalizeItem);
  const linkStats = collectLinkStats(items);

  const output = {
    ...canonical,
    linksNormalizedAt: new Date().toISOString(),
    source: {
      ...canonical.source,
      canonicalFile: CANONICAL_INPUT_PATH,
    },
    summary: {
      ...canonical.summary,
      linkNormalization: {
        totalCheckedLinks: linkStats.totalCheckedLinks,
        normalizedLinks: linkStats.normalizedLinks,
        invalidLinks: linkStats.invalidLinks,
        missingLinks: linkStats.missingLinks,
      },
    },
    linkNormalization: {
      rules: [
        "Keep valid https:// URLs as-is.",
        "Upgrade http:// URLs to https://.",
        "Prefix protocol-relative URLs with https:.",
        "Prefix domain/path URLs without a protocol with https://.",
      ],
      normalizedDetails: linkStats.normalizedDetails,
      invalidDetails: linkStats.invalidDetails,
    },
    items,
  };

  await writeFile(LINKS_OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Wrote ${LINKS_OUTPUT_PATH}`);
  console.log(JSON.stringify(output.summary.linkNormalization, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

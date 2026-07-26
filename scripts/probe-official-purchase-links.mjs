import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  isTrustedPurchaseUrl,
  normalizeText,
  offerPolicy,
  significantTokens,
} from "./lib/offer-policy.mjs";

const INPUT_PATH = path.join("config", "official-purchase-links.json");
const REPORT_PATH = path.join("data", "purchase-link-live-report.json");
const REQUEST_TIMEOUT_MS = 20_000;
const updateConfig = process.argv.includes("--update-config");

function titleCoverage(expectedTitle, body) {
  const tokens = significantTokens(expectedTitle);
  const pageText = normalizeText(body);
  if (tokens.length === 0) return 0;
  return (
    tokens.filter((token) => pageText.includes(token)).length / tokens.length
  );
}

async function probe(entry) {
  if (!isTrustedPurchaseUrl(entry.url)) {
    return {
      ...entry,
      state: "untrusted",
      error: "URL host is not trusted.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(entry.url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138 Safari/537.36",
        "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
      },
    });
    const body = (await response.text()).slice(0, 1_000_000);
    const unavailableMarker =
      offerPolicy.unavailablePageMarkers.find((marker) =>
        body.includes(marker),
      ) ?? null;
    const coverage = titleCoverage(entry.expectedTitle, body);
    const state =
      response.status >= 400
        ? "http_error"
        : unavailableMarker
          ? "unavailable"
          : coverage < 0.5
            ? "title_mismatch"
            : "available";

    return {
      ...entry,
      state,
      statusCode: response.status,
      finalUrl: response.url,
      unavailableMarker,
      titleCoverage: Number(coverage.toFixed(3)),
    };
  } catch (error) {
    return {
      ...entry,
      state: error.name === "AbortError" ? "timeout" : "network_error",
      error: String(error.message ?? error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const config = JSON.parse(await readFile(INPUT_PATH, "utf8"));
  const results = [];

  for (const entry of config.links) {
    results.push(await probe(entry));
  }

  const report = {
    checkedAt: new Date().toISOString(),
    summary: {
      total: results.length,
      available: results.filter((result) => result.state === "available")
        .length,
      failures: results.filter((result) => result.state !== "available").length,
    },
    results,
  };
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const failures = results.filter((result) => result.state !== "available");
  if (failures.length > 0) {
    console.error(
      failures
        .map((result) => `${result.itemId}: ${result.state} -> ${result.url}`)
        .join("\n"),
    );
    process.exit(1);
  }

  if (updateConfig) {
    const checkedAt = report.checkedAt;
    const output = {
      ...config,
      links: config.links.map((entry) => ({
        ...entry,
        checkedAt,
        source: "live-http",
      })),
    };
    await writeFile(INPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  }

  console.log(
    JSON.stringify({ ...report.summary, updatedConfig: updateConfig }, null, 2),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

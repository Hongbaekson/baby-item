const DEFAULT_BASE_URL = "https://sonleeeun.site";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const baseUrl = new URL(process.env.PRODUCTION_BASE_URL ?? DEFAULT_BASE_URL);
const checks = [];
const failures = [];

function record(name, ok, details) {
  checks.push({ name, ok, details });
  if (!ok) failures.push(`${name}: ${details}`);
}

async function fetchWithRetry(url, options = {}) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "user-agent": "euni-baby-items-production-monitor/1.0",
          ...options.headers,
        },
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }

  throw lastError;
}

async function checkResource(pathname, expectedType) {
  const url = new URL(pathname, baseUrl);

  try {
    const response = await fetchWithRetry(url);
    const contentType = response.headers.get("content-type") ?? "";
    const ok =
      response.ok && (!expectedType || contentType.includes(expectedType));
    record(
      pathname,
      ok,
      `HTTP ${response.status}, content-type ${contentType || "missing"}`,
    );
    await response.body?.cancel();
  } catch (error) {
    record(pathname, false, String(error.message ?? error));
  }
}

async function main() {
  let homepage;

  try {
    homepage = await fetchWithRetry(baseUrl);
  } catch (error) {
    record("homepage", false, String(error.message ?? error));
    throw new Error(failures.join("\n"));
  }

  const html = await homepage.text();
  record("homepage", homepage.ok, `HTTP ${homepage.status}`);
  record(
    "react-root",
    html.includes('<div id="root"></div>'),
    "root mount element must exist",
  );

  const requiredHeaders = [
    ["strict-transport-security", /max-age=/i],
    ["content-security-policy", /default-src 'self'/i],
    ["x-content-type-options", /nosniff/i],
    ["x-frame-options", /DENY|SAMEORIGIN/i],
    ["referrer-policy", /strict-origin/i],
  ];
  for (const [name, pattern] of requiredHeaders) {
    const value = homepage.headers.get(name) ?? "";
    record(`header:${name}`, pattern.test(value), value || "missing");
  }

  const csp = homepage.headers.get("content-security-policy") ?? "";
  record(
    "csp:no-coupang",
    !/coupang/i.test(csp),
    "CSP must not allow Coupang hosts",
  );

  const assetPaths = [
    ...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g),
  ].map((match) => match[1]);
  record(
    "hashed-assets",
    assetPaths.length >= 2,
    `${assetPaths.length} assets discovered`,
  );

  await Promise.all([
    ...assetPaths.map((asset) => checkResource(asset)),
    checkResource("/robots.txt", "text/plain"),
    checkResource("/sitemap.xml", "xml"),
    checkResource("/site-preview.png", "image/png"),
    checkResource("/images/placeholders/sterilize.svg", "image/svg+xml"),
  ]);

  const httpUrl = new URL(baseUrl);
  httpUrl.protocol = "http:";
  try {
    const redirect = await fetchWithRetry(httpUrl, { redirect: "manual" });
    const location = redirect.headers.get("location") ?? "";
    record(
      "https-redirect",
      [301, 302, 307, 308].includes(redirect.status) &&
        location.startsWith("https://"),
      `HTTP ${redirect.status}, location ${location || "missing"}`,
    );
    await redirect.body?.cancel();
  } catch (error) {
    record("https-redirect", false, String(error.message ?? error));
  }

  const summary = {
    baseUrl: baseUrl.toString(),
    checkedAt: new Date().toISOString(),
    passed: checks.filter((check) => check.ok).length,
    failed: failures.length,
    checks,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const LINKS_INPUT_PATH = path.join("data", "items.links.json");
const QUALITY_OUTPUT_PATH = path.join("data", "items.quality.json");

const SUSPICIOUS_MEMO_PATTERNS = [
  {
    pattern: /무선\s*이어폰|블랙\s*프라이데이/i,
    code: "suspicious_unrelated_memo",
    severity: "error",
    message: "메모가 육아템 설명과 무관한 문구일 가능성이 있습니다.",
  },
];

function createIssue(code, severity, message, details = {}) {
  return {
    code,
    severity,
    message,
    ...details,
  };
}

function collectLinkIssues(item) {
  const issues = [];
  const primaryStatus = item.partnerLinkStatus;

  if (!item.partnerLink) {
    issues.push(
      createIssue("missing_partner_link", "error", "대표 구매 링크가 비어 있습니다."),
    );
  } else if (primaryStatus && primaryStatus !== "valid") {
    issues.push(
      createIssue("invalid_partner_link", "error", "대표 구매 링크 형식이 올바르지 않습니다.", {
        url: item.partnerLink,
        linkStatus: primaryStatus,
      }),
    );
  }

  for (const link of item.partnerLinks ?? []) {
    if (link.linkStatus && link.linkStatus !== "valid") {
      issues.push(
        createIssue("invalid_partner_link", "error", "구매 링크 형식이 올바르지 않습니다.", {
          url: link.url,
          sourceItemId: link.sourceItemId,
          linkStatus: link.linkStatus,
        }),
      );
    }

    if (link.wasNormalized) {
      issues.push(
        createIssue("normalized_partner_link", "info", "구매 링크 형식을 자동 보정했습니다.", {
          originalUrl: link.originalUrl,
          normalizedUrl: link.url,
          reason: link.normalizationReason,
        }),
      );
    }
  }

  return issues;
}

function collectMemoIssues(item) {
  const memo = item.memo ?? "";
  const issues = [];

  for (const rule of SUSPICIOUS_MEMO_PATTERNS) {
    if (rule.pattern.test(memo)) {
      issues.push(
        createIssue(rule.code, rule.severity, rule.message, {
          memo,
        }),
      );
    }
  }

  return issues;
}

function collectItemIssues(item) {
  const issues = [];

  if (!item.title) {
    issues.push(createIssue("missing_title", "error", "제품명이 비어 있습니다."));
  }

  if (item.price === null) {
    issues.push(
      createIssue("missing_price", "warning", "가격이 비어 있어 화면에 가격 확인 필요로 표시합니다."),
    );
  }

  if (!item.image?.hasImage) {
    issues.push(
      createIssue("missing_image", "warning", "제품 이미지가 없어 기본 이미지를 사용해야 합니다."),
    );
  }

  issues.push(...collectLinkIssues(item));
  issues.push(...collectMemoIssues(item));

  return issues;
}

function summarizeIssues(issues) {
  return {
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    infoCount: issues.filter((issue) => issue.severity === "info").length,
  };
}

function getQualityStatus(item, issues) {
  if (item.publicationStatus === "draft") {
    return "draft";
  }

  if (issues.some((issue) => issue.severity === "error")) {
    return "needs_review";
  }

  if (issues.some((issue) => issue.severity === "warning")) {
    return "usable_with_warnings";
  }

  return "ready";
}

function applyDataQuality(item) {
  const issues = collectItemIssues(item);
  const issueSummary = summarizeIssues(issues);

  return {
    ...item,
    dataQuality: {
      status: getQualityStatus(item, issues),
      ...issueSummary,
      issues,
    },
  };
}

function getIssueCounts(items) {
  const counts = new Map();

  for (const item of items) {
    for (const issue of item.dataQuality.issues) {
      counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
    }
  }

  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

async function main() {
  const linked = JSON.parse(await readFile(LINKS_INPUT_PATH, "utf8"));
  const items = linked.items.map(applyDataQuality);
  const draftItems = (linked.draftItems ?? []).map((item) => {
    const base = {
      ...item,
      partnerLinks: item.partnerLink
        ? [
            {
              url: item.partnerLink,
              originalUrl: item.partnerLink,
              linkStatus: "valid",
              wasNormalized: false,
            },
          ]
        : [],
      partnerLinkStatus: item.partnerLink ? "valid" : "missing",
    };

    return applyDataQuality(base);
  });

  const qualitySummary = {
    readyItems: items.filter((item) => item.dataQuality.status === "ready").length,
    usableWithWarningsItems: items.filter(
      (item) => item.dataQuality.status === "usable_with_warnings",
    ).length,
    needsReviewItems: items.filter((item) => item.dataQuality.status === "needs_review")
      .length,
    draftItems: draftItems.length,
    issueCounts: getIssueCounts(items),
    draftIssueCounts: getIssueCounts(draftItems),
    allIssueCounts: getIssueCounts([...items, ...draftItems]),
  };

  const output = {
    ...linked,
    dataQualityAppliedAt: new Date().toISOString(),
    source: {
      ...linked.source,
      linksFile: LINKS_INPUT_PATH,
    },
    summary: {
      ...linked.summary,
      dataQuality: qualitySummary,
    },
    items,
    draftItems,
  };

  await writeFile(QUALITY_OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Wrote ${QUALITY_OUTPUT_PATH}`);
  console.log(JSON.stringify(qualitySummary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

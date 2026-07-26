import type { Item } from "../types";
import { primaryPurchaseUrl } from "./offers";

export const PRODUCTION_ORIGIN = "https://sonleeeun.site";
const REPOSITORY_ISSUES_URL =
  "https://github.com/Hongbaekson/baby-item/issues/new";

export function itemShareUrl(itemId: string) {
  const url = new URL(PRODUCTION_ORIGIN);
  url.searchParams.set("item", itemId);
  return url.toString();
}

export function reportIssueUrl(item?: Item) {
  const url = new URL(REPOSITORY_ISSUES_URL);
  const itemTitle = item?.title ?? "사이트";
  const pageUrl = item ? itemShareUrl(item.id) : PRODUCTION_ORIGIN;
  const purchaseUrl = item ? primaryPurchaseUrl(item) : null;
  url.searchParams.set("title", `[정보 수정] ${itemTitle}`);
  url.searchParams.set(
    "body",
    [
      "## 문제가 있는 항목",
      item ? `- 상품명: ${item.title}` : "- 사이트 전반",
      `- 페이지: ${pageUrl}`,
      purchaseUrl
        ? `- 현재 판매 링크: ${purchaseUrl}`
        : "- 현재 판매 링크: 공개되지 않음",
      "",
      "## 확인이 필요한 내용",
      "<!-- 잘못된 링크, 품절, 상품 불일치 등을 적어 주세요. 개인정보는 작성하지 마세요. -->",
    ].join("\n"),
  );
  return url.toString();
}

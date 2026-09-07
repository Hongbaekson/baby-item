import { describe, expect, it, vi } from "vitest";
import { data } from "./app-data";
import {
  hasCurrentPurchaseLink,
  primaryActionLabel,
  primaryPurchaseUrl,
} from "./offers";
import type { Item } from "../types";

describe("purchase actions", () => {
  it("keeps the exact product search available after official evidence expires", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-08T00:00:00Z"));
    const item = {
      ...data.items[0],
      searchQuery: "브라운 귀체온계 IRT-6525",
      purchaseLink: {
        status: "verified",
        kind: "official",
        url: "https://www.i-angel.co.kr/product/old/",
        checkedAt: "2026-07-30T00:00:00Z",
        source: "live-http",
      },
    } as Item;
    expect(hasCurrentPurchaseLink(item)).toBe(false);
    const url = new URL(primaryPurchaseUrl(item)!);
    expect(url.hostname).toBe("search.shopping.naver.com");
    expect(url.searchParams.get("query")).toBe("브라운 귀체온계 IRT-6525");
    expect(primaryActionLabel(item)).toBe("네이버에서 상품 검색");
    const current = {
      ...item,
      purchaseLink: { ...item.purchaseLink, checkedAt: "2026-09-08T00:00:00Z" },
    };
    expect(primaryPurchaseUrl(current)).toBe(current.purchaseLink.url);
    expect(primaryActionLabel(current)).toBe("공식 판매처 보기");
    vi.restoreAllMocks();
  });
});

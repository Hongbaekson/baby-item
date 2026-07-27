import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { data } from "./lib/app-data";
import { formatCheckedDate, hasCurrentPurchaseLink } from "./lib/offers";
import { displayTitle } from "./lib/products";

const checkedAt = Date.now();
const verifiedItems = data.items.filter((item) =>
  hasCurrentPurchaseLink(item, checkedAt),
);
const latestCheckedAt = verifiedItems
  .map((item) => item.purchaseLink.checkedAt)
  .filter((value): value is string => Boolean(value))
  .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

describe("App", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    window.localStorage.clear();
  });

  it("renders a compact first page and reveals more products on request", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getAllByRole("button", { name: /상세 보기$/ })).toHaveLength(
      9,
    );
    await user.click(screen.getByRole("button", { name: /육아템 더 보기/ }));
    expect(screen.getAllByRole("button", { name: /상세 보기$/ })).toHaveLength(
      18,
    );
  });

  it("shows the current operating status and verification policy", () => {
    render(<App />);
    const status = screen.getByRole("region", {
      name: "판매 정보 운영 상태",
    });
    expect(
      within(status).getByText(
        `판매 근거 확인 ${verifiedItems.length}/${data.items.length}`,
      ),
    ).toBeInTheDocument();
    expect(
      within(status).getByText(
        `최근 점검 ${formatCheckedDate(latestCheckedAt)}`,
      ),
    ).toBeInTheDocument();
    expect(
      within(status).queryByRole("link", { name: "검증 기준 보기" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "가격보다 판매 페이지를 먼저 확인합니다",
      }),
    ).toBeInTheDocument();
  });

  it("filters products through the named search input", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByRole("searchbox", { name: "제품명 또는 카테고리 검색" }),
      "백색소음기",
    );
    expect(
      screen.getByRole("heading", { name: "1개의 육아템" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "말랑하니 백색소음기" }),
    ).toBeInTheDocument();
  });

  it("closes the dialog with Escape and restores focus", async () => {
    const user = userEvent.setup();
    render(<App />);
    const trigger = screen.getByRole("button", {
      name: "말랑하니 백색소음기 상세 보기",
    });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "상품 상세 닫기" }),
    ).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("uses a Naver search instead of a stale candidate product page", async () => {
    const user = userEvent.setup();
    const item = data.items.find(
      (candidate) =>
        candidate.purchaseLink.kind === "naver_search" &&
        hasCurrentPurchaseLink(candidate, checkedAt),
    );
    expect(item).toBeDefined();
    const title = displayTitle(item!);

    render(<App />);
    await user.type(
      screen.getByRole("searchbox", { name: "제품명 또는 카테고리 검색" }),
      item!.title,
    );
    const card = screen
      .getByRole("heading", { name: title })
      .closest("article");
    expect(card).not.toBeNull();
    expect(
      within(card as HTMLElement).queryByText(/최저가/),
    ).not.toBeInTheDocument();
    const link = within(card as HTMLElement).getByRole("link");
    expect(link).toHaveTextContent("네이버에서 판매 상품 찾기");
    expect(link).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/search\.shopping\.naver\.com\//),
    );
  });

  it("hides the CTA when no current non-Coupang sales evidence exists", async () => {
    const user = userEvent.setup();
    const item = data.items.find(
      (candidate) => !hasCurrentPurchaseLink(candidate, checkedAt),
    );
    if (!item) return;
    const title = displayTitle(item);

    render(<App />);
    await user.type(
      screen.getByRole("searchbox", { name: "제품명 또는 카테고리 검색" }),
      item.title,
    );
    const card = screen
      .getByRole("heading", { name: title })
      .closest("article");
    expect(card).not.toBeNull();
    expect(
      within(card as HTMLElement).queryByRole("link"),
    ).not.toBeInTheDocument();
    expect(
      within(card as HTMLElement).getByText("현재 판매 링크 확인 중"),
    ).toBeInTheDocument();
  });

  it("shows the affiliate disclosure in the footer", () => {
    render(<App />);
    expect(
      within(screen.getByRole("contentinfo")).getByText(
        /일부 구매 링크는 제휴 링크일 수 있으며/,
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("contentinfo")).getByText(
        /찜 목록과 화면 테마는 현재 브라우저에만 저장/,
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("contentinfo")).getByText(
        /매일 자동으로 판매 경로를 점검/,
      ),
    ).toBeInTheDocument();
  });

  it("copies a stable product share URL and provides a prefilled report link", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<App />);

    await user.click(
      screen.getByRole("button", {
        name: "말랑하니 백색소음기 상세 보기",
      }),
    );
    await user.click(screen.getByRole("button", { name: "공유" }));

    expect(writeText).toHaveBeenCalledWith(
      "https://sonleeeun.site/?item=item-95739902b6",
    );
    expect(
      await screen.findByText("상품 링크를 복사했습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /링크·상품 정보 오류 신고/ }),
    ).toHaveAttribute(
      "href",
      expect.stringMatching(
        /^https:\/\/github\.com\/Hongbaekson\/baby-item\/issues\/new\?/,
      ),
    );
  });

  it("stores favorites and filters the list to the saved products", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      screen.getByRole("button", {
        name: "말랑하니 백색소음기 찜하기",
      }),
    );
    await user.click(screen.getByRole("button", { name: /내 찜 1/ }));
    expect(
      screen.getByRole("heading", { name: "1개의 육아템" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "말랑하니 백색소음기 찜 해제",
      }),
    ).toBeInTheDocument();
  });
});

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
const latestCheckedAt = data.purchaseLinkPolicy.checkedAt;

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
        `공식몰 확인 ${verifiedItems.length}/${data.items.length}`,
      ),
    ).toBeInTheDocument();
    expect(
      within(status).getByText(
        `공식몰 점검 ${formatCheckedDate(latestCheckedAt)}`,
      ),
    ).toBeInTheDocument();
    expect(
      within(status).queryByRole("link", { name: "검증 기준 보기" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "상품 검색과 공식 판매처를 구분합니다",
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
      (candidate) => candidate.purchaseLink.kind === "naver_search",
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
    expect(link).toHaveTextContent("네이버에서 상품 검색");
    expect(link).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/search\.shopping\.naver\.com\//),
    );
  });

  it("keeps product search available without claiming verified sales", async () => {
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
    expect(within(card as HTMLElement).getByRole("link")).toHaveTextContent(
      "네이버에서 상품 검색",
    );
    expect(
      within(card as HTMLElement).getByText(
        "상품명으로 검색 · 가격·재고는 판매처 확인",
      ),
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
        /찜·준비 목록과 화면 테마는 현재 브라우저에 저장/,
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("contentinfo")).getByText(
        /판매 경로를 매일 점검/,
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

  it("tracks a need once and separates an unknown estimate from spending", async () => {
    const user = userEvent.setup();
    render(<App />);
    const card = screen
      .getByRole("heading", { name: "롤베이비 방수패드" })
      .closest("article")!;
    await user.click(
      within(card).getByRole("button", {
        name: "롤베이비 방수패드 준비 목록에 추가",
      }),
    );
    const board = screen.getByRole("region", {
      name: "필요한 품목부터 정하세요",
    });
    expect(within(board).getByText("0/1")).toBeInTheDocument();
    expect(within(board).getByText("금액 미입력 1품목")).toBeInTheDocument();
    await user.selectOptions(
      within(board).getByRole("combobox", { name: "상태" }),
      "준비 완료",
    );
    await user.type(
      within(board).getByRole("spinbutton", { name: "예상 총비용 (원)" }),
      "20000",
    );
    await user.type(
      within(board).getByRole("spinbutton", { name: "실제 총지출 (원)" }),
      "18000",
    );
    expect(within(board).getByText("1/1")).toBeInTheDocument();
    expect(within(board).getByText("예상 비용 20,000원")).toBeInTheDocument();
    expect(within(board).getByText("실제 지출 18,000원")).toBeInTheDocument();
    expect(
      JSON.parse(
        window.localStorage.getItem("euni-baby-items-preparation-v1")!,
      ),
    ).toHaveLength(1);
  });
});

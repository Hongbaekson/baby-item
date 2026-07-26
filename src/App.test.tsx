import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

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

  it("uses a Naver search instead of a stale candidate product page", () => {
    render(<App />);
    const card = screen
      .getAllByRole("heading", { name: "말랑하니 백색소음기" })[0]
      .closest("article");
    expect(card).not.toBeNull();
    expect(
      within(card as HTMLElement).queryByText(/최저가/),
    ).not.toBeInTheDocument();
    const link = within(card as HTMLElement).getByRole("link", {
      name: /말랑하니 백색소음기 판매 상품 찾기/,
    });
    expect(link).toHaveTextContent("네이버에서 판매 상품 찾기");
    expect(link).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/search\.shopping\.naver\.com\//),
    );
  });

  it("hides the CTA when no current non-Coupang sales evidence exists", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByRole("searchbox", { name: "제품명 또는 카테고리 검색" }),
      "젖병 소독 냄비",
    );
    const card = screen
      .getByRole("heading", { name: "젖병 소독 냄비" })
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

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

  it("does not label old or shipping-unknown candidates as current lowest prices", () => {
    render(<App />);
    const card = screen
      .getAllByRole("heading", { name: "말랑하니 백색소음기" })[0]
      .closest("article");
    expect(card).not.toBeNull();
    expect(
      within(card as HTMLElement).getByText("현재 가격은 구매처에서 확인"),
    ).toBeInTheDocument();
    expect(
      within(card as HTMLElement).queryByText(/최저가/),
    ).not.toBeInTheDocument();
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

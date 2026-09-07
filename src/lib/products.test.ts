import { expect, it } from "vitest";
import { data } from "./app-data";
import { matchesProductQuery, productSearchUrl } from "./products";

it("finds catalog titles, compact spellings and reordered model words", () => {
  for (const item of data.items) {
    expect(matchesProductQuery(item, item.title), item.title).toBe(true);
    expect(matchesProductQuery(item, item.searchQuery), item.title).toBe(true);
    expect(new URL(productSearchUrl(item)).searchParams.get("query")).toBe(
      item.searchQuery,
    );
  }
  const titles = (query: string) =>
    data.items
      .filter((item) => matchesProductQuery(item, query))
      .map((item) => item.id);
  expect(titles("6525 브라운")).toEqual(["item-9157246424"]);
  expect(titles("메도우 모빌")).toEqual(["item-2153199934"]);
  expect(titles("앱솔루트 1단계 800 g")).toEqual(["item-8631775229"]);
  expect(titles("존재하지않는모델")).toEqual([]);
});

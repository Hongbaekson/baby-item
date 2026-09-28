import { describe, expect, it } from "vitest";
import { data } from "./app-data";
import {
  entriesFromHash,
  needForProduct,
  needs,
  newEntry,
  parseEntries,
  preparationTotals,
  shareHash,
} from "./preparation";

describe("preparation", () => {
  it("assigns every product to one need and counts alternatives once", () => {
    for (const item of data.items) {
      expect(
        needs.filter((need) => need.productIds.includes(item.id)),
      ).toHaveLength(1);
    }
    const pad = needForProduct("item-c095ae487b")!;
    expect(pad).toBe(needForProduct("item-9a9c893193"));
    const entry = {
      ...newEntry(pad, pad.productIds[0]),
      status: "준비 완료" as const,
      expected: 20000,
      actual: 18000,
    };
    expect(preparationTotals([entry])).toMatchObject({
      ready: 1,
      total: 1,
      expected: 20000,
      actual: 18000,
    });
  });

  it("shares a validated snapshot without treating missing prices as zero", () => {
    const entry = {
      ...newEntry(needs[0]),
      note: "선물 확인",
      status: "준비 예정" as const,
    };
    expect(entriesFromHash(shareHash([entry]))).toEqual([entry]);
    expect(preparationTotals([entry])).toMatchObject({
      expected: 0,
      expectedUnknown: 1,
    });
    expect(
      parseEntries([
        { ...entry, expected: -1, quantity: 999, productId: "unknown" },
      ]),
    ).toMatchObject([{ expected: null, quantity: 1, productId: null }]);
    expect(entriesFromHash("#list=invalid")).toBeNull();
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  probe,
  updateOfficialConfig,
} from "../scripts/probe-official-purchase-links.mjs";

test("one unavailable official page revokes only its own evidence", async (t) => {
  const url = "https://www.i-angel.co.kr/product/test/";
  const entry = {
    itemId: "one",
    url,
    expectedTitle: "아이엔젤 닥터다이얼 폴드에어 힙시트",
  };
  t.mock.method(globalThis, "fetch", async () => ({
    status: 200,
    url,
    text: async () => "아이엔젤 다른 상품",
  }));
  assert.equal((await probe(entry)).state, "title_mismatch");
  globalThis.fetch.mock.mockImplementation(async () => ({
    status: 200,
    url,
    text: async () => entry.expectedTitle + " 판매가 200000원",
  }));
  assert.equal((await probe(entry)).state, "available");
  globalThis.fetch.mock.mockImplementation(async () => ({
    status: 200,
    url: "https://example.com/",
    text: async () => entry.expectedTitle,
  }));
  assert.equal((await probe(entry)).state, "untrusted_redirect");
  const output = updateOfficialConfig(
    {
      links: [
        entry,
        { ...entry, itemId: "two", checkedAt: "2026-09-01T00:00:00Z" },
      ],
    },
    {
      checkedAt: "2026-09-08T00:00:00Z",
      results: [{ state: "available" }, { state: "http_error" }],
    },
  );
  assert.equal(output.links[0].checkedAt, "2026-09-08T00:00:00Z");
  assert.equal(output.links[1].checkedAt, null);
});

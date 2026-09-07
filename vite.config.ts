import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import data from "./src/data/items.json";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "catalog-monitor-metadata",
      transformIndexHtml: () =>
        Object.entries({
          "catalog-checked-at": data.purchaseLinkPolicy.checkedAt ?? "",
          "catalog-items": data.items.length,
          "catalog-search-links": data.purchaseLinkPolicy.naverSearchLinks,
          "catalog-official-links": data.purchaseLinkPolicy.officialLinks,
        }).map(([name, content]) => ({
          tag: "meta",
          attrs: { name, content: String(content) },
        })),
    },
  ],
});

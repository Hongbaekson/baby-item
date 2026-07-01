import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_URL =
  "https://bedecked-shingle-38a.notion.site/248b4abb08ed803e8825db3d5713f396?v=248b4abb08ed8094905c000cd1938a4c";

const NOTION_HOST = "https://bedecked-shingle-38a.notion.site";
const QUERY_COLLECTION_URL = `${NOTION_HOST}/api/v3/queryCollection`;

const SPACE_ID = "c83b4abb-08ed-8164-978c-0003242da846";
const PAGE_ID = "248b4abb-08ed-803e-8825-db3d5713f396";
const COLLECTION_ID = "248b4abb-08ed-80e3-83dc-000bdbd8739f";
const COLLECTION_VIEW_ID = "248b4abb-08ed-8094-905c-000cd1938a4c";

const OUTPUT_PATH = path.join("data", "items.raw.json");

function unwrapRecord(record) {
  return record?.value?.value ?? record?.value ?? record;
}

function richTextToPlainText(value) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((segment) => {
      if (Array.isArray(segment)) {
        return String(segment[0] ?? "");
      }

      return "";
    })
    .join("")
    .trim();
}

function normalizeSchema(schema = {}) {
  return Object.fromEntries(
    Object.entries(schema).map(([propertyId, property]) => [
      propertyId,
      {
        id: propertyId,
        name: property.name,
        type: property.type,
        options: property.options?.map((option) => ({
          id: option.id,
          value: option.value,
          color: option.color,
        })),
      },
    ]),
  );
}

function normalizeCategory(value) {
  return value.replace(/\s+/g, " ").trim();
}

function getGroupOrder(reducerResults) {
  const groups = reducerResults?.gallery_groups;

  if (!groups?.blockResults) {
    return new Map();
  }

  const order = new Map();
  let nextIndex = 0;

  for (const group of groups.results ?? []) {
    const groupValue = group?.value?.value;
    const blockResult = groups.blockResults[`select:${groupValue}`];

    for (const blockId of blockResult?.blockIds ?? []) {
      order.set(blockId, {
        group: groupValue,
        index: nextIndex,
      });
      nextIndex += 1;
    }
  }

  return order;
}

function getImageInfo(block, properties) {
  const fileProperty = properties["un?{"];
  const fileText = richTextToPlainText(fileProperty);
  const previewUrl = block.format?.social_media_image_preview_url ?? "";

  return {
    hasImage: Boolean(fileText || previewUrl),
    filePropertyRaw: fileProperty ?? null,
    socialMediaImagePreviewUrl: previewUrl,
  };
}

function extractItem(blockId, block, schema, groupOrder) {
  const properties = block.properties ?? {};
  const title = richTextToPlainText(properties.title);
  const category = normalizeCategory(richTextToPlainText(properties.knYS));
  const group = groupOrder.get(blockId);
  const image = getImageInfo(block, properties);

  return {
    id: blockId,
    originalOrder: group?.index ?? null,
    groupCategory: group?.group ?? "",
    extracted: {
      title,
      category,
      partnerLink: richTextToPlainText(properties["lc\\N"]),
      price: richTextToPlainText(properties["|l@g"]),
      status: richTextToPlainText(properties["lM\\<"]),
      memo: richTextToPlainText(properties["yXC^"]),
      image,
    },
    notion: {
      type: block.type,
      parentId: block.parent_id,
      parentTable: block.parent_table,
      createdTime: block.created_time,
      lastEditedTime: block.last_edited_time,
      pageIcon: block.format?.page_icon ?? "",
      rawProperties: Object.fromEntries(
        Object.entries(properties).map(([propertyId, value]) => [
          propertyId,
          {
            propertyId,
            propertyName: schema[propertyId]?.name ?? propertyId,
            propertyType: schema[propertyId]?.type ?? "unknown",
            plainText: richTextToPlainText(value),
            rawValue: value,
          },
        ]),
      ),
    },
  };
}

async function queryCollection() {
  const response = await fetch(QUERY_COLLECTION_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      collectionView: {
        id: COLLECTION_VIEW_ID,
        spaceId: SPACE_ID,
      },
      collectionViewBlock: {
        id: PAGE_ID,
        spaceId: SPACE_ID,
      },
      clientType: "notion_app",
      userTimeZone: "Asia/Seoul",
      isFullScreen: true,
      isMobile: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Notion queryCollection failed: ${response.status} ${response.statusText}\n${body}`,
    );
  }

  return response.json();
}

async function main() {
  const result = await queryCollection();
  const collectionRecord = unwrapRecord(result.recordMap?.collection?.[COLLECTION_ID]);

  if (!collectionRecord) {
    throw new Error("Collection record was not found in Notion response.");
  }

  const schema = normalizeSchema(collectionRecord.schema);
  const groupOrder = getGroupOrder(result.result?.reducerResults);

  const pageBlocks = Object.entries(result.recordMap?.block ?? {})
    .map(([blockId, record]) => [blockId, unwrapRecord(record)])
    .filter(([, block]) => {
      return (
        block?.type === "page" &&
        block.parent_table === "collection" &&
        block.parent_id === COLLECTION_ID &&
        block.is_template !== true
      );
    })
    .map(([blockId, block]) => extractItem(blockId, block, schema, groupOrder))
    .sort((a, b) => {
      if (a.originalOrder === null && b.originalOrder === null) {
        return String(a.notion.createdTime).localeCompare(String(b.notion.createdTime));
      }

      if (a.originalOrder === null) return 1;
      if (b.originalOrder === null) return -1;

      return a.originalOrder - b.originalOrder;
    });

  const categories = Array.from(
    new Set(pageBlocks.map((item) => item.extracted.category).filter(Boolean)),
  );

  const output = {
    extractedAt: new Date().toISOString(),
    source: {
      url: SOURCE_URL,
      host: NOTION_HOST,
      spaceId: SPACE_ID,
      pageId: PAGE_ID,
      collectionId: COLLECTION_ID,
      collectionViewId: COLLECTION_VIEW_ID,
    },
    collection: {
      name: richTextToPlainText(collectionRecord.name),
      description: richTextToPlainText(collectionRecord.description),
      schema,
    },
    summary: {
      totalItems: pageBlocks.length,
      totalCategories: categories.length,
      emptyTitleItems: pageBlocks.filter((item) => !item.extracted.title).length,
      missingPartnerLinkItems: pageBlocks.filter((item) => !item.extracted.partnerLink).length,
      missingPriceItems: pageBlocks.filter((item) => !item.extracted.price).length,
      itemsWithImage: pageBlocks.filter((item) => item.extracted.image.hasImage).length,
    },
    categories,
    items: pageBlocks,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(`${OUTPUT_PATH}`, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(JSON.stringify(output.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { data } from "./app-data";

export const CATEGORY_TONES = [
  "mint",
  "sky",
  "peach",
  "butter",
  "lavender",
  "rose",
  "leaf",
  "coral",
  "blueberry",
  "cream",
] as const;

const CATEGORY_LABELS = new Map([
  ["👶300일간 매일 사용한 육아템 정리", "👶 매일 쓰는 육아템"],
  ["🧑‍🍼손목&허리보호대(양육자를 위한 아이템)", "🧑‍🍼 양육자 보호대"],
  ["🍼젖병 열탕 소독", "🍼 젖병 열탕 소독"],
  ["🍼수유아이템", "🍼 수유 아이템"],
  ["💩신생아 배앓이 꿀템", "💩 신생아 배앓이"],
  ["💩배변아이템", "💩 배변 아이템"],
  ["🎉놀이아이템", "🎉 놀이 아이템"],
  ["😎외출 아이템", "😎 외출 아이템"],
  ["💤수면 아이템", "💤 수면 아이템"],
  ["🧼목욕/세탁 아이템", "🧼 목욕·세탁"],
]);

const CATEGORY_PLACEHOLDERS = new Map([
  ["👶300일간 매일 사용한 육아템 정리", "top-used"],
  ["💤수면 아이템", "sleep"],
  ["😎외출 아이템", "outing"],
  ["🍼젖병 열탕 소독", "sterilize"],
  ["🍼수유아이템", "feeding"],
  ["💩신생아 배앓이 꿀템", "colic"],
  ["🎉놀이아이템", "play"],
  ["💩배변아이템", "diaper"],
  ["👶거실매트", "mat"],
  ["🧑‍🍼손목&허리보호대(양육자를 위한 아이템)", "caregiver"],
]);

export function categoryTone(category: string) {
  const index = data.summary.categories.findIndex(
    (item) => item.name === category,
  );
  return CATEGORY_TONES[Math.max(index, 0) % CATEGORY_TONES.length];
}

export function categoryLabel(category: string) {
  return CATEGORY_LABELS.get(category) ?? category;
}

export function placeholderFor(category: string) {
  return `/images/placeholders/${CATEGORY_PLACEHOLDERS.get(category) ?? "default"}.svg`;
}

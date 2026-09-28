import { data } from "./app-data";

export type Stage = "출산 전" | "생후 초기" | "필요할 때";
export type PreparationStatus =
  "검토 중" | "준비 예정" | "준비 완료" | "준비 안 함";
export type PreparationMethod = "구매" | "선물" | "대여" | "이미 보유";

export type Need = {
  id: string;
  title: string;
  stage: Stage;
  productIds: string[];
  criterion?: string;
  skipWhen?: string;
};

// Products are candidates for a need. Multiple products under one need count once.
export const needs: Need[] = [
  {
    id: "white-noise",
    title: "백색소음기",
    stage: "필요할 때",
    productIds: ["item-95739902b6"],
    criterion: "충전 방식과 소리 조절, 밤중 조작 편의를 비교하세요.",
    skipWhen: "현재 수면 환경으로 충분하다면 나중에 결정해도 됩니다.",
  },
  {
    id: "formula-water",
    title: "분유용 물 준비",
    stage: "생후 초기",
    productIds: ["item-7995e62fc2"],
    criterion:
      "세척 편의와 온도 표시·유지 기능을 확인하세요. 분유 조제 방법은 제품 설명서와 의료진 지침을 따르세요.",
    skipWhen: "수유 방식이 정해지기 전에는 구매를 미뤄도 됩니다.",
  },
  {
    id: "bottle-sterilizer",
    title: "젖병 소독기",
    stage: "생후 초기",
    productIds: ["item-35daf7dc3f"],
    criterion: "젖병 크기·수량과 세척, 설치 공간을 비교하세요.",
    skipWhen: "다른 소독 방법을 선택했다면 필요하지 않을 수 있습니다.",
  },
  {
    id: "home-camera",
    title: "홈캠",
    stage: "필요할 때",
    productIds: ["item-b74f1aa7c3"],
    criterion: "야간 화질, 계정 보안, 설치 위치를 확인하세요.",
    skipWhen: "공간 구조상 모니터링이 불필요할 수 있습니다.",
  },
  {
    id: "camera-mount",
    title: "홈캠 거치대",
    stage: "필요할 때",
    productIds: ["item-c31a58fcb7"],
  },
  {
    id: "waterproof-pad",
    title: "방수패드",
    stage: "출산 전",
    productIds: ["item-c095ae487b", "item-9a9c893193"],
    criterion: "크기, 세탁 방법, 건조 시간을 비교하세요.",
    skipWhen: "이미 충분한 방수 커버가 있다면 중복 구매를 피하세요.",
  },
  {
    id: "bottle-detergent",
    title: "젖병 세정제",
    stage: "생후 초기",
    productIds: ["item-194c1a1120", "item-8309014082"],
    criterion: "사용할 젖병·세척 방식에 맞는 용도와 용량을 확인하세요.",
  },
  {
    id: "probiotics",
    title: "유산균",
    stage: "필요할 때",
    productIds: ["item-073cb29318"],
    skipWhen: "아기에게 필요한지 의료진과 상의한 뒤 결정하세요.",
  },
  {
    id: "carrier",
    title: "아기띠",
    stage: "생후 초기",
    productIds: ["item-b6cc51720e"],
    criterion: "아기 체중 범위와 양육자 착용감을 직접 확인하세요.",
  },
  {
    id: "wrist-support",
    title: "손목보호대",
    stage: "필요할 때",
    productIds: ["item-4f18824aa0"],
  },
  {
    id: "back-support",
    title: "허리보호대",
    stage: "필요할 때",
    productIds: ["item-8e7ce75a58"],
  },
  {
    id: "play-gym",
    title: "아기 체육관",
    stage: "필요할 때",
    productIds: ["item-e9d15fbf7f"],
  },
  {
    id: "sterilizing-pot",
    title: "열탕 소독용 냄비",
    stage: "생후 초기",
    productIds: ["item-f8e90a98ec", "item-4252707619"],
    criterion: "사용 중인 열원과 젖병 크기에 맞는지 확인하세요.",
  },
  {
    id: "washing-basin",
    title: "젖병 세척용 통",
    stage: "생후 초기",
    productIds: ["item-30c64e909c"],
  },
  {
    id: "baby-wash",
    title: "아기 씻기 도구",
    stage: "출산 전",
    productIds: ["item-08cfcdce92", "item-13303567063"],
    criterion: "욕실 구조와 설치 가능 여부를 먼저 확인하세요.",
  },
  {
    id: "bath-wash",
    title: "아기 목욕 세정제",
    stage: "출산 전",
    productIds: ["item-7993572892"],
  },
  {
    id: "laundry-detergent",
    title: "아기 세탁세제",
    stage: "출산 전",
    productIds: ["item-8360713149"],
  },
  {
    id: "formula",
    title: "분유",
    stage: "생후 초기",
    productIds: ["item-8631775229", "item-5833708604"],
    criterion:
      "수유 계획과 제품 표시를 확인하세요. 필요한 경우 의료진과 상의하세요.",
    skipWhen: "모유 수유 등 가정의 계획에 따라 준비 시점이 달라집니다.",
  },
  {
    id: "bottle-brush",
    title: "젖병솔",
    stage: "생후 초기",
    productIds: ["item-11657920227"],
  },
  {
    id: "thermometer-room",
    title: "온습도계",
    stage: "출산 전",
    productIds: ["item-57429157998"],
  },
  {
    id: "thermometer-body",
    title: "체온계",
    stage: "출산 전",
    productIds: ["item-9157246424"],
  },
  {
    id: "gauze-cloths",
    title: "거즈손수건",
    stage: "출산 전",
    productIds: ["item-3962205"],
  },
  {
    id: "diaper-bin",
    title: "기저귀 쓰레기통",
    stage: "필요할 때",
    productIds: ["item-100700814"],
  },
  {
    id: "drying-rack",
    title: "작은 빨래건조대",
    stage: "필요할 때",
    productIds: ["item-10126755890"],
  },
  {
    id: "infant-car-seat",
    title: "신생아 바구니 카시트",
    stage: "출산 전",
    productIds: ["item-13059044648"],
    criterion: "차량 장착 방식과 대여 기간을 확인하세요.",
  },
  {
    id: "bath-towel",
    title: "아기 목욕타올",
    stage: "출산 전",
    productIds: ["item-4422933574"],
  },
  {
    id: "mobile",
    title: "모빌",
    stage: "필요할 때",
    productIds: ["item-2153199934"],
  },
  {
    id: "convertible-car-seat",
    title: "회전형 카시트",
    stage: "필요할 때",
    productIds: ["item-4658630775"],
    criterion: "차량 호환성과 제조사 사용 가능 체중·키 범위를 확인하세요.",
  },
];

export type PreparationEntry = {
  id: string;
  title?: string;
  status: PreparationStatus;
  method: PreparationMethod;
  stage: Stage;
  quantity: number;
  expected: number | null;
  actual: number | null;
  productId: string | null;
  note: string;
};

const needById = new Map(needs.map((need) => [need.id, need]));
const productIds = new Set(data.items.map((item) => item.id));

export function needForProduct(productId: string) {
  return needs.find((need) => need.productIds.includes(productId));
}

export function newEntry(
  need: Need,
  productId: string | null = null,
): PreparationEntry {
  return {
    id: need.id,
    status: "검토 중",
    method: "구매",
    stage: need.stage,
    quantity: 1,
    expected: null,
    actual: null,
    productId,
    note: "",
  };
}

export function parseEntries(value: unknown): PreparationEntry[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.slice(0, 80).flatMap((candidate): PreparationEntry[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const entry = candidate as Record<string, unknown>;
    if (typeof entry.id !== "string" || ids.has(entry.id)) return [];
    const need = needById.get(entry.id);
    const custom =
      /^custom-[0-9a-f-]{36}$/.test(entry.id) &&
      typeof entry.title === "string" &&
      entry.title.trim().length > 0;
    if (!need && !custom) return [];
    ids.add(entry.id);
    const price = (value: unknown) =>
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 100_000_000
        ? value
        : null;
    const productId =
      typeof entry.productId === "string" &&
      productIds.has(entry.productId) &&
      need?.productIds.includes(entry.productId)
        ? entry.productId
        : null;
    return [
      {
        id: entry.id,
        ...(custom ? { title: String(entry.title).trim().slice(0, 60) } : {}),
        status: (
          ["검토 중", "준비 예정", "준비 완료", "준비 안 함"] as unknown[]
        ).includes(entry.status)
          ? (entry.status as PreparationStatus)
          : "검토 중",
        method: (["구매", "선물", "대여", "이미 보유"] as unknown[]).includes(
          entry.method,
        )
          ? (entry.method as PreparationMethod)
          : "구매",
        stage: (["출산 전", "생후 초기", "필요할 때"] as unknown[]).includes(
          entry.stage,
        )
          ? (entry.stage as Stage)
          : (need?.stage ?? "필요할 때"),
        quantity:
          typeof entry.quantity === "number" &&
          Number.isInteger(entry.quantity) &&
          entry.quantity >= 1 &&
          entry.quantity <= 99
            ? entry.quantity
            : 1,
        expected: price(entry.expected),
        actual: price(entry.actual),
        productId,
        note: typeof entry.note === "string" ? entry.note.slice(0, 300) : "",
      },
    ];
  });
}

export function preparationTotals(entries: PreparationEntry[]) {
  const active = entries.filter((entry) => entry.status !== "준비 안 함");
  const paid = active.filter(
    (entry) => entry.method === "구매" || entry.method === "대여",
  );
  const spent = paid.filter((entry) => entry.status === "준비 완료");
  return {
    ready: active.filter((entry) => entry.status === "준비 완료").length,
    total: active.length,
    expected: paid.reduce((sum, entry) => sum + (entry.expected ?? 0), 0),
    expectedUnknown: paid.filter((entry) => entry.expected === null).length,
    actual: spent.reduce((sum, entry) => sum + (entry.actual ?? 0), 0),
    actualUnknown: spent.filter((entry) => entry.actual === null).length,
  };
}

export function needTitle(entry: PreparationEntry) {
  return needById.get(entry.id)?.title ?? entry.title ?? "직접 추가한 품목";
}

export function needByKey(id: string) {
  return needById.get(id);
}

export function shareHash(entries: PreparationEntry[]) {
  const bytes = new TextEncoder().encode(JSON.stringify(entries));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `#list=${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

export function entriesFromHash(hash: string): PreparationEntry[] | null {
  if (!hash.startsWith("#list=") || hash.length > 30_000) return null;
  try {
    const encoded = hash.slice(6).replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    return Array.isArray(value) && value.length > 0
      ? parseEntries(value)
      : null;
  } catch {
    return null;
  }
}

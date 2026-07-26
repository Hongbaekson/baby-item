import type { Item } from "../types";

const DAILY_CATEGORY = "👶300일간 매일 사용한 육아템 정리";

const SHORT_TITLES = new Map<string, string>([
  [
    "헤이홈 프로 홈캠 가정용 CCTV 펫 베이비캠 홈카메라",
    "헤이홈 프로 베이비 홈캠",
  ],
  [
    "마더케이 디아 젖병 유아 주방세제 무향, 1개, 500ml",
    "마더케이 디아 젖병 주방세제 500ml",
  ],
  [
    "아기띠  아이엔젤 올인원 닥터다이얼 폴드 에어 힙시트",
    "아이엔젤 닥터다이얼 폴드 에어 힙시트",
  ],
  ["FRANKLIIN 바스 앤 샴푸, 500ml, 1개", "FRANKLIIN 바스 앤 샴푸 500ml"],
  ["FRANKLIIN 주방세제&젖병세정제, 500ml, 1개", "FRANKLIIN 젖병세정제 500ml"],
  [
    "(한국공식) 압타밀 프로푸트라 듀오어드밴스 1단계 분유 800g, 1개",
    "압타밀 프로푸트라 1단계 800g",
  ],
  [
    "[슈퍼적립] 마더케이 롱핸들 리필형 스펀지 젖병솔&젖꼭지솔+소독집게 세트 1개입, 크림/크림",
    "마더케이 롱핸들 젖병솔 세트",
  ],
  ["벨라쿠진 잼팟 6리터+유리뚜껑 세트 /인덕션 가능", "벨라쿠진 잼팟 6L 세트"],
  ["BRAUN 브라운체온계 브라운 귀체온계 IRT-6525", "브라운 귀체온계 IRT-6525"],
  ["[밤부베베] 시그니처 거즈손수건_퓨어 10장", "밤부베베 거즈손수건 10장"],
  [
    "매직캔 히포21L 휴지통 냄새차단 인테리어 페달 무소음",
    "매직캔 히포 21L 휴지통",
  ],
  [
    "대림바스 세면대 세면기 필터 워터탭 아기비데 양치수전 수도꼭지 토수구 교체",
    "대림바스 아기비데 워터탭",
  ],
  [
    "단독/아텍스 한방에착 접이식 조립없는 미니 양말 빨래건조대 속옷건조대 원룸형",
    "아텍스 한방에착 미니 빨래건조대",
  ],
  [
    "[컨디션A 대여]NEW 싸이벡스 클라우드티 i-Size 신생아 바구니 카시트 7일대여 렌탈",
    "싸이벡스 클라우드 T 신생아 카시트 대여",
  ],
]);

export function displayTitle(item: Item) {
  return SHORT_TITLES.get(item.title) ?? item.title.replace(/\s+/g, " ").trim();
}

export function productSummary(item: Item) {
  return item.memo.replace(/->/g, "").replace(/\s+/g, " ").trim();
}

export function isDailyPick(item: Item) {
  return item.categories.includes(DAILY_CATEGORY);
}

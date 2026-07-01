# 가격/품절/최저가 동기화 운영안

작성일: 2026-07-01 (KST)

## 문제 정의

현재 앱의 가격은 Notion에서 가져온 정적 값이다. 실제 구매처에서는 가격과 품절 상태가 자주 바뀌므로, 정적 가격을 현재가처럼 노출하면 사용자가 잘못 판단할 수 있다.

## 현재 적용 정책

- 카드와 상세 화면의 주요 가격 영역은 `구매처에서 최신가 확인`으로 표시한다.
- Notion에서 가져온 기존 가격은 `기록가`로만 보조 표시한다.
- 결제 전 최신가와 품절 여부는 구매처에서 확인하도록 안내한다.

## 자동 동기화 원칙

LLM, Hermes, Codex 같은 모델은 가격 숫자의 원천이 아니다. 모델은 다음 작업에만 사용한다.

- 제품명과 후보 상품명의 유사도 판단
- 동일 상품 후보 병합
- 비정상적으로 낮거나 높은 가격 후보 검토
- 품절/재입고 상태가 서로 충돌하는 후보를 검토 목록으로 분류

가격, 품절, 배송비, 판매처명은 공식 쇼핑 API, 판매처/제휴 API, 또는 사용 허가를 받은 데이터 피드에서 받아야 한다.

## 권장 동기화 흐름

1. 단축 URL을 실제 최종 URL로 교체한다.
2. 제품명, 브랜드명, 판매처 도메인, 기존 구매 링크를 기준으로 가격 후보를 수집한다.
3. 후보마다 가격, 배송비, 품절 여부, 판매처명, 상품 URL, 수집 시각을 저장한다.
4. 배송비 포함 최저가를 계산하되, 품절 상품은 제외한다.
5. LLM 검토 단계에서 제품명이 다른 후보, 급격한 가격 변동, 단축 URL 상품은 자동 반영하지 않는다.
6. 검증된 후보만 앱 데이터의 대표 링크와 기록가로 반영한다.
7. GitHub Actions 또는 OCI cron에서 매일 1회 실행한다.

## 필요한 비밀값

비밀값은 repo에 커밋하지 않고 GitHub Secrets 또는 OCI 서버 환경변수로만 관리한다.

- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `PRICE_SYNC_MODEL`
- 모델 공급자 API 키 또는 사내 Hermes/Codex 실행 권한
- 판매처/제휴 API 키가 있다면 해당 secret

## 현재 준비된 명령

```bash
npm run price:check-readiness
npm run price:apply-candidates
```

`price:check-readiness`는 앱 데이터의 구매 링크 도메인, 기록가 유무, 단축 URL 수, 가격 동기화에 필요한 환경변수 준비 상태를 점검한다.

`price:apply-candidates`는 `data/price-candidates.json`에 수집된 후보 중 아래 조건을 통과한 상품만 `bestOffer`로 반영한다.

- 품절 아님
- `https://` 상품 URL
- 가격과 배송비가 유효한 숫자
- 매칭 신뢰도 `high`
- 배송비 포함 총액이 가장 낮은 후보

반영된 `bestOffer`가 있으면 앱의 `보러가기` 버튼은 기존 Notion 링크 대신 검증된 최저가 링크로 이동한다.

후보 파일 예시:

```json
{
  "generatedAt": "2026-07-01T00:00:00.000Z",
  "items": [
    {
      "itemId": "item-95739902b6",
      "offers": [
        {
          "url": "https://example.com/product/123",
          "mallName": "예시몰",
          "price": 32000,
          "shippingFee": 3000,
          "inStock": true,
          "matchConfidence": "high",
          "source": "official-shopping-api",
          "syncedAt": "2026-07-01T00:00:00.000Z",
          "productName": "말랑하니 백색소음기"
        }
      ]
    }
  ]
}
```

## 자동 반영 보류 조건

- 단축 URL만 있고 최종 상품 URL이 확인되지 않은 경우
- 품절 여부가 API마다 다르게 나오는 경우
- 배송비 포함 최저가가 기존 기록가 대비 과도하게 낮거나 높은 경우
- 후보 상품명이 원본 제품명과 충분히 일치하지 않는 경우
- 판매처가 신뢰 목록에 없는 경우

## 구현 순서

1. 현재 화면 정책 반영: 최신가 확인 CTA와 기록가 분리
2. 단축 URL 최종 URL 교체
3. 공식 API 키 준비
4. 가격 후보 수집 스크립트 추가
5. LLM 기반 후보 검토 단계 추가
6. 검증 통과 후보만 `bestOffer`로 `src/data/items.json`에 반영
7. GitHub Actions scheduled workflow 또는 OCI cron으로 매일 실행

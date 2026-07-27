# 가격 동기화 정책

업데이트: 2026-07-26 (KST)

## 사용자 표시 원칙

- Notion의 가격은 현재가가 아닌 `기록가`로만 표시한다.
- 배송비 포함 총액, 재고, 상품 일치, 신뢰 도메인을 모두 확인한 가격만 검증 가격으로 취급한다.
- 검증 가격도 수집 후 48시간이 지나면 `최저가`라고 부르지 않고 `가격 다시 확인`으로 표시한다.
- 배송비 또는 결제 단계 재고가 확인되지 않은 검색 API 결과는 `참고 후보`다.
- 차단 후보는 사유를 보여 줄 수 있지만 클릭 가능한 구매 링크나 대표 CTA로 사용하지 않는다.
- 가격 후보 행은 참고 정보로만 표시하고 직접 상품 페이지 링크를 제공하지 않는다.
- 대표 CTA는 30일 안에 확인된 네이버 판매 근거나 공식몰 실응답이 있을 때만 노출한다.
- 쿠팡 도메인은 구매 링크와 모든 가격 후보 계층에서 차단한다.
- 검증 근거가 없거나 만료된 상품은 버튼 대신 `판매 링크 확인 중` 상태를 표시한다.

정책의 단일 기준 파일은 `config/offer-policy.json`, 검증한 공식몰 목록은 `config/official-purchase-links.json`, 공통 판정 코드는 `scripts/lib/offer-policy.mjs`다.

## 데이터 계층

| 계층 | 필수 조건 | 화면/CTA |
| --- | --- | --- |
| `purchaseOffers` | HTTPS 신뢰 도메인, 재고 있음, 유효한 가격·배송비·총액, `shipping_included`, 검토 플래그 없음 | 48시간 안이면 검증 최저가로 사용 |
| `candidateOffers` | 상품명 high match, HTTPS 신뢰 도메인, 재고 있음, 검토 플래그 없음 | 배송비 미확인 참고가로만 표시 |
| `rejectedOffers` | 상품명 불일치 또는 위험·오매칭 검토 플래그 | 비클릭 검토 정보 |

현재 검토 플래그는 상품명 불일치, 신뢰하지 않는 도메인, 소비기한 임박, 중고·리퍼, 렌탈, 액세서리 불일치를 포함한다.

## 구매 링크 계층

| 상태 | 조건 | 사용자 동작 |
| --- | --- | --- |
| `naver_search` | 30일 이내 네이버 검색 API 또는 수동 검토 근거, 상품명 high match | 정확한 제품명으로 네이버 쇼핑 검색 |
| `official` | 허용 도메인, HTTP 성공, 판매 중지 문구 없음, 상품명 일치, 30일 이내 확인 | 검증한 공식 상품 페이지 열기 |
| `unavailable` | 현재 판매 근거 없음 또는 근거 만료 | 링크를 만들지 않고 확인 중 상태 표시 |

네이버의 개별 상품 URL은 자동 요청을 제한하거나 판매자가 페이지를 교체할 수 있어 대표 CTA로 사용하지 않는다. 대신 검증 시점에 상품 검색 결과가 있었던 제품만 네이버 쇼핑의 정확한 상품명 검색으로 연결한다.

## 현재 상태

`2026-07-01` 수집분 기준:

- 검증 가격 3개, 모두 48시간 초과
- 참고 후보 44개
- 차단 후보 21개
- 단축 URL 0개
- 신뢰하지 않는 구매 도메인 0개
- 구매 링크 29개: 네이버 검색 27개, 검증 공식몰 2개
- 판매 근거가 없어 숨긴 링크 2개
- 쿠팡 구매 링크·가격 후보·이미지 요청 0개

현재 UI에 신선한 최저가는 없다. 대표 CTA는 가격 보장이 아니라 검증된 판매 경로이며, 최신 가격·배송비·재고는 네이버 또는 공식몰에서 다시 확인해야 한다.

## 수동 갱신

비밀값은 Git에 넣지 않고 GitHub Secrets 또는 OCI의 권한 `600`인 `/etc/euni-baby-items/price-sync.env`에서만 주입한다.

```bash
npm run price:check-readiness
npm run price:collect-naver
npm run links:probe-official -- --update-config
npm run price:apply-live-offers
npm run links:check
npm run data:report
npm run data:check
npm run price:check-strict
```

`price:apply-live-offers`는 네이버 결과를 배송비 미확인 참고 후보로 반영한 뒤 구매 링크 정책도 다시 적용한다. `links:probe-official -- --update-config`는 등록된 공식몰의 HTTP 상태, 판매 중지 문구, 상품명 일치를 확인한 경우에만 확인 시각을 갱신한다.

## 자동 수집

`.github/workflows/price-candidates.yml`은 매일 03:17 KST와 수동 실행에서 다음을 수행한다.

1. 네이버 쇼핑 후보 수집
2. 등록된 공식몰 상품 페이지 실응답 검사
3. 검토용 `candidateOffers`와 구매 링크 정책 반영
4. 쿠팡 재유입, 링크 근거 만료, 데이터 품질 엄격 검사
5. 프로덕션 build와 7일 보관 artifact 생성
6. 검증된 앱 데이터만 `main`에 자동 커밋
7. OCI catalog-sync 타이머가 데이터 전용 커밋을 감지해 앱 컨테이너만 재배포
8. 컨테이너 healthcheck와 내부·외부 URL 확인

외부 API를 호출하는 job은 저장소 읽기 권한만 가진다. 검증된 artifact를 적용하는 job만 `contents: write` 권한을 가진다. OCI는 외부에 SSH 개인키를 전달하지 않고 공개 저장소를 읽어 오며, 정확히 세 개의 카탈로그 파일만 바뀐 자동 커밋만 배포한다. 수집·검증·build·배포 중 하나라도 실패하면 새 데이터는 공개하지 않고, 배포 뒤 실패한 경우 직전 카탈로그로 복구를 시도한다. 필요한 GitHub Secrets가 없으면 워크플로는 명시적으로 실패한다.

## OCI 실행 예시

```bash
docker run --rm \
  --env-file /etc/euni-baby-items/price-sync.env \
  -v /opt/stacks/euni-baby-items:/app \
  -w /app \
  node:24-alpine \
  node scripts/check-price-sync-readiness.mjs
```

후보 수집도 같은 방식으로 마지막 명령만 `scripts/collect-naver-price-candidates.mjs`로 바꾼다.

## 자동 반영 보류 조건

- 배송비 포함 총액 또는 재고가 확인되지 않음
- 후보 상품명이 원본 제품명과 충분히 일치하지 않음
- 소비기한 임박, 중고·리퍼, 렌탈 또는 액세서리 상품
- 신뢰 목록에 없는 구매·이미지 도메인
- 단축 URL
- 쿠팡 구매 도메인 또는 쿠팡 가격 후보
- 기존 기록가 대비 하한·상한을 벗어난 급격한 가격 변동

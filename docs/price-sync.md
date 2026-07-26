# 가격 동기화 정책

업데이트: 2026-07-26 (KST)

## 사용자 표시 원칙

- Notion의 가격은 현재가가 아닌 `기록가`로만 표시한다.
- 배송비 포함 총액, 재고, 상품 일치, 신뢰 도메인을 모두 확인한 가격만 검증 가격으로 취급한다.
- 검증 가격도 수집 후 48시간이 지나면 `최저가`라고 부르지 않고 `가격 다시 확인`으로 표시한다.
- 배송비 또는 결제 단계 재고가 확인되지 않은 검색 API 결과는 `참고 후보`다.
- 차단 후보는 사유를 보여 줄 수 있지만 클릭 가능한 구매 링크나 대표 CTA로 사용하지 않는다.

정책의 단일 기준 파일은 `config/offer-policy.json`, 공통 판정 코드는 `scripts/lib/offer-policy.mjs`다.

## 데이터 계층

| 계층 | 필수 조건 | 화면/CTA |
| --- | --- | --- |
| `purchaseOffers` | HTTPS 신뢰 도메인, 재고 있음, 유효한 가격·배송비·총액, `shipping_included`, 검토 플래그 없음 | 48시간 안이면 검증 최저가로 사용 |
| `candidateOffers` | 상품명 high match, HTTPS 신뢰 도메인, 재고 있음, 검토 플래그 없음 | 배송비 미확인 참고가로만 표시 |
| `rejectedOffers` | 상품명 불일치 또는 위험·오매칭 검토 플래그 | 비클릭 검토 정보 |

현재 검토 플래그는 상품명 불일치, 신뢰하지 않는 도메인, 소비기한 임박, 중고·리퍼, 렌탈, 액세서리 불일치를 포함한다.

## 현재 상태

`2026-07-01` 수집분 기준:

- 검증 가격 3개, 모두 48시간 초과
- 참고 후보 60개
- 차단 후보 23개
- 단축 URL 0개
- 신뢰하지 않는 구매 도메인 0개

따라서 현재 UI에 신선한 최저가는 없으며 모든 대표 CTA는 가격 재확인을 요구한다.

## 수동 갱신

비밀값은 Git에 넣지 않고 GitHub Secrets 또는 OCI의 권한 `600`인 `/etc/euni-baby-items/price-sync.env`에서만 주입한다.

```bash
npm run price:check-readiness
npm run price:collect-naver
npm run price:collect-coupang
npm run price:merge-candidates
npm run price:apply-candidates
npm run data:report
npm run data:check
npm run price:check-strict
```

네이버 검색 결과를 배송비 미확인 참고 후보로 반영할 때:

```bash
npm run price:apply-live-offers
```

`price:apply-candidates`는 배송비 포함 총액이 있는 후보만 검증 가격으로 승격한다. `--include-reference-candidates`를 명시할 때만 배송비 미확인 결과를 참고 후보로 보존한다.

## 자동 수집

`.github/workflows/price-candidates.yml`은 매일 03:17 KST와 수동 실행에서 다음을 수행한다.

1. 네이버 쇼핑 후보 수집
2. 검토용 `candidateOffers` 반영
3. 품질 보고서와 엄격 데이터 검사
4. 후보 원본, 제안 앱 데이터, 보고서를 7일 보관 artifact로 업로드

자동 커밋이나 자동 배포는 하지 않는다. 배송비와 결제 단계 재고가 없는 데이터를 현재 최저가로 게시하지 않기 위한 승인 경계다. GitHub Secrets가 없으면 워크플로는 명시적으로 실패한다.

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
- 기존 기록가 대비 하한·상한을 벗어난 급격한 가격 변동

쿠팡은 판매자/제휴 검색 권한과 실제 API path가 준비된 경우에만 사용한다. 일반 seller 상품 조회 API를 공개 상품 최저가 검색으로 간주하지 않는다.

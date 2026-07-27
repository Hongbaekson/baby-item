# 이은이 아빠가 준비하는 육아템

공개 Notion 육아템 목록을 검수 가능한 정적 데이터로 정리해 보여 주는 React 사이트입니다. 운영 주소는 `https://sonleeeun.site`이며, OCI에서 Caddy와 Nginx로 제공합니다.

## 현재 데이터 상태

- 노출 제품 31개이며 데이터 검수 오류가 있는 행은 공개하지 않음
- 구매 링크 수와 최근 점검일은 매일 수집한 판매 근거와 30일 만료 기준으로 계산
- 판매 근거가 없는 상품은 링크를 숨기며, 쿠팡 구매 링크·이미지 요청은 0개
- 구매처 링크는 HTTPS·신뢰 도메인·30일 이내 판매 근거를 모두 통과해야 함
- 단축 URL 0개
- 배송비·결제 단계 재고가 없는 후보는 비클릭 참고 정보로만 표시
- 상품명 불일치·소비기한 임박 등 차단 후보는 구매 링크로 사용하지 않음

수치는 `src/data/items.json`에서 생성한 `data/data-quality-report.json`과 `npm run data:check` 결과를 기준으로 합니다.

## 사용자 기능

- 제품명 검색, 카테고리 필터, 추천순·이름순·기록가순 정렬
- 한 번에 9개씩 보는 `육아템 더 보기`
- 브라우저에 저장되는 찜 목록과 `내 찜`만 보기
- 검색·카테고리·정렬·찜 필터를 URL에 보존하는 공유 가능한 화면
- 상품 상세 URL과 브라우저 뒤로 가기로 닫히는 키보드 접근 가능 모달
- 30일 판매 근거를 기준으로 계산한 운영 상태와 공개 검증 원칙
- 상품별 고정 URL 공유, 사전 작성된 링크·상품 정보 오류 신고
- 모바일 가로형 제품 카드와 검증된 판매 페이지만 여는 하단 고정 버튼
- 회원가입 없이 찜·테마를 현재 브라우저에만 저장하는 개인정보 안내

## 로컬 실행

Node.js 24 LTS를 사용합니다.

```bash
npm ci
npm run dev
```

기본 주소는 `http://localhost:5173`입니다. 프로덕션 결과는 다음과 같이 확인합니다.

```bash
npm run build
npm run serve:dist
```

## 검증

```bash
npm run data:report
npm run data:check
npm run links:check
npm run price:check-strict
npm run format:check
npm run lint
npm test
npm run build
npm run test:e2e
npm run monitor:production
docker compose config
docker build -t euni-baby-items:local .
```

검증 범위에는 가격 정책 단위 테스트, 데이터 정합성, 검색·찜·더 보기·URL 상태, 키보드 모달 조작, 자동 접근성 검사, 데스크톱·모바일 반응형 검사가 포함됩니다. `monitor:production`은 운영 홈페이지와 정적 자산, HTTPS 전환, 보안 헤더, robots·sitemap, 필수 이미지를 실제 공개 주소에서 확인합니다.

## 가격 데이터 갱신

가격은 다음 세 단계로 분리합니다.

1. `purchaseOffers`: 재고와 배송비 포함 총액이 확인된 구매 정보
2. `candidateOffers`: 상품명은 맞지만 배송비 또는 결제 단계 재고가 확인되지 않은 참고 후보
3. `rejectedOffers`: 상품 불일치, 소비기한 임박, 중고·렌탈·액세서리 등 검토 사유가 있는 차단 후보

가격 신선도 기준은 48시간입니다. 이 시간이 지난 숫자는 최저가로 표시하지 않습니다. 구매 링크는 별도로 30일 안에 확인된 네이버 판매 근거나 공식몰 실응답이 있어야 하며, 근거가 없거나 만료되면 CTA를 노출하지 않습니다.

```bash
npm run price:check-readiness
npm run price:collect-naver
npm run links:probe-official -- --update-config
npm run price:apply-live-offers
npm run links:check
npm run data:report
npm run data:check
```

네이버 쇼핑 검색 API는 배송비와 결제 직전 재고를 제공하지 않으므로 결과를 `candidateOffers`로만 반영합니다. 공개 CTA도 오류가 잦은 직접 상품 URL 대신 정확한 상품명을 넣은 네이버 쇼핑 검색으로 연결합니다. 쿠팡 수집과 구매 링크는 사용하지 않습니다.

매일 03:17 KST에 실행되는 `price-candidates.yml`은 네이버 후보, 공식몰 실응답, 구매 링크 만료 여부를 검사합니다. 링크·데이터·프로덕션 build 검증이 모두 성공한 경우에만 정제된 앱 데이터를 `main`에 자동 커밋합니다. OCI의 catalog-sync 타이머는 해당 세 파일만 바뀐 자동 커밋을 감지해 앱 컨테이너를 재배포하고 내부·외부 응답을 확인합니다. 배송비와 결제 단계 재고가 없는 네이버 결과는 자동 배포 후에도 비클릭 참고 후보이며 현재 최저가로 게시하지 않습니다.

`production-smoke.yml`은 매시 17분과 47분에 운영 URL의 응답, 핵심 정적 파일, HTTPS 전환, 보안 헤더를 확인합니다. 실패는 GitHub Actions 실행 결과로 남으며 같은 검사는 `npm run monitor:production`으로 수동 재현할 수 있습니다.

자세한 정책은 `docs/price-sync.md`에 있습니다.

## 데이터 재생성

```bash
npm run data:extract
npm run data:normalize
npm run data:check
```

`data:normalize`는 이전의 가격 계층과 동기화된 이미지·직접 링크를 보존하고, 마지막에 품질 보고서도 다시 생성합니다. 원본 Notion 공개 설정이 바뀌면 `data:extract`는 실패할 수 있습니다.

## Docker와 배포

```bash
docker compose config
APP_PORT=1206 docker compose up -d --build
```

- Caddy가 80/443에서 HTTPS 종료와 인증서 갱신을 담당합니다.
- 앱의 Nginx 포트는 `127.0.0.1:1206`에만 바인딩됩니다.
- 컨테이너는 read-only filesystem, 최소 capability, PID 제한을 사용합니다.
- Node, Nginx, Caddy 이미지는 digest로 고정하고 Dependabot으로 갱신합니다.

운영 상태와 재배포 절차는 `docs/deployment-status.md`, CI 산출물 정책은 `docs/cicd-integrity.md`를 참고합니다.

## 제휴 링크 고지

일부 링크는 제휴 링크일 수 있습니다. 링크를 통한 구매 시 운영자에게 수수료가 지급될 수 있지만 구매 가격에는 영향을 주지 않습니다. 같은 문구를 사이트 푸터와 상품 상세에도 표시합니다.

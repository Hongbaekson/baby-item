# 이은이 아빠가 준비하는 육아템

공개 Notion 육아템 목록을 정리해 만든 정적 React 사이트입니다. 1차 운영 방식은 DNS 없이 OCI public IP로 접근하는 공개 조회 사이트입니다.

## 현재 상태

- 제품 데이터: 37개 canonical 제품
- 원본 중복 병합: 7개 그룹
- 빈 제목 draft: 2개 숨김
- 이미지: 사용 가능한 상품 썸네일 URL을 우선 표시하고, 없으면 카테고리별 로컬 SVG placeholder 사용
- 링크: `https://` 형식 검증 완료
- 가격: 화면에는 구매처 최신가 확인 CTA를 노출하고, Notion 기준 가격은 `기록가`로만 표시
- 구매처별 가격: 검증된 후보가 있으면 상세 화면에서 네이버/쿠팡 등 링크별 가격을 비교 표시
- 검수 필요: 1개 제품의 원본 메모가 육아템과 무관한 내용일 가능성이 있어 배지로 표시

## 로컬 실행

```bash
npm install
npm run dev
```

개발 서버 기본 주소:

```text
http://localhost:5173
```

프로덕션 빌드 결과를 로컬에서 확인할 때:

```bash
npm run build
npm run serve:dist
```

정적 서버 기본 주소:

```text
http://localhost:4173
```

## 데이터 갱신

Notion 데이터를 다시 가져와 앱 데이터를 재생성할 때:

```bash
npm run data:extract
npm run data:normalize
npm run data:check
```

`data:extract`는 원본 Notion 공개 API 응답에 의존합니다. Notion 페이지 공개 설정이 바뀌면 실패할 수 있습니다.

가격/품절/최저가 자동 갱신은 공식 쇼핑 API 또는 허용된 판매처 피드가 준비된 뒤 활성화합니다. 현재 준비 상태 점검:

```bash
npm run price:check-readiness
```

네이버 쇼핑 검색 API로 가격 후보를 수집할 때:

```bash
npm run price:collect-naver
```

쿠팡 API로 가격 후보를 수집할 때:

```bash
npm run price:collect-coupang
```

플랫폼별 후보 파일을 합칠 때:

```bash
npm run price:merge-candidates
```

수집된 가격 후보를 앱 데이터에 반영할 때:

```bash
npm run price:apply-candidates
```

`price:collect-naver`는 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`이 있을 때 `data/price-candidates.naver.json`을 생성합니다. 네이버 쇼핑 검색 API는 상품 썸네일을 제공하지만 배송비와 결제 단계 재고를 명시하지 않으므로, 이 파일은 후보 수집용입니다.

`price:collect-coupang`은 `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`가 있을 때 쿠팡 HMAC 서명 방식으로 후보를 수집합니다. 실제 계정에서 사용하는 상품 검색 API path가 다르면 `COUPANG_SEARCH_PATH`로 바꿉니다.

`price:merge-candidates`는 `data/price-candidates.coupang.json`, `data/price-candidates.naver.json`을 `data/price-candidates.json`으로 합칩니다.

`price:apply-candidates`는 `data/price-candidates.json`에서 품절이 아니고, 배송비 포함 총액이 있으며, 매칭 신뢰도가 높은 후보만 `bestOffer`와 `purchaseOffers`로 반영합니다. `bestOffer`가 있으면 `보러가기` 버튼은 기존 링크 대신 검증된 최저가 링크로 이동하고, 상세 화면에는 링크별 가격을 표시합니다. 최근 동기화에서 구매 가능한 후보가 없으면 해당 제품의 구매 링크는 숨깁니다.

가격 갱신은 Hermes/LLM 없이 공식 API와 규칙 기반 검증으로 운영합니다. 자세한 운영안은 `docs/price-sync.md`에 정리되어 있습니다.

## 품질 확인

배포 전 최소 확인:

```bash
npm run data:check
npm audit --audit-level=moderate
npm run build
```

현재 `data:check`는 다음을 확인합니다.

- 제품 ID 중복 여부
- 제목 누락 여부
- 파트너스 링크 프로토콜 형식
- 로컬 이미지 파일 존재 여부
- 품질 상태별 제품 수

## CI 산출물 무결성

GitHub Actions는 빌드 결과를 `euni-baby-items-<commit-sha>.tar.gz`로 패키징하고 `SHA256SUMS`를 생성합니다. `main` push 산출물에는 GitHub artifact attestation을 발급합니다.

상세 기준과 CD 적용 순서는 `docs/cicd-integrity.md`에 정리되어 있습니다.

## Docker 로컬 준비

Docker Compose 설정 확인:

```bash
docker compose config
```

로컬 Docker 실행:

```bash
docker compose up -d --build
```

기본 포트는 OCI 공개 기준에 맞춰 `1206`입니다.

```text
http://localhost:1206
```

OCI에서도 같은 포트로 공개합니다.

```bash
APP_PORT=1206 docker compose up -d --build
```

## 보안 기준

상세 점검 기록은 `docs/security-review.md`에 정리되어 있습니다.

- 외부 구매 링크는 `https://`만 허용합니다.
- 앱 화면에 연결 도메인을 표시합니다.
- 단축 URL은 `단축 링크` 배지로 표시합니다.
- 가격 동기화 후 품절/삭제로 판단된 구매 링크는 화면에 표시하지 않습니다.
- Nginx 응답에 CSP, frame 방어, MIME sniffing 방어, permissions policy를 적용합니다.
- Docker 컨테이너는 read-only filesystem과 제한된 capability로 실행합니다.

## OCI 배포 전 주의

기존 OCI 서버에 `h-log` 같은 다른 프로젝트가 있어도 폴더, 컨테이너명, 포트가 겹치지 않으면 같이 둘 수 있습니다. 이 프로젝트는 `/opt/stacks/euni-baby-items` 경로에 두고, 컨테이너명은 `euni-baby-items-web`으로 분리합니다.

접속 주소는 DNS 없이 아래 형식을 기준으로 합니다.

```text
http://<OCI_PUBLIC_IP>:1206
```

현재 OCI 배포 상태는 `docs/deployment-status.md`에 기록합니다.

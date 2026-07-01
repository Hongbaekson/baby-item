# 보안 점검 기록

점검일: 2026-07-01 (KST)

## 범위

- React/Vite 정적 앱 코드
- 제품 데이터와 외부 구매 링크
- GitHub Actions CI
- Docker Compose / Nginx 배포 설정
- OCI 공개 IP 배포 전 노출면

## 확인 결과

### 앱 코드

- `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` 사용 없음
- 사용자 입력은 검색 필터에만 사용하며 HTML로 삽입하지 않음
- React 기본 escaping에 의존하는 구조라 현재 데이터 표시 경로의 XSS 위험은 낮음
- 외부 링크는 새 창으로 열고 `rel="noopener noreferrer"`를 명시

### 피싱/외부 링크

- 외부 구매 링크 도메인 분포:
  - `link.coupang.com`
  - `smartstore.naver.com`
  - `brand.naver.com`
  - `bit.ly`
  - `naver.me`
- `http://` 링크 1개는 `https://`로 보정
- 앱 화면에 연결 도메인을 표시하도록 개선
- 단축 URL은 모달에서 `단축 링크` 배지로 표시
- 단축 URL은 현재 유지하고, 운영 후 실제 최종 URL로 교체한다.

남은 리스크:

- `bit.ly`, `naver.me` 같은 단축 URL은 최종 목적지를 사용자가 보기 어렵다.
- 피싱 방어 수준을 더 높이려면 단축 URL을 최종 도메인 URL로 교체하는 작업이 필요하다.
- 단축 URL을 실제로 열어 리다이렉트 목적지를 확인하면 제휴 클릭/통계에 영향이 생길 수 있어, 운영 후 별도 교체 작업으로 진행한다.

### 가격/품절 동기화

- 화면의 주요 가격 영역은 현재가 숫자 대신 구매처 최신가 확인 CTA로 표시한다.
- 기존 Notion 가격은 `기록가`로만 보조 표시해 현재 가격처럼 보이지 않게 한다.
- 가격/품절 자동 동기화는 공식 API 또는 허용된 판매처 피드가 준비된 뒤 켠다.
- Hermes/LLM 없이 공식 API와 규칙 기반 검증만 사용한다.
- `보러가기` 버튼은 `bestOffer`가 있을 때만 검증된 최저가 링크로 대체한다.
- 상세 화면의 구매처별 가격은 `purchaseOffers`에 들어간 검증 후보만 표시한다.
- `bestOffer`와 `purchaseOffers` 자동 반영 조건은 HTTPS URL, 품절 아님, 유효한 가격/배송비, 높은 제품 매칭 신뢰도다.
- 최근 동기화에서 구매 가능한 후보가 없으면 기존 구매 링크를 숨겨 품절/삭제 링크 클릭을 줄인다.
- 상품 썸네일 외부 도메인은 CSP와 데이터 검증에서 허용 목록으로 제한한다.
- API 키는 GitHub Secrets 또는 OCI 환경변수로만 관리하고 repo에 커밋하지 않는다.

### 의존성

검증 명령:

```bash
npm audit --audit-level=moderate
```

결과:

- 취약점 0개

### CI

GitHub Actions:

- `permissions: contents: read`, `id-token: write`, `attestations: write`, `artifact-metadata: write`
- `pull_request_target` 미사용
- 현재 secret 사용 없음
- CI에 `npm audit --audit-level=moderate` 포함
- CI에 `npm run data:check`, `npm run build`, `docker compose config` 포함
- 빌드 산출물 tarball과 `SHA256SUMS` 생성
- `main` push 산출물에 GitHub artifact attestation 발급

무결성 기준:

- 배포 가능한 기준 산출물은 `main` push에서 생성된 artifact다.
- PR은 배포 대상이 아니므로 빌드/체크섬/업로드까지 검증한다.
- 자동 CD를 붙일 때는 OCI 배포 전에 `sha256sum -c SHA256SUMS`와 attestation 검증을 통과한 산출물만 반영한다.

### Docker / Nginx

적용한 보호:

- Nginx 보안 헤더 추가
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
  - `Cross-Origin-Opener-Policy`
- DNS 없이 public IP HTTP로 운영 중이므로 CSP의 `upgrade-insecure-requests`는 적용하지 않는다. 이 지시문은 HTTPS가 없는 현재 배포에서 JS/CSS 요청을 HTTPS로 강제해 React 앱 렌더링을 막는다.
- Compose 컨테이너 하드닝
  - `read_only: true`
  - `no-new-privileges:true`
  - `cap_drop: ALL`
  - 필요한 capability만 재추가: `CHOWN`, `NET_BIND_SERVICE`, `SETGID`, `SETUID`
  - `tmpfs`로 Nginx runtime 쓰기 경로 분리
  - `pids_limit: 100`
  - healthcheck 추가

실행 검증:

- Docker 이미지 빌드 성공
- 임시 포트 `18080`에서 HTTP 200 확인
- 컨테이너 healthcheck `healthy` 확인
- 보안 헤더 응답 확인

## OCI 배포 보안 기준

- Security List 또는 NSG는 실제 공개 포트 `1206`만 연다.
- DNS 없이 public IP로 배포하므로 MVP는 HTTP 기준이다.
- SSH 포트는 가능하면 본인 IP로 제한한다.
- `h-log`와 같은 기존 프로젝트와 포트/컨테이너명/경로가 겹치지 않게 한다.
- GitHub Actions CD secret은 수동 배포가 한 번 성공한 뒤 추가한다.
- CD workflow는 `main` push에서만 실행하고 PR에서는 배포하지 않는다.

## 남은 작업

1. 단축 URL을 실제 최종 URL로 교체
2. SSH 접근을 특정 IP로 제한할지 결정

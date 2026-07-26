# 보안 점검 기록

점검일: 2026-07-26 (KST)

## 앱과 외부 링크

- `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`을 사용하지 않는다.
- 검색 문자열과 JSON 데이터는 React escaping 경로로만 렌더링한다.
- 외부 구매 링크는 HTTPS와 `config/offer-policy.json`의 신뢰 도메인을 모두 통과해야 한다.
- 쿠팡 구매 도메인은 차단 목록으로 관리하며 대표·후보·제외 링크 재유입을 CI에서 실패시킨다.
- 쿠팡 이미지 CDN도 차단하며 대체 이미지가 없으면 로컬 카테고리 기본 이미지를 사용한다.
- 구매 링크는 30일 이내 판매 근거가 있어야 하며 만료 시 런타임에서도 CTA를 숨긴다.
- 공개 운영 상태의 유효 링크 수도 같은 30일 런타임 기준으로 계산한다.
- 새 창 링크는 `rel="noopener noreferrer sponsored"`를 사용한다.
- 단축 URL은 0개이며 readiness와 데이터 검사에서 재유입을 실패로 처리한다.
- 외부 상품 이미지도 CSP와 데이터 검사의 도메인 허용 목록을 모두 통과해야 한다.
- 제휴 링크 고지를 푸터와 상품 상세에 노출한다.
- 오류 신고 링크는 GitHub의 새 이슈 화면만 열고 상품명·공개 URL·현재 판매 경로만 사전 입력한다. 개인정보를 적지 말라는 안내를 포함한다.

## 개인정보와 브라우저 저장

- 회원가입, 서버 API, 서버 로그인을 제공하지 않으며 앱에서 개인정보를 수집·전송하지 않는다.
- 찜 목록과 화면 테마만 브라우저 `localStorage`에 저장한다.
- 상품 공유는 공개 상품 ID가 포함된 고정 URL만 사용하고 개인 상태를 포함하지 않는다.
- 위 내용을 사이트 푸터에 공개한다.

## 가격 오인 방지

- 현재가와 Notion 기록가를 분리한다.
- 배송비 포함 총액과 재고가 확인된 후보만 검증 가격이다.
- 검증 가격의 신선도는 48시간이며 오래된 가격을 최저가로 표시하지 않는다.
- 배송비 미확인 후보는 참고 정보, 불일치·위험 후보는 비클릭 검토 정보다.
- 직접 상품 페이지 후보는 클릭할 수 없고, 공개 CTA는 네이버 정확한 상품명 검색 또는 실응답을 확인한 공식몰만 사용한다.
- 상품명 매칭은 후보 제목만 대상으로 하며 판매처명이나 카테고리 문자열로 점수를 부풀리지 않는다.
- API 키는 GitHub Secrets 또는 OCI의 repo 외부 env 파일에서만 주입한다.

## 의존성과 공급망

- 프로덕션 컨테이너의 build stage는 Node.js 24 LTS를 사용한다.
- Node, Nginx, Caddy 이미지는 multi-architecture digest로 고정한다.
- GitHub Actions도 commit SHA로 고정한다.
- Dependabot이 npm, Docker, GitHub Actions 업데이트를 매주 확인한다.
- CI는 `npm ci` 후 `npm audit --audit-level=moderate`를 실행한다.

로컬 의존성 설치에서 확인된 PostCSS 경로 탐색 advisory
(`GHSA-r28c-9q8g-f849`)는 `postcss@8.5.23`으로 업데이트해 해결했다.
업데이트 후 `npm audit --audit-level=moderate` 결과는 취약점 0개다.

## CI 권한

- 기본 workflow 권한은 `contents: read`다.
- attestation job만 `id-token`, `attestations`, `artifact-metadata` 쓰기 권한을 가진다.
- `pull_request_target`을 사용하지 않는다.
- 검증 job은 데이터, 가격 정책, 쿠팡 차단·구매 링크 만료, 포맷, lint, 단위/컴포넌트/E2E, 접근성, build, Docker Compose와 이미지 build를 검사한다.
- `main` push artifact에 SHA256 체크섬과 GitHub attestation을 붙인다.
- 가격 후보 scheduled workflow는 읽기 권한만 가지며 자동 커밋·배포하지 않는다.
- 운영 smoke workflow도 읽기 권한만 가지며 매시 17분과 47분에 공개 응답·정적 자산·HTTPS 전환·보안 헤더를 확인한다.

## Caddy와 Nginx

- Caddy가 TLS 종료, HTTP→HTTPS 전환, 인증서 갱신을 담당한다.
- Nginx는 CSP, MIME sniffing 방어, frame 방어, referrer policy, permissions policy, COOP를 모든 응답에 적용한다.
- Nginx `add_header` 상속 규칙 때문에 `/assets/`, `/images/`에도 보안 헤더 include를 명시한다.
- hash가 붙은 `/assets/`만 1년 immutable cache를 사용한다.
- 고정 파일명인 `/images/`는 1일 cache로 제한한다.
- 운영 앱은 `127.0.0.1:1206`에만 바인딩하고 외부 공개는 Caddy를 통한다.

## 컨테이너

- 두 서비스 모두 read-only filesystem과 `no-new-privileges`를 사용한다.
- 모든 capability를 제거한 뒤 필요한 capability만 재추가한다.
- runtime 쓰기 경로는 `tmpfs`로 제한한다.
- PID 제한과 Nginx healthcheck를 사용한다.

## 남은 운영 보안 항목

1. SSH ingress를 운영자 IP로 제한할지 결정한다.
2. 네이버 API scheduled workflow의 첫 성공 artifact를 확인한다.

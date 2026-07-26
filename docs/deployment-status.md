# OCI 배포 상태

업데이트: 2026-07-26 (KST)

> 2026-07-26에 가격 신뢰성, 운영 신뢰 UX, UI·접근성, CI, 컨테이너 변경을 OCI에 배포하고 운영 URL에서 재확인했다.

## 배포 정보

- 서버 접속: `ssh oci`
- Public IP: `134.185.110.26`
- OCI region: `ap-chuncheon-1`
- 인스턴스 표시 이름: `prod-app-01`
- VM private IP: `10.0.0.44`
- 배포 경로: `/opt/stacks/euni-baby-items`
- 배포 Git commit: `e3287fa`
- 직전 롤백 commit: `4bbd795`
- 컨테이너명: `euni-baby-items-web`
- Edge 컨테이너명: `euni-baby-items-edge`
- 공개 주소: `https://sonleeeun.site`
- 내부 앱 포트 설정: `APP_PORT=1206` (`127.0.0.1` loopback 바인딩)

## 2026-07-26 운영 신뢰 UX 배포 결과

- 운영 신뢰 UX 커밋 `e3287fa` 배포 완료
- 새 웹 이미지: `sha256:e01770ce65d69fa5bec2afb4a7b9868a2812025def4e372253513494b85c70e1`
- 직전 웹 이미지: `sha256:9637c85303688079f97dd107273a781101172e8bb63c3a3b32a74e5c4c2a3428`
- GitHub CI run `30193924727`의 전체 검증, build artifact와 attestation 성공
- 화면을 여는 시점의 30일 만료 기준으로 판매 근거 `29/31`, 숨김 `2개`, 최근 점검일을 표시
- 검증 원칙, 상품 고정 URL 공유, 상품별 사전 작성 오류 신고, 브라우저 저장·제휴 안내 반영
- 매시 17분과 47분에 공개 URL·HTTPS 전환·보안 헤더·정적 자산을 확인하는 `production-smoke.yml` 추가
- 운영 smoke 16개 검사 통과: HTTP 200, HTTPS 308 전환, 보안 헤더, 새 JS/CSS, robots, sitemap, 필수 이미지
- 데스크톱과 390×844 모바일 브라우저에서 새 운영 UI와 상품 상세 확인
- 운영 브라우저에서 쿠팡 anchor 0개, 쿠팡 resource 요청 0개, 콘솔 오류 0개
- `euni-baby-items-web` 상태 `running`, healthcheck `healthy`
- 외부 `https://sonleeeun.site/`와 `https://issuebot.sonleeeun.site/healthz` 모두 HTTP 200
- 운영 Caddyfile의 기존 IssueBot 라우팅 수정과 백업 파일을 그대로 보존

## 2026-07-26 구매 링크 검증 배포 결과

- 구매 링크 검증 최종 커밋 `4bbd795` 배포 완료
- 새 웹 이미지: `sha256:9637c85303688079f97dd107273a781101172e8bb63c3a3b32a74e5c4c2a3428`
- 직전 웹 이미지: `sha256:7ac85b62c194972298c845ac087f9470c8d445b63af128bc9bf0e40f2fcb0675`
- GitHub CI run `30193243831`의 전체 검증과 artifact attestation 성공
- 운영 데이터 기준 구매 링크 29개: 네이버 검색 27개, 실응답 확인 공식몰 2개
- 판매 근거가 없는 2개 상품은 CTA를 숨기고 `판매 링크 확인 중` 상태로 표시
- 운영 브라우저에서 쿠팡 anchor 0개, 쿠팡 resource 요청 0개 확인
- `젖병 소독 냄비`는 구매 링크 없이 로컬 카테고리 기본 이미지 사용 확인
- CSP에서 쿠팡 이미지 CDN 허용 제거 확인
- `euni-baby-items-web` 상태 `running`, healthcheck `healthy`
- 외부 `https://sonleeeun.site/`와 `https://issuebot.sonleeeun.site/healthz` 모두 HTTP 200
- 운영 Caddyfile의 기존 IssueBot 라우팅 수정과 백업 파일을 그대로 보존
- 운영 브라우저 콘솔 오류 0개

이전 가격 신뢰성·UI 배포:

- `origin/main`의 `935bb36`으로 fast-forward한 뒤 `docker compose up -d --build` 완료
- 당시 웹 이미지: `sha256:f8c80cc3a19175898d21197365e65e59ae95dae4fa1147236f2ca93544411b59`
- `euni-baby-items-web` 상태 `running`, healthcheck `healthy`
- 내부 `http://127.0.0.1:1206/`와 외부 `https://sonleeeun.site/` 모두 HTTP 200
- CSP, HSTS, frame 방어, MIME sniffing 방어, referrer policy, permissions policy, COOP 확인
- 외부 브라우저에서 검색·카테고리·정렬·찜·9개 더 보기와 상세 URL 렌더링 확인
- 모바일 390×844에서 상세 모달과 하단 고정 최신가 확인 CTA 확인
- 공유 edge 재생성 후 `https://issuebot.sonleeeun.site/healthz` HTTP 200 확인
- 운영 Caddyfile의 잘못된 `"n"issuebot...` 접두사를 `issuebot...`으로 교정하고 무중단 reload
- 교정 전 Caddyfile 백업: `/opt/stacks/euni-baby-items/Caddyfile.pre-baby-item-deploy-935bb36`
- Caddy 교정 후 두 공개 도메인 HTTP 200, 신규 edge 오류 로그 없음

## 완료된 작업

- GitHub repo clone 완료
- 서버 `.env` 생성 완료
- Docker image build 완료
- `docker compose up -d --build` 완료
- 컨테이너 healthcheck `healthy` 확인
- VM 내부 방화벽 iptables 1206 허용 규칙 추가 및 영구 저장 완료
- 서버 내부 응답 확인 완료
- 2026-07-01 최신 `main`으로 fast-forward 후 컨테이너 재생성 완료
- OCI Security List에 TCP `1206` ingress 추가 완료
- 외부 PC에서 public IP HTTP 200 확인 완료
- HTTP public IP 배포 기준에 맞게 CSP에서 `upgrade-insecure-requests` 제거 완료
- headless Chrome 기준 React 렌더링 DOM 확인 완료
- 브랜드명 `이은이 아빠가 준비하는 육아템` 반영 준비 완료
- 소셜 미리보기 이미지 `/site-preview.png` 반영 준비 완료
- 가격 표시는 구매처 최신가 확인 CTA와 기록가로 분리 준비 완료
- 검증된 `bestOffer`가 있으면 `보러가기` 버튼이 최저가 링크를 우선 사용하도록 준비 완료
- 검증된 `purchaseOffers`가 있으면 상세 화면에서 링크별 가격을 표시하도록 준비 완료
- DNS `sonleeeun.site` A 레코드가 `134.185.110.26`으로 전파됨
- Caddy edge 컨테이너로 HTTPS termination과 자동 인증서 갱신을 수행하도록 Compose 설정 준비 완료
- OCI Security List에 TCP `80`, TCP `443`, UDP `443` ingress 추가 완료
- Let's Encrypt 인증서 발급 완료
- `http://sonleeeun.site` -> `https://sonleeeun.site/` 308 redirect 확인 완료
- `https://sonleeeun.site` HTTP 200 확인 완료

서버 내부 검증:

```bash
curl -I http://127.0.0.1:1206
curl -I http://10.0.0.44:1206
curl -I https://sonleeeun.site
```

응답 상태:

- HTTP 200
- Nginx 보안 헤더 적용 확인

외부 검증:

- public TCP `1206` 연결 성공
- `http://134.185.110.26:1206` HTTP 200
- HTML title/description과 asset 경로 확인 완료
- Nginx 보안 헤더 적용 확인
- 실제 브라우저 렌더링 후 `이은이 아빠가 준비하는 육아템`, 제품 목록, 카테고리 필터 노출 확인 완료
- 도메인 HTTPS 응답에서 CSP, HSTS, frame 방어, MIME sniffing 방어, permissions policy 확인 완료

## 남은 작업

- SSH ingress를 `0.0.0.0/0`에서 본인 IP로 제한할지 결정
- 자동 CD를 붙일 때 체크섬과 attestation 검증 후 배포하도록 구성
- IssueBot site block을 서버의 추적되지 않은 Caddyfile 수정이 아닌 별도 운영 구성으로 영구 관리

## 운영 명령

상태 확인:

```bash
ssh oci
cd /opt/stacks/euni-baby-items
docker compose ps
docker logs euni-baby-items-edge --tail 100
docker logs euni-baby-items-web --tail 100
```

재배포:

```bash
ssh oci
cd /opt/stacks/euni-baby-items
git pull
docker compose up -d --build
```

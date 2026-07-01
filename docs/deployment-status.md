# OCI 배포 상태

업데이트: 2026-07-01 (KST)

## 배포 정보

- 서버 접속: `ssh oci`
- Public IP: `134.185.110.26`
- OCI region: `ap-chuncheon-1`
- 인스턴스 표시 이름: `prod-app-01`
- VM private IP: `10.0.0.44`
- 배포 경로: `/opt/stacks/euni-baby-items`
- Git commit: 서버에서 `git rev-parse --short HEAD`로 확인
- 컨테이너명: `euni-baby-items-web`
- Edge 컨테이너명: `euni-baby-items-edge`
- 공개 주소: `https://sonleeeun.site`
- 내부 앱 포트 설정: `APP_PORT=1206` (`127.0.0.1` loopback 바인딩)

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

## 남은 작업

- OCI Security List에 TCP `80`, TCP `443`, 필요 시 UDP `443` ingress 추가
- `https://sonleeeun.site` 인증서 발급과 외부 HTTP 200 검증
- SSH ingress를 `0.0.0.0/0`에서 본인 IP로 제한할지 결정
- 자동 CD를 붙일 때 체크섬과 attestation 검증 후 배포하도록 구성

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

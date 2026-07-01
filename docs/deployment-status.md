# OCI 배포 상태

업데이트: 2026-07-01 (KST)

## 배포 정보

- 서버 접속: `ssh oci`
- Public IP: `134.185.110.26`
- OCI region: `ap-chuncheon-1`
- 인스턴스 표시 이름: `prod-app-01`
- VM private IP: `10.0.0.44`
- 배포 경로: `/opt/stacks/euni-baby-items`
- Git commit: `0a94a4c`
- 컨테이너명: `euni-baby-items-web`
- 공개 주소: `http://134.185.110.26:1206`
- 앱 포트 설정: `APP_PORT=1206`

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

서버 내부 검증:

```bash
curl -I http://127.0.0.1:1206
curl -I http://10.0.0.44:1206
```

응답 상태:

- HTTP 200
- Nginx 보안 헤더 적용 확인

외부 검증:

- public TCP `1206` 연결 성공
- `http://134.185.110.26:1206` HTTP 200
- HTML title/description과 asset 경로 확인 완료
- Nginx 보안 헤더 적용 확인

## 남은 작업

- 단축 URL을 실제 최종 URL로 교체
- SSH ingress를 `0.0.0.0/0`에서 본인 IP로 제한할지 결정
- 자동 CD를 붙일 때 체크섬과 attestation 검증 후 배포하도록 구성

## 운영 명령

상태 확인:

```bash
ssh oci
cd /opt/stacks/euni-baby-items
docker compose ps
docker logs euni-baby-items-web --tail 100
```

재배포:

```bash
ssh oci
cd /opt/stacks/euni-baby-items
git pull
docker compose up -d --build
```

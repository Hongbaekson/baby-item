# OCI 배포 상태

업데이트: 2026-07-01 (KST)

## 배포 정보

- 서버 접속: `ssh oci`
- Public IP: `134.185.110.26`
- 배포 경로: `/opt/stacks/euni-baby-items`
- Git commit: `8dd88ce`
- 컨테이너명: `euni-baby-items-web`
- 공개 예정 주소: `http://134.185.110.26:1206`
- 앱 포트 설정: `APP_PORT=1206`

## 완료된 작업

- GitHub repo clone 완료
- 서버 `.env` 생성 완료
- Docker image build 완료
- `docker compose up -d --build` 완료
- 컨테이너 healthcheck `healthy` 확인
- VM 내부 방화벽 iptables 1206 허용 규칙 추가 및 영구 저장 완료
- 서버 내부 응답 확인 완료

서버 내부 검증:

```bash
curl -I http://127.0.0.1:1206
curl -I http://10.0.0.44:1206
```

응답 상태:

- HTTP 200
- Nginx 보안 헤더 적용 확인

## 남은 작업

외부 PC에서 `http://134.185.110.26:1206` 접속은 아직 타임아웃이다.

서버 내부 컨테이너와 VM 방화벽은 정상이라, 남은 원인은 OCI 네트워크 레벨 ingress다. OCI Console에서 이 인스턴스가 속한 Security List 또는 NSG에 아래 규칙을 추가해야 한다.

```text
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 1206
Description: euni-baby-items public site
```

규칙 추가 후 확인:

```text
http://134.185.110.26:1206
```

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

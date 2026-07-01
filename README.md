# 이은이 육아템

공개 Notion 육아템 목록을 정리해 만든 정적 React 사이트입니다. 1차 운영 방식은 DNS 없이 OCI public IP로 접근하는 공개 조회 사이트입니다.

## 현재 상태

- 제품 데이터: 37개 canonical 제품
- 원본 중복 병합: 7개 그룹
- 빈 제목 draft: 2개 숨김
- 이미지: Notion 서명 URL 대신 카테고리별 로컬 SVG placeholder 사용
- 링크: `http://` 또는 `https://` 형식 검증 완료
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

## 품질 확인

배포 전 최소 확인:

```bash
npm run data:check
npm run build
```

현재 `data:check`는 다음을 확인합니다.

- 제품 ID 중복 여부
- 제목 누락 여부
- 파트너스 링크 프로토콜 형식
- 로컬 이미지 파일 존재 여부
- 품질 상태별 제품 수

## Docker 로컬 준비

Docker Compose 설정 확인:

```bash
docker compose config
```

로컬 Docker 실행:

```bash
docker compose up -d --build
```

기본 포트는 기존 서버와 충돌을 줄이기 위해 `8080`입니다.

```text
http://localhost:8080
```

OCI에서 public IP 기본 HTTP 포트로 열려면 실행 전에 `APP_PORT=80`을 지정합니다.

```bash
APP_PORT=80 docker compose up -d --build
```

## OCI 배포 전 주의

기존 OCI 서버에 `h-log` 같은 다른 프로젝트가 있어도 폴더, 컨테이너명, 포트가 겹치지 않으면 같이 둘 수 있습니다. 이 프로젝트는 `/opt/euni-baby-items` 같은 별도 경로에 두고, 컨테이너명은 `euni-baby-items-web`으로 분리합니다.

같은 public IP에서 포트 없이 `http://<public-ip>`로 접속하려면 80 포트는 하나의 서비스만 사용할 수 있습니다. 이미 `h-log`가 80 포트를 쓰고 있으면 이 사이트는 다른 포트로 열거나, Nginx reverse proxy 구성을 따로 잡아야 합니다.

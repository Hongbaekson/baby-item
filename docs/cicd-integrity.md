# CI/CD 산출물 무결성 계획

작성일: 2026-07-01 (KST)

## 선택한 방식

1차 자동화는 **GitHub Artifact Attestation + SHA256 체크섬**으로 간다.

이 방식은 GPG private key를 GitHub Secrets에 넣지 않아도 되고, GitHub Actions OIDC 기반으로 빌드 산출물의 출처를 증명할 수 있다. 현재 앱은 정적 사이트이므로 CI에서 생성한 `dist` tarball을 배포 단위로 삼는다.

## 현재 CI 동작

`main` push 또는 PR에서 CI가 다음을 수행한다.

1. 의존성 설치: `npm ci`
2. 앱 데이터 검증: `npm run data:check`
3. 의존성 취약점 검사: `npm audit --audit-level=moderate`
4. 프로덕션 빌드: `npm run build`
5. 빌드 결과 패키징: `artifacts/euni-baby-items-<commit-sha>.tar.gz`
6. 체크섬 생성: `artifacts/SHA256SUMS`
7. GitHub Actions artifact 업로드
8. `main` push일 때 산출물 attestation 발급
9. Docker Compose 설정 검증: `docker compose config`

PR은 배포 대상이 아니므로 빌드와 체크섬/업로드까지만 확인한다. 배포 가능한 기준 산출물은 `main` push에서 생성되고 attestation까지 붙은 artifact다.

## 검증 방법

GitHub Actions artifact를 내려받아 압축을 푼 뒤 체크섬을 확인한다.

```bash
sha256sum -c SHA256SUMS
```

GitHub CLI를 사용할 수 있으면 attestation도 확인한다.

```bash
gh attestation verify euni-baby-items-<commit-sha>.tar.gz --repo Hongbaekson/baby-item
```

## CD 적용 순서

자동 배포를 붙일 때는 OCI 서버에서 `git pull && docker compose up --build`를 바로 실행하지 않고, 아래 순서를 사용한다.

1. GitHub Actions가 빌드 산출물 tarball과 `SHA256SUMS`를 만든다.
2. GitHub Actions가 산출물 attestation을 발급한다.
3. 배포 job 또는 OCI 서버가 해당 artifact를 내려받는다.
4. `sha256sum -c SHA256SUMS`로 전송 중 변조 여부를 확인한다.
5. `gh attestation verify` 또는 동등한 검증으로 산출물 출처를 확인한다.
6. 검증이 통과한 산출물만 Nginx 정적 파일 경로 또는 Docker 이미지 빌드 컨텍스트에 반영한다.
7. 컨테이너를 재시작하고 healthcheck를 확인한다.

## S3 또는 OCI Object Storage 확장

별도 장기 보관소가 필요해지면 GitHub artifact 대신 S3 또는 OCI Object Storage에 다음 파일을 업로드한다.

- `euni-baby-items-<commit-sha>.tar.gz`
- `SHA256SUMS`
- attestation bundle 또는 검증 가능한 provenance 메타데이터

현재 MVP에는 별도 Object Storage credential이 필요 없으므로 GitHub artifact 보관을 우선 사용한다.

## GPG를 바로 쓰지 않는 이유

GPG 서명도 가능하지만 private key를 GitHub Secrets에 넣고 회전/폐기/권한 관리를 해야 한다. 지금 프로젝트에는 keyless attestation이 더 단순하고, 비밀키 유출면도 작다. 외부 배포 정책상 `.asc` 서명이 꼭 필요해지면 GPG 단계를 별도 Phase로 추가한다.

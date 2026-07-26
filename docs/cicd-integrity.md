# CI/CD 산출물 무결성

업데이트: 2026-07-26 (KST)

## 검증 job

`main` push와 pull request에서 다음을 순서대로 실행한다.

1. Node.js 24에서 `npm ci`
2. 앱 데이터와 48시간 가격 정책 엄격 검사
3. moderate 이상 npm advisory 검사
4. Prettier와 ESLint
5. Node 단위 테스트와 Vitest 컴포넌트 테스트
6. TypeScript와 Vite 프로덕션 빌드
7. Playwright 데스크톱·모바일 E2E와 axe 접근성 검사
8. Docker Compose 설정과 프로덕션 이미지 build
9. `dist` tarball과 `SHA256SUMS` 생성
10. 14일 보관 artifact 업로드

모든 외부 GitHub Action은 commit SHA로 고정하며 Dependabot이 주기적으로 갱신 제안을 만든다.

## attestation job

기본 workflow는 `contents: read`만 가진다. `main` push에서 검증 job이 모두 성공한 경우에만 별도 job이 artifact를 다시 내려받고 다음 최소 권한으로 attestation을 발급한다.

- `id-token: write`
- `attestations: write`
- `artifact-metadata: write`

PR은 배포 대상이 아니므로 attestation을 만들지 않는다.

## 가격 후보 scheduled workflow

`price-candidates.yml`은 읽기 권한으로 공식 API 후보를 수집하고 검토용 artifact만 만든다. 가격 데이터 변경을 자동 커밋하거나 배포하지 않는다. 이는 배송비·결제 단계 재고가 불완전한 검색 결과가 현재 최저가로 게시되는 것을 방지한다.

## artifact 검증

```bash
sha256sum -c SHA256SUMS
gh attestation verify euni-baby-items-<commit-sha>.tar.gz \
  --repo Hongbaekson/baby-item
```

OCI 자동 배포를 도입할 때는 두 검증이 모두 통과한 산출물만 반영하고, 재시작 후 healthcheck와 HTTPS 보안 헤더를 확인한다. `git pull && docker compose up --build`를 무조건 실행하는 방식은 기준 배포 절차로 사용하지 않는다.

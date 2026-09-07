# CI/CD 산출물 무결성

업데이트: 2026-09-08 (KST)

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

## 공식몰 링크 scheduled workflow

`price-candidates.yml`은 읽기 권한으로 공식몰 실응답을 점검하고 엄격 검사와 프로덕션 build를 통과한 artifact를 만든다. 2026-07-31 종료된 네이버 쇼핑 API는 호출하지 않는다. 별도 최소 권한 job이 검증된 세 파일만 자동 커밋한다. OCI catalog-sync 타이머는 전체 변경 경로와 commit subject를 다시 확인한 뒤 앱 컨테이너만 재빌드한다. 공식몰 실패·만료는 상품 검색으로 전환하며 검색을 검증 가격으로 표시하지 않는다. 운영 smoke는 HTML의 점검 시각이 48시간 이내인지와 전체 상품의 링크 수를 함께 검사한다.

## artifact 검증

```bash
sha256sum -c SHA256SUMS
gh attestation verify euni-baby-items-<commit-sha>.tar.gz \
  --repo Hongbaekson/baby-item
```

일일 데이터 배포는 엄격 검사와 build를 통과한 데이터 전용 커밋만 반영하고, 앱 컨테이너 healthcheck와 내부·외부 HTTPS 응답을 확인한다. GitHub에 OCI SSH 키를 보관하지 않으며 Edge 컨테이너와 서버의 별도 Caddy 설정도 재생성하지 않는다. 일반 소스 배포는 계속 CI artifact와 attestation 검증을 기준으로 한다.

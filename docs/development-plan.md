# 개발 계획과 현재 상태

업데이트: 2026-07-26 (KST)

## 목표

공개 Notion에 정리된 육아템을 로그인 없이 탐색할 수 있는 정적 사이트로 제공한다. 현재 운영 주소는 `https://sonleeeun.site`이며, 가격 신뢰성·접근성·재현 가능한 데이터 갱신을 공개 기능과 같은 수준의 완료 조건으로 둔다.

## 완료된 단계

| 단계 | 상태 | 완료 기준 |
| --- | --- | --- |
| 데이터 정규화 | 완료 | 31개 canonical 제품, 빈 제목 제거, 중복 통합, 품질 상태 산출 |
| React UI | 완료 | 검색, 카테고리, 정렬, 찜, 더 보기, URL 상태, 상세 모달, 제휴 고지 |
| 반응형·접근성 | 완료 | 모바일 가로형 카드·단일 행 필터·고정 CTA, 키보드 모달, 포커스 복원, axe 검사 |
| 가격 안전 정책 | 완료 | 검증·참고·차단 3계층, 48시간 신선도, 신뢰 도메인 |
| 구매 링크 검증 | 완료 | 쿠팡 차단, 30일 근거 만료, 네이버 검색·검증 공식몰만 CTA 노출 |
| 데이터 파이프라인 | 완료 | 정규화 시 동기화 필드 보존, 품질 보고서 자동 생성 |
| 보안·컨테이너 | 완료 | HTTPS 메타데이터, 보안 헤더, read-only 컨테이너, digest pin |
| CI | 완료 | 포맷, lint, 단위/컴포넌트/E2E, build, Docker, checksum, attestation |
| 후보 정기 수집 | 완료 | 일 1회 검토용 artifact 생성, 자동 게시 없음 |
| OCI HTTPS 배포 | 기존 완료 | 실제 운영 갱신 여부는 `deployment-status.md`에서 별도 관리 |

## 현재 품질 기준

- 제품 31개, 데이터 오류 0개
- 단축 링크와 신뢰하지 않는 구매 도메인 0개
- 신선한 검증 최저가 0개
- 검증된 구매 링크 29개, 근거가 없어 숨긴 링크 2개, 쿠팡 구매 링크 0개
- 모든 가격 후보는 비클릭 참고 정보로 표시
- 첫 화면은 9개 제품으로 제한하고 검색·정렬·찜·상세 상태를 URL 또는 브라우저에 보존
- 데스크톱·모바일 자동 접근성 검사 통과
- 외부 구매 링크는 `noopener noreferrer sponsored` 사용

## 공개 전 필수 명령

```bash
npm run data:report
npm run data:check
npm run links:check
npm run price:check-strict
npm run format:check
npm run lint
npm test
npm run build
npm run test:e2e
docker compose config
docker build -t euni-baby-items:local .
```

## 다음 운영 단계

코드 기능이 아니라 외부 권한 또는 운영 결정이 필요한 항목만 남아 있다.

1. 배송비·결제 단계 재고를 제공하는 허용된 판매처/제휴 피드를 연결한다.
2. 네이버 API scheduled workflow의 첫 성공 artifact와 만료 갱신을 확인한다.
3. 검증된 CI artifact와 attestation만 OCI에 반영하는 CD를 도입한다.
4. SSH ingress를 운영자 고정 IP로 제한할지 결정한다.
5. 구매 링크 검증 변경을 운영에 배포한 뒤 CTA·HTTPS·healthcheck를 다시 확인한다.

후보 데이터는 자동 게시하지 않는다. 신선한 배송비 포함 가격을 확보하기 전까지 `가격 다시 확인`을 유지하는 것이 의도된 동작이다.

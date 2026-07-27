import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { data } from "../lib/app-data";
import { formatCheckedDate, hasCurrentPurchaseLink } from "../lib/offers";

const statusCheckedAt = Date.now();
const verifiedItems = data.items.filter((item) =>
  hasCurrentPurchaseLink(item, statusCheckedAt),
);
const hiddenItems = data.items.length - verifiedItems.length;
const latestCheckedAt = verifiedItems
  .map((item) => item.purchaseLink.checkedAt)
  .filter((value): value is string => Boolean(value))
  .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

export function ServiceStatus() {
  return (
    <>
      <section className="service-status" aria-label="판매 정보 운영 상태">
        <div className="service-status-heading">
          <span className="live-dot" aria-hidden="true" />
          <strong>판매 정보 운영 중</strong>
        </div>
        <span>
          <CheckCircle2 size={15} aria-hidden="true" />
          판매 근거 확인 {verifiedItems.length}/{data.items.length}
        </span>
        <span>
          <Clock3 size={15} aria-hidden="true" />
          최근 점검 {formatCheckedDate(latestCheckedAt)}
        </span>
      </section>

      <section
        id="verification-policy"
        className="verification-panel"
        aria-labelledby="verification-title"
      >
        <div className="verification-intro">
          <span className="verification-icon" aria-hidden="true">
            <ShieldCheck size={22} />
          </span>
          <div>
            <p className="eyebrow">운영 원칙</p>
            <h2 id="verification-title">
              가격보다 판매 페이지를 먼저 확인합니다
            </h2>
            <p>
              오래되거나 존재가 확인되지 않은 상품 페이지는 연결하지 않고, 검증
              근거가 있는 판매 경로만 공개합니다.
            </p>
          </div>
        </div>
        <div className="verification-rules">
          <article>
            <strong>기록가</strong>
            <span>과거 메모 가격이며 현재 판매가로 표시하지 않습니다.</span>
          </article>
          <article>
            <strong>판매 링크</strong>
            <span>30일 안에 판매 근거를 확인한 경우에만 열립니다.</span>
          </article>
          <article>
            <strong>가격 후보</strong>
            <span>
              배송비·재고가 불확실하면 비클릭 참고 정보로만 표시합니다.
            </span>
          </article>
        </div>
        {hiddenItems > 0 && (
          <p className="verification-note">
            현재 {hiddenItems}개 상품은 확인된 판매 페이지가 없어 링크를 숨기고
            있습니다.
          </p>
        )}
      </section>
    </>
  );
}

import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { data } from "../lib/app-data";
import { formatCheckedDate, hasCurrentPurchaseLink } from "../lib/offers";
import offerPolicy from "../../config/offer-policy.json";

const statusCheckedAt = Date.now();
const verifiedItems = data.items.filter((item) =>
  hasCurrentPurchaseLink(item, statusCheckedAt),
);
const searchItems = data.items.length - verifiedItems.length;
const latestCheckedAt = data.purchaseLinkPolicy.checkedAt;
const recentCheck =
  Number.isFinite(Date.parse(latestCheckedAt ?? "")) &&
  statusCheckedAt - Date.parse(latestCheckedAt!) <=
    offerPolicy.freshnessHours * 3_600_000;

export function ServiceStatus() {
  return (
    <>
      <section className="service-status" aria-label="판매 정보 운영 상태">
        <div className="service-status-heading">
          {recentCheck ? (
            <span className="live-dot" aria-hidden="true" />
          ) : (
            <Clock3 size={15} aria-hidden="true" />
          )}
          <strong>
            {recentCheck
              ? "상품 검색 이용 가능"
              : "공식몰 점검 지연 · 상품 검색 가능"}
          </strong>
        </div>
        <span>
          <CheckCircle2 size={15} aria-hidden="true" />
          공식몰 확인 {verifiedItems.length}/{data.items.length}
        </span>
        <span>
          <Clock3 size={15} aria-hidden="true" />
          공식몰 점검 {formatCheckedDate(latestCheckedAt)}
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
              상품 검색과 공식 판매처를 구분합니다
            </h2>
            <p>
              상품 검색은 언제든 이용할 수 있습니다. 공식몰 바로가기는 최근
              응답을 확인한 상품에만 제공하며, 최신 가격과 재고는 판매처에서
              확인하세요.
            </p>
          </div>
        </div>
        <div className="verification-rules">
          <article>
            <strong>기록가</strong>
            <span>과거 메모 가격이며 현재 판매가로 표시하지 않습니다.</span>
          </article>
          <article>
            <strong>상품 검색·공식몰</strong>
            <span>
              검색 결과는 판매 확인을 뜻하지 않습니다. 공식몰 링크는 30일 후
              만료됩니다.
            </span>
          </article>
          <article>
            <strong>가격 후보</strong>
            <span>
              배송비·재고가 불확실하면 비클릭 참고 정보로만 표시합니다.
            </span>
          </article>
        </div>
        {searchItems > 0 && (
          <p className="verification-note">
            현재 {searchItems}개 상품은 브랜드·모델·규격을 정리한 검색어로
            연결합니다. 브랜드나 모델이 기록되지 않은 상품은 같은 종류의 제품이
            검색될 수 있습니다.
          </p>
        )}
      </section>
    </>
  );
}

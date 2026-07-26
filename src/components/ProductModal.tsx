import {
  ChevronDown,
  ExternalLink,
  Heart,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { categoryLabel, placeholderFor } from "../lib/categories";
import {
  currentVerifiedOffers,
  formatOfferDate,
  issueLabel,
  itemOfferStatusLabel,
  linkHost,
  offerPriceLabel,
  offerShippingLabel,
  platformLabel,
  primaryPurchaseUrl,
  productImageUrl,
  referenceOffers,
  reviewFlagLabel,
} from "../lib/offers";
import { displayTitle, isDailyPick, productSummary } from "../lib/products";
import type { Item, Offer } from "../types";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function OfferList({
  offers,
  verified,
}: {
  offers: Offer[];
  verified: boolean;
}) {
  return (
    <div className="offer-list">
      {offers.map((offer, index) => (
        <a
          key={offer.url}
          className={verified && index === 0 ? "best" : ""}
          href={offer.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          aria-label={`${offer.mallName} 상품 페이지 열기, ${offerPriceLabel(offer)}`}
        >
          <span className="offer-main">
            <strong>{platformLabel(offer.platform, offer.mallName)}</strong>
            <span>{offer.productName ?? offer.mallName}</span>
          </span>
          <span className="offer-price">
            <strong>{offerPriceLabel(offer)}</strong>
            <span>{offerShippingLabel(offer)}</span>
            <span>{formatOfferDate(offer)} 확인</span>
          </span>
          {verified && index === 0 && <em>최저가</em>}
          {!verified && <em>참고</em>}
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

export function ProductModal({
  item,
  isFavorite,
  onClose,
  onToggleFavorite,
}: {
  item: Item;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (itemId: string) => void;
}) {
  const fallbackImage = placeholderFor(item.primaryCategory);
  const [imageSrc, setImageSrc] = useState(productImageUrl(item));
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const verifiedOffers = useMemo(() => currentVerifiedOffers(item), [item]);
  const candidates = useMemo(() => referenceOffers(item), [item]);
  const purchaseUrl = primaryPurchaseUrl(item);
  const title = displayTitle(item);
  const summary = productSummary(item);
  const hasFreshPrice = verifiedOffers.length > 0;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const background =
      document.querySelector<HTMLElement>(".app-shell-content");
    document.body.style.overflow = "hidden";
    if (background) background.inert = true;
    closeButtonRef.current?.focus();

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
      if (background) background.inert = false;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  function trapFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR,
      ) ?? []),
    ];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const purchaseLabel = hasFreshPrice
    ? "배송비 포함 최저가 보기"
    : "구매처에서 최신가 확인";

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="product-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={trapFocus}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="icon-button close-button"
          onClick={onClose}
          aria-label="상품 상세 닫기"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div className="modal-media">
          <img
            src={imageSrc}
            alt={`${title} 상품 이미지`}
            decoding="async"
            onError={() => {
              if (imageSrc !== fallbackImage) setImageSrc(fallbackImage);
            }}
          />
        </div>

        <div className="modal-body">
          <div className="modal-kickers">
            {isDailyPick(item) && (
              <span className="recommendation-badge">
                <Sparkles size={13} aria-hidden="true" />
                매일 쓰는 추천
              </span>
            )}
            <button
              type="button"
              className={`modal-favorite-button ${isFavorite ? "active" : ""}`}
              onClick={() => onToggleFavorite(item.id)}
              aria-pressed={isFavorite}
            >
              <Heart
                size={17}
                aria-hidden="true"
                fill={isFavorite ? "currentColor" : "none"}
              />
              {isFavorite ? "찜 해제" : "찜하기"}
            </button>
          </div>

          <h2 id={titleId}>{title}</h2>
          {summary && <p className="modal-summary">{summary}</p>}

          <div className="category-list expanded" aria-label="포함 카테고리">
            {item.categories.map((category) => (
              <span key={category}>{categoryLabel(category)}</span>
            ))}
          </div>

          <a
            className="best-offer-panel"
            href={purchaseUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
          >
            <ShoppingBag size={19} aria-hidden="true" />
            <span>
              <strong>{purchaseLabel}</strong>
              <span>{linkHost(purchaseUrl)}</span>
            </span>
            <ExternalLink size={17} aria-hidden="true" />
          </a>

          <div className="modal-price-panel">
            <p className="modal-price">
              {item.referencePrice ?? "기록가 없음"}
            </p>
            <p id={descriptionId} className="offer-freshness">
              {itemOfferStatusLabel(item)}
            </p>
          </div>

          {verifiedOffers.length > 0 && (
            <section
              className="purchase-offers"
              aria-label="검증된 구매처별 가격"
            >
              <h3>배송비 포함 확인 가격</h3>
              <OfferList offers={verifiedOffers} verified />
            </section>
          )}

          {candidates.length > 0 && (
            <details className="disclosure-panel">
              <summary>
                <span>
                  가격 참고 후보 <strong>{candidates.length}개</strong>
                </span>
                <ChevronDown size={17} aria-hidden="true" />
              </summary>
              <p className="section-help">
                오래되었거나 배송비·결제 단계 재고가 확인되지 않은 검색
                결과입니다. 결제 전 구매처에서 확인하세요.
              </p>
              <OfferList offers={candidates} verified={false} />
            </details>
          )}

          {item.rejectedOffers.length > 0 && (
            <details className="disclosure-panel review">
              <summary>
                <span>
                  제외된 검색 결과{" "}
                  <strong>{item.rejectedOffers.length}개</strong>
                </span>
                <ChevronDown size={17} aria-hidden="true" />
              </summary>
              <div className="review-panel">
                {item.rejectedOffers.map((offer) => (
                  <div key={offer.url}>
                    <strong>{offer.productName ?? offer.mallName}</strong>
                    <span>
                      {(offer.reviewFlags ?? [])
                        .map(reviewFlagLabel)
                        .join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {item.dataQuality.issues.length > 0 && (
            <details className="disclosure-panel">
              <summary>
                <span>제품 정보 확인 상태</span>
                <ChevronDown size={17} aria-hidden="true" />
              </summary>
              <div className="quality-panel">
                {item.dataQuality.issues.map((issue, index) => (
                  <p key={`${issue.code}-${index}`}>{issueLabel(issue.code)}</p>
                ))}
              </div>
            </details>
          )}

          {item.partnerLinks.length > 1 && (
            <details className="disclosure-panel">
              <summary>
                <span>다른 구매처 {item.partnerLinks.length - 1}개</span>
                <ChevronDown size={17} aria-hidden="true" />
              </summary>
              <div className="link-list">
                {item.partnerLinks.slice(1).map((link) => (
                  <a
                    key={`${link.sourceItemId}-${link.url}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                    <span className="link-copy">
                      <strong>{linkHost(link.url)}</strong>
                      <span>{categoryLabel(link.category)}</span>
                    </span>
                  </a>
                ))}
              </div>
            </details>
          )}

          <p className="link-security-note">
            외부 구매처는 새 창으로 열립니다. 결제 전 도메인, 최신가, 배송비와
            품절 여부를 확인하세요.
          </p>
          <p className="affiliate-notice">
            일부 구매 링크는 제휴 링크일 수 있으며, 구매 시 운영자에게 수수료가
            지급될 수 있습니다. 구매 가격에는 영향을 주지 않습니다.
          </p>
        </div>

        <a
          className="modal-mobile-cta"
          href={purchaseUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
        >
          <ShoppingBag size={18} aria-hidden="true" />
          <span>
            <strong>{purchaseLabel}</strong>
            <small>{linkHost(purchaseUrl)}</small>
          </span>
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}

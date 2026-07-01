import {
  Baby,
  Check,
  ExternalLink,
  Heart,
  Info,
  Search,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import appData from "./data/items.json";

type QualityStatus = "ready" | "usable_with_warnings" | "needs_review" | "draft";
type OfferStatusState = "not_synced" | "available" | "no_available_offer" | "needs_review";

type BestOffer = {
  url: string;
  imageUrl?: string | null;
  platform?: string;
  mallName: string;
  price: number;
  shippingFee: number;
  totalPrice: number;
  inStock: true;
  source: string;
  syncedAt: string;
  matchConfidence: "high" | "medium";
  productName: string | null;
  note: string | null;
};

type PurchaseOffer = BestOffer;

type Item = {
  id: string;
  title: string;
  categories: string[];
  primaryCategory: string;
  partnerLink: string;
  partnerLinks: Array<{
    url: string;
    category: string;
    sourceItemId: string;
  }>;
  price: number | null;
  displayPrice: string;
  referencePrice: string | null;
  bestOffer: BestOffer | null;
  purchaseOffers: PurchaseOffer[];
  offerStatus: {
    state: OfferStatusState;
    syncedAt: string | null;
    checkedOffers: number;
  };
  memo: string;
  imagePath: string;
  hasOriginalImage: boolean;
  dataQuality: {
    status: QualityStatus;
    errorCount: number;
    warningCount: number;
    issues: Array<{
      code: string;
      severity: "error" | "warning" | "info";
      message: string;
    }>;
  };
};

const data = appData as {
  site: {
    name: string;
    affiliateDisclosure: string;
    priceDisclosure: string;
  };
  summary: {
    totalItems: number;
    categories: Array<{ name: string; count: number }>;
    readyItems: number;
    usableWithWarningsItems: number;
    needsReviewItems: number;
  };
  items: Item[];
};

const CATEGORY_TONES = [
  "mint",
  "sky",
  "peach",
  "butter",
  "lavender",
  "rose",
  "leaf",
  "coral",
  "blueberry",
  "cream",
] as const;

function categoryTone(category: string) {
  const index = data.summary.categories.findIndex((item) => item.name === category);

  return CATEGORY_TONES[Math.max(index, 0) % CATEGORY_TONES.length];
}

const CATEGORY_PLACEHOLDERS = new Map([
  ["👶300일간 매일 사용한 육아템 정리", "top-used"],
  ["💤수면 아이템", "sleep"],
  ["😎외출 아이템", "outing"],
  ["🍼젖병 열탕 소독", "sterilize"],
  ["🍼수유아이템", "feeding"],
  ["💩신생아 배앓이 꿀템", "colic"],
  ["🎉놀이아이템", "play"],
  ["💩배변아이템", "diaper"],
  ["👶거실매트", "mat"],
  ["🧑‍🍼손목&허리보호대(양육자를 위한 아이템)", "caregiver"],
]);

function placeholderFor(category: string) {
  return `/images/placeholders/${CATEGORY_PLACEHOLDERS.get(category) ?? "default"}.svg`;
}

function qualityLabel(status: QualityStatus) {
  if (status === "ready") return "확인 완료";
  if (status === "needs_review") return "정보 확인 중";
  if (status === "draft") return "비공개";

  return "일부 확인 필요";
}

function issueLabel(code: string) {
  if (code === "missing_price") return "기록가 없음";
  if (code === "missing_image") return "기본 이미지 사용";
  if (code === "suspicious_unrelated_memo") return "메모 확인 필요";
  if (code === "normalized_partner_link") return "링크 보정됨";

  return "정보 확인 필요";
}

function linkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "외부 링크";
  }
}

function isShortLink(url: string) {
  return ["bit.ly", "naver.me", "tinyurl.com", "t.co", "goo.gl"].includes(linkHost(url));
}

function primaryPurchaseUrl(item: Item) {
  return item.bestOffer?.url ?? item.partnerLink;
}

function hasUnavailableOfferStatus(item: Item) {
  return item.offerStatus.state === "no_available_offer" && !item.bestOffer;
}

function productImageUrl(item: Item) {
  return item.bestOffer?.imageUrl ?? item.imagePath;
}

function availablePurchaseOffers(item: Item) {
  return (item.purchaseOffers ?? []).filter((offer) => offer.inStock === true);
}

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function offerPriceLabel(offer: PurchaseOffer) {
  if (Number.isFinite(offer.totalPrice)) {
    return formatWon(offer.totalPrice);
  }

  return `${formatWon(offer.price)}부터`;
}

function platformLabel(platform: string | undefined, mallName: string) {
  if (platform === "naver") return "네이버";
  if (platform === "coupang") return "쿠팡";

  return mallName;
}

function offerStatusLabel(item: Item) {
  if (item.bestOffer) {
    const shipping =
      item.bestOffer.shippingFee > 0
        ? `배송비 ${item.bestOffer.shippingFee.toLocaleString("ko-KR")}원 포함`
        : "무료배송 또는 배송비 없음";

    return `${item.bestOffer.mallName} · ${shipping} · 구매 가능 후보`;
  }

  if (item.offerStatus.state === "no_available_offer") {
    return "최근 동기화에서 구매 가능 최저가 후보를 찾지 못했습니다.";
  }

  return null;
}

export function App() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("전체");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return data.items.filter((item) => {
      const matchesCategory =
        activeCategory === "전체" || item.categories.includes(activeCategory);
      const matchesQuery =
        !normalizedQuery ||
        [item.title, item.memo, item.categories.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            <Baby size={24} />
          </span>
          <div>
            <h1>{data.site.name}</h1>
            <p>아빠가 직접 고르고 정리한 수유, 수면, 외출, 배변 육아템</p>
          </div>
        </div>
        <div className="summary-strip" aria-label="제품 요약">
          <span>
            <strong>{data.summary.totalItems}</strong>
            제품
          </span>
          <span>
            <strong>{data.summary.categories.length}</strong>
            카테고리
          </span>
          <span>
            <strong>{data.summary.needsReviewItems}</strong>
            확인중
          </span>
        </div>
      </header>

      <main>
        <section className="toolbar" aria-label="제품 검색과 카테고리 필터">
          <label className="search-box">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제품명, 카테고리 검색"
            />
          </label>

          <div className="category-row" aria-label="카테고리">
            <button
              type="button"
              className={`category-chip all ${activeCategory === "전체" ? "active" : ""}`}
              onClick={() => setActiveCategory("전체")}
            >
              {activeCategory === "전체" && <Check size={14} aria-hidden="true" />}
              전체 {data.summary.totalItems}
            </button>
            {data.summary.categories.map((category) => (
              <button
                type="button"
                key={category.name}
                className={`category-chip ${categoryTone(category.name)} ${
                  activeCategory === category.name ? "active" : ""
                }`}
                onClick={() => setActiveCategory(category.name)}
              >
                {activeCategory === category.name && <Check size={14} aria-hidden="true" />}
                {category.name} {category.count}
              </button>
            ))}
          </div>
        </section>

        <section className="result-heading" aria-live="polite">
          <div>
            <p className="eyebrow">
              <Sparkles size={15} aria-hidden="true" />
              {activeCategory}
            </p>
            <h2>{filteredItems.length}개의 육아템</h2>
          </div>
          <div className="notice-stack">
            <p className="affiliate-note">{data.site.affiliateDisclosure}</p>
            <p className="price-note">{data.site.priceDisclosure}</p>
          </div>
        </section>

        <section className="product-grid" aria-label="제품 목록">
          {filteredItems.map((item) => (
            <ProductCard key={item.id} item={item} onSelect={setSelectedItem} />
          ))}
        </section>

        {filteredItems.length === 0 && (
          <section className="empty-state">
            <Heart size={28} aria-hidden="true" />
            <p>조건에 맞는 제품이 없습니다.</p>
          </section>
        )}
      </main>

      <footer className="site-footer">
        <Info size={16} aria-hidden="true" />
        <span>{data.site.affiliateDisclosure}</span>
      </footer>

      {selectedItem && <ProductModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  );
}

function ProductCard({
  item,
  onSelect,
}: {
  item: Item;
  onSelect: (item: Item) => void;
}) {
  const [imageSrc, setImageSrc] = useState(productImageUrl(item));
  const warningIssues = item.dataQuality.issues.filter((issue) => issue.severity !== "info");
  const purchaseUrl = primaryPurchaseUrl(item);
  const statusLabel = offerStatusLabel(item);
  const purchaseUnavailable = hasUnavailableOfferStatus(item);

  return (
    <article className={`product-card ${categoryTone(item.primaryCategory)}`}>
      <button type="button" className="image-button" onClick={() => onSelect(item)}>
        <img
          src={imageSrc}
          alt=""
          loading="lazy"
          onError={() => setImageSrc(placeholderFor(item.primaryCategory))}
        />
      </button>
      <div className="card-content">
        <div className="card-meta">
          <span className={`quality-badge ${item.dataQuality.status}`}>
            {qualityLabel(item.dataQuality.status)}
          </span>
          <span className="price-pill">{item.displayPrice}</span>
        </div>
        <h3>{item.title}</h3>
        <div className="category-list" aria-label="포함 카테고리">
          {item.categories.slice(0, 3).map((category) => (
            <span key={category}>{category}</span>
          ))}
        </div>
        {item.memo && <p className="memo">{item.memo}</p>}
        {item.referencePrice && (
          <p className="reference-price">{item.referencePrice} · 실제 결제가는 구매처 기준</p>
        )}
        {statusLabel && <p className="best-offer-note">{statusLabel}</p>}
        {warningIssues.length > 0 && (
          <div className="issue-row" aria-label="확인 상태">
            {warningIssues.slice(0, 2).map((issue) => (
              <span key={issue.code}>{issueLabel(issue.code)}</span>
            ))}
          </div>
        )}
        <div className="card-actions">
          <button type="button" className="secondary-button" onClick={() => onSelect(item)}>
            <Info size={16} aria-hidden="true" />
            자세히
          </button>
          {purchaseUnavailable ? (
            <span className="primary-link disabled" aria-disabled="true">
              <ShoppingBag size={16} aria-hidden="true" />
              링크 확인중
            </span>
          ) : (
            <a
              className="primary-link"
              href={purchaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${item.title} 구매 링크 열기, ${linkHost(purchaseUrl)}`}
            >
              <ShoppingBag size={16} aria-hidden="true" />
              {item.bestOffer ? "최저가 보기" : "보러가기"}
            </a>
          )}
        </div>
        <p className="link-domain">
          {purchaseUnavailable ? "구매 가능 링크 없음" : `보러가기 도메인: ${linkHost(purchaseUrl)}`}
        </p>
      </div>
    </article>
  );
}

function ProductModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const [imageSrc, setImageSrc] = useState(productImageUrl(item));
  const purchaseUrl = primaryPurchaseUrl(item);
  const statusLabel = offerStatusLabel(item);
  const purchaseOffers = availablePurchaseOffers(item);
  const showFallbackLinks =
    purchaseOffers.length === 0 && item.offerStatus.state !== "no_available_offer";

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="product-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="icon-button close-button" onClick={onClose} aria-label="닫기">
          <X size={20} aria-hidden="true" />
        </button>
        <div className="modal-media">
          <img
            src={imageSrc}
            alt=""
            onError={() => setImageSrc(placeholderFor(item.primaryCategory))}
          />
        </div>
        <div className="modal-body">
          <span className={`quality-badge ${item.dataQuality.status}`}>
            {qualityLabel(item.dataQuality.status)}
          </span>
          <h2 id="modal-title">{item.title}</h2>
          <p className="modal-price">{item.displayPrice}</p>
          {item.referencePrice && (
            <p className="modal-reference-price">
              {item.referencePrice} · 실제 결제가는 구매처에서 확인하세요.
            </p>
          )}
          {item.bestOffer && (
            <a
              className="best-offer-panel"
              href={purchaseUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ShoppingBag size={18} aria-hidden="true" />
              <span>
                <strong>검증된 최저가로 이동</strong>
                <span>{statusLabel}</span>
              </span>
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          )}
          {!item.bestOffer && item.offerStatus.state === "no_available_offer" && (
            <p className="best-offer-empty">{statusLabel}</p>
          )}
          <div className="category-list expanded">
            {item.categories.map((category) => (
              <span key={category}>{category}</span>
            ))}
          </div>
          {item.memo && <p className="modal-memo">{item.memo}</p>}
          {item.dataQuality.issues.length > 0 && (
            <div className="quality-panel">
              <h3>확인 상태</h3>
              {item.dataQuality.issues.map((issue, index) => (
                <p key={`${issue.code}-${index}`}>{issueLabel(issue.code)}</p>
              ))}
            </div>
          )}
          <p className="link-security-note">
            외부 구매 링크는 새 창으로 열립니다. 결제 전 연결 도메인, 최신가, 품절 여부를
            확인하세요.
          </p>
          {purchaseOffers.length > 0 && (
            <section className="purchase-offers" aria-label="구매처별 가격">
              <h3>구매처별 가격</h3>
              <div className="offer-list">
                {purchaseOffers.map((offer, index) => (
                  <a
                    key={`${offer.url}-${index}`}
                    className={index === 0 ? "best" : ""}
                    href={offer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="offer-main">
                      <strong>{platformLabel(offer.platform, offer.mallName)}</strong>
                      <span>
                        {offer.mallName} · {linkHost(offer.url)}
                      </span>
                    </span>
                    <span className="offer-price">
                      <strong>{offerPriceLabel(offer)}</strong>
                      <span>
                        {offer.shippingFee > 0
                          ? `배송비 ${formatWon(offer.shippingFee)} 포함`
                          : "배송비 없음 또는 무료배송"}
                      </span>
                    </span>
                    {index === 0 && <em>최저가</em>}
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </section>
          )}
          {item.offerStatus.state === "no_available_offer" && purchaseOffers.length === 0 && (
            <p className="best-offer-empty">
              확인된 구매 가능 링크가 없어 현재는 구매 링크를 숨겼습니다.
            </p>
          )}
          {showFallbackLinks && (
            <section className="purchase-offers fallback" aria-label="기본 구매 링크">
              <h3>기본 구매 링크</h3>
              <div className="link-list">
                {item.partnerLinks.map((link, index) => (
                  <a
                    key={`${link.sourceItemId}-${link.url}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                    <span className="link-copy">
                      <strong>구매 링크 {index + 1}</strong>
                      <span>
                        {linkHost(link.url)} · 가격 확인 필요 · {link.category}
                      </span>
                    </span>
                    {isShortLink(link.url) && <em>단축 링크</em>}
                  </a>
                ))}
              </div>
            </section>
          )}
          <p className="modal-disclosure">{data.site.affiliateDisclosure}</p>
          <p className="modal-disclosure">{data.site.priceDisclosure}</p>
        </div>
      </section>
    </div>
  );
}

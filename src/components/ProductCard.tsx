import { Heart, ShoppingBag, Sparkles } from "lucide-react";
import { useState } from "react";
import { categoryLabel, categoryTone, placeholderFor } from "../lib/categories";
import {
  currentVerifiedOffers,
  linkHost,
  primaryActionLabel,
  primaryPurchaseUrl,
  productImageUrl,
  purchaseLinkStatusLabel,
} from "../lib/offers";
import { displayTitle, isDailyPick, productSummary } from "../lib/products";
import type { Item } from "../types";

export function ProductCard({
  item,
  isFavorite,
  isInPreparation,
  onSelect,
  onAddToPreparation,
  onToggleFavorite,
}: {
  item: Item;
  isFavorite: boolean;
  isInPreparation: boolean;
  onSelect: (item: Item) => void;
  onAddToPreparation: (item: Item) => void;
  onToggleFavorite: (itemId: string) => void;
}) {
  const fallbackImage = placeholderFor(item.primaryCategory);
  const [imageSrc, setImageSrc] = useState(productImageUrl(item));
  const purchaseUrl = primaryPurchaseUrl(item);
  const title = displayTitle(item);
  const summary = productSummary(item);
  const hasFreshPrice = currentVerifiedOffers(item).length > 0;

  return (
    <article className={`product-card ${categoryTone(item.primaryCategory)}`}>
      <div className="card-media">
        <button
          type="button"
          className="image-button"
          onClick={() => onSelect(item)}
          aria-label={`${title} 상세 보기`}
        >
          <img
            src={imageSrc}
            alt={`${title} 상품 이미지`}
            loading="lazy"
            decoding="async"
            onError={() => {
              if (imageSrc !== fallbackImage) setImageSrc(fallbackImage);
            }}
          />
        </button>
        <button
          type="button"
          className={`favorite-button ${isFavorite ? "active" : ""}`}
          onClick={() => onToggleFavorite(item.id)}
          aria-label={isFavorite ? `${title} 찜 해제` : `${title} 찜하기`}
          aria-pressed={isFavorite}
        >
          <Heart
            size={19}
            aria-hidden="true"
            fill={isFavorite ? "currentColor" : "none"}
          />
        </button>
      </div>

      <div className="card-content">
        <div className="card-kickers">
          {isDailyPick(item) && (
            <span className="recommendation-badge">
              <Sparkles size={13} aria-hidden="true" />
              원본 목록 상위 분류
            </span>
          )}
          <span className="category-badge">
            {categoryLabel(item.primaryCategory)}
          </span>
        </div>

        <button
          type="button"
          className="card-title-button"
          onClick={() => onSelect(item)}
        >
          <h3>{title}</h3>
        </button>

        {summary && <p className="memo">검토 메모: {summary}</p>}

        <button
          type="button"
          className="preparation-card-button"
          onClick={() => onAddToPreparation(item)}
          aria-label={`${title} ${isInPreparation ? "준비 목록에서 보기" : "준비 목록에 추가"}`}
        >
          {isInPreparation ? "준비 목록에서 보기" : "준비 목록에 추가"}
        </button>

        <div className="card-price-summary">
          <strong>{item.referencePrice ?? "기록가 없음"}</strong>
          <span>
            {hasFreshPrice
              ? "배송비 포함 최근 확인 가격"
              : purchaseLinkStatusLabel(item)}
          </span>
        </div>

        <a
          className="primary-link"
          href={purchaseUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          aria-label={`${title} ${primaryActionLabel(item)}, ${linkHost(purchaseUrl)}`}
        >
          <ShoppingBag size={17} aria-hidden="true" />
          <span>
            <strong>{primaryActionLabel(item)}</strong>
            <small>{linkHost(purchaseUrl)}</small>
          </span>
        </a>
      </div>
    </article>
  );
}

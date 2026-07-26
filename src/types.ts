export type QualityStatus =
  "ready" | "usable_with_warnings" | "needs_review" | "draft";

export type OfferStatusState =
  | "not_synced"
  | "available"
  | "stale"
  | "candidates_available"
  | "no_available_offer"
  | "needs_review";

export type ThemeMode = "light" | "dark";

export type Offer = {
  url: string;
  imageUrl?: string | null;
  platform?: string;
  mallName: string;
  price: number;
  shippingFee: number | null;
  totalPrice: number | null;
  priceBasis?: "shipping_included" | "listed_price";
  inStock: true;
  source: string;
  syncedAt: string;
  matchConfidence: "high" | "medium";
  productName: string | null;
  note: string | null;
  reviewFlags?: string[];
};

export type Item = {
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
  bestOffer: Offer | null;
  purchaseOffers: Offer[];
  candidateOffers: Offer[];
  rejectedOffers: Offer[];
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

export type AppData = {
  generatedAt: string;
  site: {
    name: string;
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

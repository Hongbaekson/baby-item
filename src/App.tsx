import {
  Baby,
  Check,
  ChevronDown,
  Heart,
  Moon,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductCard } from "./components/ProductCard";
import { ProductModal } from "./components/ProductModal";
import { categoryLabel, categoryTone } from "./lib/categories";
import { data } from "./lib/app-data";
import { isDailyPick } from "./lib/products";
import type { Item, ThemeMode } from "./types";

const THEME_STORAGE_KEY = "euni-baby-items-theme";
const FAVORITES_STORAGE_KEY = "euni-baby-items-favorites";
const PAGE_SIZE = 9;
const ALL_CATEGORY = "전체";
const validCategories = new Set([
  ALL_CATEGORY,
  ...data.summary.categories.map((category) => category.name),
]);

type SortMode = "recommended" | "name" | "reference-price";

function currentUrl() {
  return new URL(window.location.href);
}

function initialQuery() {
  return typeof window === "undefined"
    ? ""
    : (currentUrl().searchParams.get("q") ?? "");
}

function initialCategory() {
  if (typeof window === "undefined") return ALL_CATEGORY;
  const value = currentUrl().searchParams.get("category") ?? ALL_CATEGORY;
  return validCategories.has(value) ? value : ALL_CATEGORY;
}

function initialSort(): SortMode {
  if (typeof window === "undefined") return "recommended";
  const value = currentUrl().searchParams.get("sort");
  return value === "name" || value === "reference-price"
    ? value
    : "recommended";
}

function initialFavoriteOnly() {
  return (
    typeof window !== "undefined" &&
    currentUrl().searchParams.get("favorites") === "1"
  );
}

function initialSelectedItem() {
  if (typeof window === "undefined") return null;
  const itemId = currentUrl().searchParams.get("item");
  return data.items.find((item) => item.id === itemId) ?? null;
}

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "dark" || storedTheme === "light") return storedTheme;
  } catch {
    // System preference remains available when storage is blocked.
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getInitialFavorites() {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]",
    );
    return new Set<string>(
      Array.isArray(stored)
        ? stored.filter((value): value is string => typeof value === "string")
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

function updateUrl(
  values: {
    query: string;
    category: string;
    sort: SortMode;
    favoriteOnly: boolean;
  },
  mode: "replace" | "push" = "replace",
  itemId?: string | null,
) {
  const url = currentUrl();
  const trimmedQuery = values.query.trim();

  if (trimmedQuery) url.searchParams.set("q", trimmedQuery);
  else url.searchParams.delete("q");
  if (values.category !== ALL_CATEGORY)
    url.searchParams.set("category", values.category);
  else url.searchParams.delete("category");
  if (values.sort !== "recommended") url.searchParams.set("sort", values.sort);
  else url.searchParams.delete("sort");
  if (values.favoriteOnly) url.searchParams.set("favorites", "1");
  else url.searchParams.delete("favorites");

  if (itemId) url.searchParams.set("item", itemId);
  else if (itemId === null) url.searchParams.delete("item");

  const state = itemId
    ? { ...window.history.state, productModal: true }
    : window.history.state;
  window.history[mode === "push" ? "pushState" : "replaceState"](
    state,
    "",
    url,
  );
}

export function App() {
  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [sort, setSort] = useState<SortMode>(initialSort);
  const [favoriteOnly, setFavoriteOnly] = useState(initialFavoriteOnly);
  const [selectedItem, setSelectedItem] = useState<Item | null>(
    initialSelectedItem,
  );
  const [favoriteIds, setFavoriteIds] = useState(getInitialFavorites);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const resultHeadingRef = useRef<HTMLElement>(null);
  const nextTheme = theme === "dark" ? "light" : "dark";

  const urlValues = useMemo(
    () => ({ query, category: activeCategory, sort, favoriteOnly }),
    [activeCategory, favoriteOnly, query, sort],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Theme persistence is optional.
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify([...favoriteIds]),
      );
    } catch {
      // Favorite persistence is optional.
    }
  }, [favoriteIds]);

  useEffect(() => {
    updateUrl(urlValues);
  }, [urlValues]);

  useEffect(() => {
    const handlePopState = () => {
      const url = currentUrl();
      const category = url.searchParams.get("category") ?? ALL_CATEGORY;
      const sortValue = url.searchParams.get("sort");
      setQuery(url.searchParams.get("q") ?? "");
      setActiveCategory(
        validCategories.has(category) ? category : ALL_CATEGORY,
      );
      setSort(
        sortValue === "name" || sortValue === "reference-price"
          ? sortValue
          : "recommended",
      );
      setFavoriteOnly(url.searchParams.get("favorites") === "1");
      setVisibleCount(PAGE_SIZE);
      setSelectedItem(
        data.items.find((item) => item.id === url.searchParams.get("item")) ??
          null,
      );
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    const sourceIndexes = new Map(
      data.items.map((item, index) => [item.id, index]),
    );
    const items = data.items.filter((item) => {
      const matchesCategory =
        activeCategory === ALL_CATEGORY ||
        item.categories.includes(activeCategory);
      const matchesQuery =
        !normalizedQuery ||
        [item.title, item.memo, item.categories.join(" ")]
          .join(" ")
          .toLocaleLowerCase("ko-KR")
          .includes(normalizedQuery);
      return (
        matchesCategory &&
        matchesQuery &&
        (!favoriteOnly || favoriteIds.has(item.id))
      );
    });

    return items.sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title, "ko");
      if (sort === "reference-price") {
        return (
          (a.price ?? Number.POSITIVE_INFINITY) -
            (b.price ?? Number.POSITIVE_INFINITY) ||
          a.title.localeCompare(b.title, "ko")
        );
      }

      return (
        Number(isDailyPick(b)) - Number(isDailyPick(a)) ||
        (sourceIndexes.get(a.id) ?? 0) - (sourceIndexes.get(b.id) ?? 0)
      );
    });
  }, [activeCategory, favoriteIds, favoriteOnly, query, sort]);

  const visibleItems = filteredItems.slice(0, visibleCount);

  const openModal = useCallback(
    (item: Item) => {
      updateUrl(urlValues, "push", item.id);
      setSelectedItem(item);
    },
    [urlValues],
  );

  const closeModal = useCallback(() => {
    const url = currentUrl();
    if (window.history.state?.productModal && url.searchParams.has("item")) {
      setSelectedItem(null);
      window.history.back();
      return;
    }

    updateUrl(urlValues, "replace", null);
    setSelectedItem(null);
  }, [urlValues]);

  const toggleFavorite = useCallback((itemId: string) => {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  function selectCategory(category: string) {
    setActiveCategory(category);
    setVisibleCount(PAGE_SIZE);
    requestAnimationFrame(() => {
      resultHeadingRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function resetFilters() {
    setQuery("");
    setActiveCategory(ALL_CATEGORY);
    setFavoriteOnly(false);
    setSort("recommended");
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#product-results">
        제품 목록으로 바로가기
      </a>
      <div className="app-shell-content">
        <header className="topbar">
          <div className="brand-block">
            <span className="brand-mark" aria-hidden="true">
              <Baby size={24} />
            </span>
            <div>
              <h1>{data.site.name}</h1>
              <p>아빠가 직접 고르고 정리한 실사용 중심 육아템</p>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="favorite-filter-button"
              onClick={() => {
                setFavoriteOnly((value) => !value);
                setVisibleCount(PAGE_SIZE);
              }}
              aria-pressed={favoriteOnly}
            >
              <Heart
                size={18}
                aria-hidden="true"
                fill={favoriteOnly ? "currentColor" : "none"}
              />
              내 찜 <strong>{favoriteIds.size}</strong>
            </button>
            <button
              type="button"
              className="icon-button theme-toggle"
              onClick={() => setTheme(nextTheme)}
              aria-label={
                theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"
              }
              aria-pressed={theme === "dark"}
              title={theme === "dark" ? "라이트 모드" : "다크 모드"}
            >
              {theme === "dark" ? (
                <Sun size={19} aria-hidden="true" />
              ) : (
                <Moon size={19} aria-hidden="true" />
              )}
            </button>
          </div>
        </header>

        <main>
          <section className="toolbar" aria-label="제품 검색과 카테고리 필터">
            <label className="search-box">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">제품명 또는 카테고리 검색</span>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="제품명, 카테고리 검색"
                aria-label="제품명 또는 카테고리 검색"
              />
              {query && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => {
                    setQuery("");
                    setVisibleCount(PAGE_SIZE);
                  }}
                  aria-label="검색어 지우기"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              )}
            </label>

            <div className="category-scroller">
              <div className="category-row" aria-label="카테고리 필터">
                <button
                  type="button"
                  className={`category-chip all ${
                    activeCategory === ALL_CATEGORY ? "active" : ""
                  }`}
                  onClick={() => selectCategory(ALL_CATEGORY)}
                  aria-pressed={activeCategory === ALL_CATEGORY}
                >
                  {activeCategory === ALL_CATEGORY && (
                    <Check size={14} aria-hidden="true" />
                  )}
                  전체 {data.summary.totalItems}
                </button>
                {data.summary.categories.map((category) => (
                  <button
                    type="button"
                    key={category.name}
                    className={`category-chip ${categoryTone(category.name)} ${
                      activeCategory === category.name ? "active" : ""
                    }`}
                    onClick={() => selectCategory(category.name)}
                    aria-pressed={activeCategory === category.name}
                    title={category.name}
                  >
                    {activeCategory === category.name && (
                      <Check size={14} aria-hidden="true" />
                    )}
                    {categoryLabel(category.name)} {category.count}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section
            ref={resultHeadingRef}
            id="product-results"
            className="result-heading"
            aria-live="polite"
            aria-atomic="true"
          >
            <div>
              <p className="eyebrow">
                <Sparkles size={15} aria-hidden="true" />
                {favoriteOnly
                  ? "내가 찜한 제품"
                  : categoryLabel(activeCategory)}
              </p>
              <h2>{filteredItems.length}개의 육아템</h2>
            </div>
            <label className="sort-control">
              <span>정렬</span>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as SortMode);
                  setVisibleCount(PAGE_SIZE);
                }}
                aria-label="제품 정렬"
              >
                <option value="recommended">추천순</option>
                <option value="name">이름순</option>
                <option value="reference-price">기록가 낮은순</option>
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </label>
          </section>

          <section className="product-grid" aria-label="제품 목록">
            {visibleItems.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                isFavorite={favoriteIds.has(item.id)}
                onSelect={openModal}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </section>

          {visibleCount < filteredItems.length && (
            <div className="load-more-wrap">
              <button
                type="button"
                className="load-more-button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                육아템 더 보기
                <span>
                  {Math.min(PAGE_SIZE, filteredItems.length - visibleCount)}개
                </span>
              </button>
            </div>
          )}

          {filteredItems.length === 0 && (
            <section className="empty-state" aria-live="polite">
              <Heart size={28} aria-hidden="true" />
              <p>
                {favoriteOnly
                  ? "아직 찜한 제품이 없습니다."
                  : "조건에 맞는 제품이 없습니다."}
              </p>
              <button type="button" onClick={resetFilters}>
                전체 제품 보기
              </button>
            </section>
          )}
        </main>

        <footer className="site-footer">
          <p>© 2026 손홍백. All rights reserved.</p>
          <p className="affiliate-notice">
            일부 구매 링크는 제휴 링크일 수 있으며, 구매 시 운영자에게 수수료가
            지급될 수 있습니다. 구매 가격에는 영향을 주지 않습니다.
          </p>
        </footer>
      </div>

      {selectedItem && (
        <ProductModal
          item={selectedItem}
          isFavorite={favoriteIds.has(selectedItem.id)}
          onClose={closeModal}
          onToggleFavorite={toggleFavorite}
        />
      )}
    </div>
  );
}

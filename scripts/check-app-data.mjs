import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const appDataPath = path.join('src', 'data', 'items.json');
const allowedRemoteImageHosts = new Set([
  'image1.coupangcdn.com',
  'image2.coupangcdn.com',
  'image3.coupangcdn.com',
  'image4.coupangcdn.com',
  'image5.coupangcdn.com',
  'image6.coupangcdn.com',
  'image7.coupangcdn.com',
  'image8.coupangcdn.com',
  'image9.coupangcdn.com',
  'image10.coupangcdn.com',
  'thumbnail.coupangcdn.com',
  'shopping.phinf.naver.net',
  'shopping-phinf.pstatic.net',
  'shop-phinf.pstatic.net',
]);
const data = JSON.parse(readFileSync(appDataPath, 'utf8'));
const items = data.items ?? [];
const failures = [];
const warnings = [];
const shortUrlHosts = new Set(['bit.ly', 'naver.me', 'tinyurl.com', 't.co', 'goo.gl']);
const offerStatusStates = new Set(['not_synced', 'available', 'no_available_offer', 'needs_review']);

function remoteImageHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function isAllowedRemoteImageHost(host) {
  return allowedRemoteImageHosts.has(host);
}

function validateOffer(item, offer, label) {
  if (!offer.url?.startsWith('https://')) {
    failures.push(`${label} must use https: ${item.title} -> ${offer.url}`);
  }

  if (offer.inStock !== true) {
    failures.push(`${label} must be in stock: ${item.title}`);
  }

  if (!Number.isFinite(offer.price) || offer.price <= 0) {
    failures.push(`${label} has bad price: ${item.title}`);
  }

  const hasKnownTotalPrice = Number.isFinite(offer.totalPrice) && offer.totalPrice > 0;
  const hasUnknownShipping =
    offer.priceBasis === 'listed_price' && offer.shippingFee === null && offer.totalPrice === null;

  if (!hasKnownTotalPrice && !hasUnknownShipping) {
    failures.push(`${label} has bad total price: ${item.title}`);
  }

  if (hasKnownTotalPrice && offer.totalPrice < offer.price) {
    failures.push(`${label} total price is lower than base price: ${item.title}`);
  }

  if (
    !hasUnknownShipping &&
    (!Number.isFinite(offer.shippingFee) || offer.shippingFee < 0)
  ) {
    failures.push(`${label} has bad shipping fee: ${item.title}`);
  }

  if (!offer.syncedAt) {
    failures.push(`${label} missing syncedAt: ${item.title}`);
  }

  if (offer.imageUrl) {
    if (!offer.imageUrl.startsWith('https://')) {
      failures.push(`${label} image must use https: ${item.title}`);
    }

    const host = remoteImageHost(offer.imageUrl);

    if (!isAllowedRemoteImageHost(host)) {
      failures.push(`${label} image host is not allowed: ${item.title} -> ${host}`);
    }
  }
}

const ids = new Set();
for (const item of items) {
  if (!item.id) {
    failures.push(`missing id: ${item.title || '(untitled)'}`);
  }

  if (ids.has(item.id)) {
    failures.push(`duplicate id: ${item.id}`);
  }
  ids.add(item.id);

  if (!item.title?.trim()) {
    failures.push(`missing title: ${item.id}`);
  }

  if (!offerStatusStates.has(item.offerStatus?.state)) {
    failures.push(`bad offer status: ${item.title}`);
  }

  if (!Array.isArray(item.purchaseOffers)) {
    failures.push(`purchase offers must be an array: ${item.title}`);
  }

  if (item.imagePath?.startsWith('/images/')) {
    const localImagePath = path.join('public', item.imagePath.replace(/^\//, ''));
    if (!existsSync(localImagePath)) {
      failures.push(`missing image file: ${item.imagePath}`);
    }
  } else if (item.imagePath?.startsWith('https://')) {
    const host = remoteImageHost(item.imagePath);

    if (!isAllowedRemoteImageHost(host)) {
      failures.push(`remote image host is not allowed: ${item.title} -> ${host}`);
    }
  } else {
    failures.push(`bad image path: ${item.title}`);
  }

  for (const link of item.partnerLinks ?? []) {
    if (!link.url?.startsWith('https://')) {
      failures.push(`partner link must use https: ${item.title} -> ${link.url}`);
      continue;
    }

    const host = new URL(link.url).hostname.toLowerCase();
    if (shortUrlHosts.has(host)) {
      warnings.push(`short partner link: ${item.title} -> ${link.url}`);
    }
  }

  if (item.bestOffer) {
    validateOffer(item, item.bestOffer, 'best offer');
  }

  for (const [index, offer] of (item.purchaseOffers ?? []).entries()) {
    validateOffer(item, offer, `purchase offer ${index + 1}`);
  }

  if ((item.purchaseOffers ?? []).length > 4) {
    failures.push(`too many purchase offers: ${item.title}`);
  }
}

const summary = {
  items: items.length,
  ready: items.filter((item) => item.dataQuality?.status === 'ready').length,
  usableWithWarnings: items.filter((item) => item.dataQuality?.status === 'usable_with_warnings').length,
  needsReview: items.filter((item) => item.dataQuality?.status === 'needs_review').length,
  shortLinks: warnings.length,
  bestOffers: items.filter((item) => item.bestOffer).length,
  purchaseOffers: items.reduce((sum, item) => sum + (item.purchaseOffers?.length ?? 0), 0),
  offerSynced: items.filter((item) => item.offerStatus?.state === 'available').length,
  noAvailableOffer: items.filter((item) => item.offerStatus?.state === 'no_available_offer').length,
  failures: failures.length,
};

console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

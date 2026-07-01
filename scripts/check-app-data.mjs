import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const appDataPath = path.join('src', 'data', 'items.json');
const data = JSON.parse(readFileSync(appDataPath, 'utf8'));
const items = data.items ?? [];
const failures = [];
const warnings = [];
const shortUrlHosts = new Set(['bit.ly', 'naver.me', 'tinyurl.com', 't.co', 'goo.gl']);
const offerStatusStates = new Set(['not_synced', 'available', 'no_available_offer', 'needs_review']);

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

  if (!item.imagePath?.startsWith('/images/')) {
    failures.push(`bad image path: ${item.title}`);
  } else {
    const localImagePath = path.join('public', item.imagePath.replace(/^\//, ''));
    if (!existsSync(localImagePath)) {
      failures.push(`missing image file: ${item.imagePath}`);
    }
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
    if (!item.bestOffer.url?.startsWith('https://')) {
      failures.push(`best offer must use https: ${item.title} -> ${item.bestOffer.url}`);
    }

    if (item.bestOffer.inStock !== true) {
      failures.push(`best offer must be in stock: ${item.title}`);
    }

    if (!Number.isFinite(item.bestOffer.price) || item.bestOffer.price <= 0) {
      failures.push(`best offer has bad price: ${item.title}`);
    }

    if (!Number.isFinite(item.bestOffer.totalPrice) || item.bestOffer.totalPrice <= 0) {
      failures.push(`best offer has bad total price: ${item.title}`);
    }

    if (!item.bestOffer.syncedAt) {
      failures.push(`best offer missing syncedAt: ${item.title}`);
    }
  }
}

const summary = {
  items: items.length,
  ready: items.filter((item) => item.dataQuality?.status === 'ready').length,
  usableWithWarnings: items.filter((item) => item.dataQuality?.status === 'usable_with_warnings').length,
  needsReview: items.filter((item) => item.dataQuality?.status === 'needs_review').length,
  shortLinks: warnings.length,
  bestOffers: items.filter((item) => item.bestOffer).length,
  offerSynced: items.filter((item) => item.offerStatus?.state === 'available').length,
  noAvailableOffer: items.filter((item) => item.offerStatus?.state === 'no_available_offer').length,
  failures: failures.length,
};

console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

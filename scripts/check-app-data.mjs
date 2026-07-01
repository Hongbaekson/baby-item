import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const appDataPath = path.join('src', 'data', 'items.json');
const data = JSON.parse(readFileSync(appDataPath, 'utf8'));
const items = data.items ?? [];
const failures = [];

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

  if (!item.imagePath?.startsWith('/images/')) {
    failures.push(`bad image path: ${item.title}`);
  } else {
    const localImagePath = path.join('public', item.imagePath.replace(/^\//, ''));
    if (!existsSync(localImagePath)) {
      failures.push(`missing image file: ${item.imagePath}`);
    }
  }

  for (const link of item.partnerLinks ?? []) {
    if (!/^https?:\/\//.test(link.url)) {
      failures.push(`bad partner link: ${item.title} -> ${link.url}`);
    }
  }
}

const summary = {
  items: items.length,
  ready: items.filter((item) => item.dataQuality?.status === 'ready').length,
  usableWithWarnings: items.filter((item) => item.dataQuality?.status === 'usable_with_warnings').length,
  needsReview: items.filter((item) => item.dataQuality?.status === 'needs_review').length,
  failures: failures.length,
};

console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

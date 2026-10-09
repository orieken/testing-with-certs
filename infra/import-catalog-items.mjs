import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const source = JSON.parse(readFileSync('/source/apps/mock-api/data/items.json', 'utf8'));
if (!Array.isArray(source) || source.length === 0 || source.length > 100) throw new Error('Unexpected item seed size');
const seen = new Set();
const items = [];
for (const raw of source) {
  if (typeof raw !== 'object' || raw === null ||
      typeof raw.id !== 'string' || !/^[a-z0-9-]+$/.test(raw.id) || seen.has(raw.id) ||
      typeof raw.name !== 'string' || typeof raw.description !== 'string' ||
      typeof raw.rarity !== 'string' || typeof raw.price !== 'number' ||
      !Number.isFinite(raw.price) || raw.price < 0) throw new Error('Invalid source item');
  seen.add(raw.id);
  const priceCopper = raw.price * 100;
  if (!Number.isSafeInteger(priceCopper)) throw new Error('Nonintegral copper price');
  const image = `/images/${raw.id}.png`;
  if (!existsSync(join('/work/apps/magic-shop/public', image))) continue;
  items.push({ id: raw.id, name: raw.name, description: raw.description,
    rarity: raw.rarity, image, priceCopper });
}
if (items.length < 10) throw new Error('Too few locally illustrated items');
writeFileSync('/work/seed/catalog-items.json', JSON.stringify(items, null, 2) + '\n');

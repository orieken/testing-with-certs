export type Item = {
  id: string;
  name: string;
  priceCopper: number;
  rarity?: string;
  image?: string;
  description?: string;
  categoryId?: string;
  displayStock?: number;
  active?: boolean;
};

function parseItem(value: unknown): Item {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid catalog item');
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string' ||
      typeof record.priceCopper !== 'number' || !Number.isSafeInteger(record.priceCopper) || record.priceCopper < 0) {
    throw new Error('Invalid catalog item');
  }
  for (const key of ['rarity', 'image', 'description'] as const) {
    if (record[key] !== undefined && typeof record[key] !== 'string') throw new Error('Invalid catalog item');
  }
  return {
    id: record.id,
    name: record.name,
    priceCopper: record.priceCopper,
    ...(typeof record.rarity === 'string' ? { rarity: record.rarity } : {}),
    ...(typeof record.image === 'string' && record.image.startsWith('/images/') ? { image: record.image } : {}),
    ...(typeof record.description === 'string' ? { description: record.description } : {}),
    ...(typeof record.categoryId === 'string' ? { categoryId: record.categoryId } : {}),
    ...(typeof record.displayStock === 'number' ? { displayStock: record.displayStock } : {}),
    ...(typeof record.active === 'boolean' ? { active: record.active } : {})
  };
}

async function fetchJson(path: string): Promise<unknown> {
  const token = await getAccessToken();
  const response = await fetch(path, {
    signal: AbortSignal.timeout(10_000),
    credentials: 'same-origin',
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Catalog unavailable (${response.status})`);
  return response.json() as Promise<unknown>;
}

export async function fetchItemPage(search = '', cursor?: string): Promise<{ items: Item[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: '24' });
  if (search) params.set('search', search.slice(0, 100));
  if (cursor) params.set('cursor', cursor);
  const data = await fetchJson(`/api/catalog/items?${params}`);
  if (typeof data !== 'object' || data === null || !('items' in data) || !Array.isArray(data.items) || data.items.length > 24) {
    throw new Error('Invalid catalog response');
  }
  if (!('nextCursor' in data) || (data.nextCursor !== null && typeof data.nextCursor !== 'string')) throw new Error('Invalid catalog cursor');
  return { items: data.items.map(parseItem), nextCursor: data.nextCursor };
}

export async function fetchItems(): Promise<Item[]> { return (await fetchItemPage()).items; }

export async function fetchItemById(id: string): Promise<Item | null> {
  const data = await fetchJson(`/api/catalog/items/${encodeURIComponent(id)}`);
  return data === null ? null : parseItem(data);
}
import { getAccessToken } from '../auth/session';
import type { components } from '../../../../contracts/generated/catalog';
import { apiJson } from './http';

export type ItemCreate = components['schemas']['ItemCreate'];
export type ItemPatch = components['schemas']['ItemPatch'];
export const createItem = (body: ItemCreate) => apiJson<components['schemas']['Item']>('/api/catalog/items', { method: 'POST', body });
export const updateItem = (id: string, body: ItemPatch) => apiJson<components['schemas']['Item']>(`/api/catalog/items/${encodeURIComponent(id)}`, { method: 'PATCH', body });
export const archiveItem = (id: string) => apiJson<void>(`/api/catalog/items/${encodeURIComponent(id)}`, { method: 'DELETE' });

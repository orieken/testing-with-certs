export type Role = 'customer' | 'shopkeeper' | 'shop-admin';
export type RegionId = 'waterdeep' | 'baldurs-gate' | 'neverwinter' | 'empty-march';
export type OrderStatus = 'pending' | 'completed' | 'cancelled';
export interface Profile { sub: string; displayName: string; regionId: RegionId; location: [number, number] }
export interface OrderLine { itemId: string; name: string; unitPriceCopper: number; quantity: number; lineTotalCopper: number }
export interface Order { orderId: string; ownerSub: string; regionId: RegionId; status: OrderStatus; createdAt: string; completedAt: string | null; lines: OrderLine[]; totalCopper: number }
export interface Checkout { regionId: RegionId; lines: Array<{ itemId: string; quantity: number }> }
export interface Quote { lines: OrderLine[]; totalCopper: number }
export interface Page<T> { items: T[]; nextCursor: string | null }
export interface ReportingPage { revision: string; items: Array<{ order: Order; customer: Profile }>; nextCursor: string | null }

const id = /^[a-z0-9][a-z0-9-]{0,63}$/;
const regions = new Set<RegionId>(['waterdeep', 'baldurs-gate', 'neverwinter', 'empty-march']);
const customerWidgets = new Set(['recent-orders']);
const adminWidgets = new Set(['recent-orders', 'total-sales', 'sales-by-region', 'recent-admin-orders', 'customer-list']);
export function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean { return Object.keys(value).every(key => allowed.includes(key)); }
export function validId(value: unknown): value is string { return typeof value === 'string' && id.test(value); }
export function validRegion(value: unknown): value is RegionId { return typeof value === 'string' && regions.has(value as RegionId); }
export function validSub(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function validLocation(value: unknown): value is [number, number] { return Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && Number.isFinite(value[0]) && value[0] >= -180 && value[0] <= 180 && typeof value[1] === 'number' && Number.isFinite(value[1]) && value[1] >= -90 && value[1] <= 90; }
export function validProfilePatch(value: unknown): value is Partial<Omit<Profile, 'sub'>> {
  return record(value) && Object.keys(value).length > 0 && exactKeys(value, ['displayName', 'regionId', 'location']) &&
    (value.displayName === undefined || (typeof value.displayName === 'string' && value.displayName.length > 0 && [...value.displayName].length <= 120)) &&
    (value.regionId === undefined || validRegion(value.regionId)) && (value.location === undefined || validLocation(value.location));
}
export function validCheckout(value: unknown): value is Checkout {
  return record(value) && exactKeys(value, ['regionId', 'lines']) && validRegion(value.regionId) &&
    Array.isArray(value.lines) && value.lines.length >= 1 && value.lines.length <= 50 && value.lines.every(line => record(line) && exactKeys(line, ['itemId', 'quantity']) && validId(line.itemId) && Number.isInteger(line.quantity) && (line.quantity as number) >= 1 && (line.quantity as number) <= 100);
}
export function validWidgets(value: unknown, role: Role): 'valid' | 'invalid' | 'forbidden' {
  if (!record(value) || !exactKeys(value, ['widgetIds']) || !Array.isArray(value.widgetIds) || value.widgetIds.length > 10 || !value.widgetIds.every(id => typeof id === 'string') || new Set(value.widgetIds).size !== value.widgetIds.length) return 'invalid';
  if (!value.widgetIds.every(id => adminWidgets.has(id))) return 'invalid';
  if (role !== 'shop-admin' && !value.widgetIds.every(id => customerWidgets.has(id))) return 'forbidden';
  return 'valid';
}
export function canonicalCheckout(checkout: Checkout): string { return JSON.stringify({ regionId: checkout.regionId, lines: checkout.lines.map(line => ({ itemId: line.itemId, quantity: line.quantity })) }); }
export function validQuote(value: unknown, request: Checkout): value is Quote {
  if (!record(value) || !Array.isArray(value.lines) || value.lines.length !== request.lines.length || !Number.isSafeInteger(value.totalCopper) || (value.totalCopper as number) < 0) return false;
  let total = 0;
  for (let i = 0; i < request.lines.length; i++) {
    const line = value.lines[i]; const wanted = request.lines[i];
    if (!record(line) || !wanted || line.itemId !== wanted.itemId || line.quantity !== wanted.quantity || typeof line.name !== 'string' || !validId(line.itemId) || !Number.isSafeInteger(line.unitPriceCopper) || (line.unitPriceCopper as number) < 0 || !Number.isSafeInteger(line.lineTotalCopper) || line.lineTotalCopper !== (line.unitPriceCopper as number) * wanted.quantity) return false;
    total += line.lineTotalCopper as number;
    if (!Number.isSafeInteger(total)) return false;
  }
  return total === value.totalCopper;
}
export function cursorAfter(raw: string | null): string | null {
  if (raw === null) return null;
  if (raw.length < 1 || raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  return validId(decoded) || validSub(decoded) ? decoded : null;
}
export function encodeCursor(value: string): string { return Buffer.from(value).toString('base64url'); }
export function validUtc(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value)); }

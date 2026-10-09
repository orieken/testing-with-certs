import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import type { TLSSocket } from 'node:tls';
import { authenticate, AuthFailure, catalogQuote } from './auth.js';
import { canonicalCheckout, cursorAfter, record, validCheckout, validId, validProfilePatch, validQuote, validRegion, validUtc, validWidgets, type Order, type Role, type RegionId } from './domain.js';
import { Store } from './store.js';

type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 503;
class ApiError extends Error { constructor(public readonly status: ErrorStatus) { super(({ 400: 'invalid_request', 401: 'invalid_token', 403: 'forbidden', 404: 'not_found', 409: 'conflict', 422: 'unprocessable', 503: 'dependency_unavailable' } as const)[status]); } }
function send(res: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)), 'cache-control': 'no-store', ...headers });
  res.end(body);
}
function fail(res: ServerResponse, status: ErrorStatus): void { const error = new ApiError(status); send(res, status, { code: error.message, message: error.message }); }
function bearer(req: IncomingMessage): string {
  const values = req.headersDistinct.authorization;
  if (values?.length !== 1 || !values[0]?.startsWith('Bearer ')) return '';
  return values[0].slice(7);
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (req.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new ApiError(400);
  const chunks: Buffer[] = []; let bytes = 0;
  for await (const chunk of req) { const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array); bytes += part.length; if (bytes > 16_384) throw new ApiError(400); chunks.push(part); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; if (record(value)) return value; }
  catch { /* handled below */ }
  throw new ApiError(400);
}
function query(url: URL, allowed: readonly string[]): URLSearchParams {
  for (const [key] of url.searchParams) if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) throw new ApiError(400);
  return url.searchParams;
}
function pageParams(url: URL, allowed: readonly string[]): { limit: number; after: string | null; params: URLSearchParams } {
  const params = query(url, allowed); const limitRaw = params.get('limit');
  const limit = limitRaw === null ? 20 : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (limitRaw !== null && !/^\d+$/.test(limitRaw))) throw new ApiError(400);
  const raw = params.get('cursor'); const after = cursorAfter(raw);
  if (raw !== null && after === null) throw new ApiError(400);
  return { limit, after, params };
}
function filters(params: URLSearchParams): { region?: RegionId; from?: string; to?: string; status?: Order['status'] } {
  const result: { region?: RegionId; from?: string; to?: string; status?: Order['status'] } = {};
  const region = params.get('regionId'); if (region !== null) { if (!validRegion(region)) throw new ApiError(400); result.region = region; }
  const from = params.get('from'); if (from !== null) { if (!validUtc(from)) throw new ApiError(400); result.from = from; }
  const to = params.get('to'); if (to !== null) { if (!validUtc(to)) throw new ApiError(400); result.to = to; }
  if (from && to && from >= to) throw new ApiError(400);
  const status = params.get('status'); if (status !== null) { if (status !== 'pending' && status !== 'completed' && status !== 'cancelled') throw new ApiError(400); result.status = status; }
  return result;
}
async function main(): Promise<void> {
  const store = await Store.open(); await store.initialize();
  const spec = readFileSync('/app/contracts/customer.json'); const digest = createHash('sha256').update(spec).digest('hex');
  const tls = { key: readFileSync('/credentials/key.pem'), cert: readFileSync('/credentials/cert.pem'), ca: readFileSync('/trust/service-ca.pem'), crl: readFileSync('/trust/service.crl.pem'), requestCert: true, rejectUnauthorized: true, minVersion: 'TLSv1.2' as const };
  const server = createHttpsServer(tls, (req, res) => { void handle(req, res, store, spec, digest).catch(error => {
    if (res.headersSent) { res.destroy(); return; }
    if (error instanceof ApiError) fail(res, error.status);
    else if (error instanceof AuthFailure) fail(res, error.status);
    else { console.error('customer dependency failure', error instanceof Error ? `${error.name}: ${error.message}` : 'unknown'); fail(res, 503); }
  }); });
  server.requestTimeout = 10_000; server.headersTimeout = 10_000; server.keepAliveTimeout = 5_000; server.maxHeadersCount = 80; server.listen(8443, '0.0.0.0');
  const health = createHttpServer((req, res) => { void store.ready().then(() => { res.writeHead(req.url === '/health/ready' ? 200 : 404); res.end(req.url === '/health/ready' ? 'UP' : 'Not found'); }).catch(() => { res.writeHead(503); res.end('Unavailable'); }); });
  health.requestTimeout = 5_000; health.listen(9000, '127.0.0.1');
}
async function handle(req: IncomingMessage, res: ServerResponse, store: Store, spec: Buffer, digest: string): Promise<void> {
  const url = new URL(req.url ?? '/', 'https://customer-api:8443'); const path = url.pathname; const method = req.method ?? '';
  const publicRoute = path.startsWith('/api/customer/'); const privateRoute = path === '/internal/reporting/orders' || path === '/internal/openapi.json';
  if (!publicRoute && !privateRoute) throw new ApiError(404);
  const socket = req.socket as TLSSocket; const caller = socket.getPeerCertificate().subject?.CN;
  if (!socket.authorized || (publicRoute && caller !== 'gateway') || (privateRoute && caller !== 'insights-api')) throw new ApiError(403);
  const raw = bearer(req); if (!raw) throw new ApiError(401);
  const identityHeader = req.headersDistinct['x-cert-identity'];
  const identity = await authenticate(raw, caller ?? '', publicRoute && identityHeader?.length === 1 ? identityHeader[0]! : '');
  if (privateRoute) {
    if (!identity.service) throw new ApiError(403);
    if (path === '/internal/openapi.json') {
      query(url, []); if (method !== 'GET') throw new ApiError(404);
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': String(spec.length), 'x-openapi-sha256': digest, 'cache-control': 'no-store' }); res.end(spec); return;
    }
    if (method !== 'GET') throw new ApiError(404);
    const { limit, after, params } = pageParams(url, ['limit', 'cursor', 'revision', 'regionId', 'from', 'to']);
    const revision = params.get('revision'); if ((after && !revision) || (revision !== null && (!/^r\d+$/.test(revision) || revision.length > 100))) throw new ApiError(400);
    const page = await store.reporting(limit, after, revision, filters(params)); if (page === 'conflict') throw new ApiError(409);
    send(res, 200, page); return;
  }
  if (identity.service || !identity.role) throw new ApiError(403);
  const sub = identity.sub; const role: Role = identity.role;
  if (path === '/api/customer/me') {
    query(url, []);
    if (method === 'GET') { const value = await store.getProfile(sub); if (!value) throw new ApiError(404); send(res, 200, value); return; }
    if (method === 'PATCH') { const patch = await body(req); if (!validProfilePatch(patch)) throw new ApiError(400); const value = await store.updateProfile(sub, patch); if (!value) throw new ApiError(404); send(res, 200, value); return; }
  }
  if (path === '/api/customer/me/widgets') {
    query(url, []);
    if (method === 'GET') { send(res, 200, { widgetIds: await store.getWidgets(sub) }); return; }
    if (method === 'PUT') { const value = await body(req); const checked = validWidgets(value, role); if (checked === 'invalid') throw new ApiError(400); if (checked === 'forbidden') throw new ApiError(422); await store.putWidgets(sub, value.widgetIds as string[]); send(res, 200, value); return; }
  }
  if (path === '/api/customer/orders') {
    if (method === 'GET') { const { limit, after } = pageParams(url, ['limit', 'cursor']); send(res, 200, await store.listOrders(sub, limit, after)); return; }
    if (method === 'POST') {
      query(url, []); const keys = req.headersDistinct['idempotency-key']; const key = keys?.length === 1 ? keys[0] : undefined;
      if (!key || [...key].length < 16 || [...key].length > 128) throw new ApiError(400);
      const value = await body(req); if (!validCheckout(value)) throw new ApiError(400);
      const hash = createHash('sha256').update(canonicalCheckout(value)).digest('hex'); const old = await store.findCheckout(sub, key);
      if (old) { if (old.requestHash !== hash) throw new ApiError(409); send(res, 201, old.order, { location: `/api/customer/orders/${old.order.orderId}` }); return; }
      const quote = await catalogQuote(value.lines); if (quote.status === 422) throw new ApiError(422);
      if (quote.status !== 200 || !validQuote(quote.body, value)) throw new ApiError(503);
      const result = await store.createOrder(sub, key, hash, value, quote.body.lines, quote.body.totalCopper);
      if (result.conflict) throw new ApiError(409);
      send(res, 201, result.order, { location: `/api/customer/orders/${result.order.orderId}` }); return;
    }
  }
  if (path.startsWith('/api/customer/orders/')) {
    query(url, []); if (method !== 'GET') throw new ApiError(404);
    const id = path.slice('/api/customer/orders/'.length); if (!validId(id)) throw new ApiError(400);
    const value = await store.getOrder(id, sub); if (!value) throw new ApiError(404); send(res, 200, value); return;
  }
  if (path === '/api/customer/admin/users') {
    if (role !== 'shop-admin') throw new ApiError(403); if (method !== 'GET') throw new ApiError(404);
    const { limit, after, params } = pageParams(url, ['limit', 'cursor', 'regionId']); const region = params.get('regionId'); if (region !== null && !validRegion(region)) throw new ApiError(400);
    send(res, 200, await store.listProfiles(limit, after, region ?? undefined)); return;
  }
  if (path === '/api/customer/admin/orders') {
    if (role !== 'shop-admin') throw new ApiError(403); if (method !== 'GET') throw new ApiError(404);
    const { limit, after, params } = pageParams(url, ['limit', 'cursor', 'regionId', 'from', 'to', 'status']);
    send(res, 200, await store.listOrders(null, limit, after, filters(params))); return;
  }
  throw new ApiError(404);
}
void main().catch(error => { console.error('customer API startup failed:', error instanceof Error ? error.message : 'unknown'); process.exitCode = 1; });

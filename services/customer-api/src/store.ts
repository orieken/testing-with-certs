import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { encodeCursor, type Checkout, type Order, type OrderLine, type Page, type Profile, type RegionId, type ReportingPage } from './domain.js';

interface ProfileRow extends QueryResultRow { sub: string; display_name: string; region_id: RegionId; location: [number, number] }
interface OrderRow extends QueryResultRow { order_id: string; owner_sub: string; region_id: RegionId; status: Order['status']; created_at: Date; completed_at: Date | null; lines: OrderLine[]; total_copper: string }
function profile(row: ProfileRow): Profile { return { sub: row.sub, displayName: row.display_name, regionId: row.region_id, location: row.location }; }
function order(row: OrderRow): Order { return { orderId: row.order_id, ownerSub: row.owner_sub, regionId: row.region_id, status: row.status, createdAt: row.created_at.toISOString(), completedAt: row.completed_at?.toISOString() ?? null, lines: row.lines, totalCopper: Number(row.total_copper) }; }
const orderColumns = 'order_id,owner_sub,region_id,status,created_at,completed_at,lines,total_copper';

export class Store {
  private constructor(private readonly pool: Pool) {}
  static async open(): Promise<Store> {
    const password = readFileSync('/db-secret/service-password', 'utf8').trim();
    if (!password) throw new Error('customer database password missing');
    const pool = new Pool({ host: 'postgres', port: 5432, database: 'customer_db', user: 'customer_app', password,
      ssl: { ca: readFileSync('/trust/server-ca.pem', 'utf8'), rejectUnauthorized: true, servername: 'postgres' },
      max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, query_timeout: 5000, statement_timeout: 5000,
      application_name: 'customer-api' });
    try { await pool.query('SELECT 1'); return new Store(pool); } catch (error) { await pool.end(); throw error; }
  }
  async close(): Promise<void> { await this.pool.end(); }
  async ready(): Promise<void> { await this.pool.query('SELECT 1'); }
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(readFileSync('/app/migrations/001_customer.sql', 'utf8'));
      const profiles = JSON.parse(readFileSync('/app/seed/customer-profiles.json', 'utf8')) as Profile[];
      const orders = JSON.parse(readFileSync('/app/seed/orders.json', 'utf8')) as Array<Order & { checkoutKey: string }>;
      if (profiles.length !== 6 || orders.length !== 9) throw new Error('customer seed count changed');
      for (const entry of profiles) await client.query('INSERT INTO profiles(sub,display_name,region_id,location) VALUES ($1,$2,$3,$4) ON CONFLICT (sub) DO NOTHING', [entry.sub, entry.displayName, entry.regionId, JSON.stringify(entry.location)]);
      for (const entry of orders) await client.query('INSERT INTO orders(order_id,owner_sub,region_id,status,created_at,completed_at,lines,total_copper,checkout_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (order_id) DO NOTHING', [entry.orderId, entry.ownerSub, entry.regionId, entry.status, entry.createdAt, entry.completedAt, JSON.stringify(entry.lines), entry.totalCopper, entry.checkoutKey]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async getProfile(sub: string): Promise<Profile | null> {
    const result = await this.pool.query<ProfileRow>('SELECT sub,display_name,region_id,location FROM profiles WHERE sub=$1', [sub]);
    return result.rows[0] ? profile(result.rows[0]) : null;
  }
  async updateProfile(sub: string, patch: Partial<Omit<Profile, 'sub'>>): Promise<Profile | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<ProfileRow>('UPDATE profiles SET display_name=COALESCE($2,display_name),region_id=COALESCE($3,region_id),location=COALESCE($4::jsonb,location) WHERE sub=$1 RETURNING sub,display_name,region_id,location', [sub, patch.displayName ?? null, patch.regionId ?? null, patch.location ? JSON.stringify(patch.location) : null]);
      if (result.rowCount) await client.query('UPDATE dataset_meta SET revision=revision+1 WHERE singleton=true');
      await client.query('COMMIT');
      return result.rows[0] ? profile(result.rows[0]) : null;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async getWidgets(sub: string): Promise<string[]> {
    const result = await this.pool.query<{ widget_ids: string[] }>('SELECT widget_ids FROM widget_layouts WHERE owner_sub=$1', [sub]);
    return result.rows[0]?.widget_ids ?? [];
  }
  async putWidgets(sub: string, ids: string[]): Promise<void> {
    await this.pool.query('INSERT INTO widget_layouts(owner_sub,widget_ids) VALUES ($1,$2) ON CONFLICT (owner_sub) DO UPDATE SET widget_ids=EXCLUDED.widget_ids', [sub, JSON.stringify(ids)]);
  }
  async getOrder(id: string, owner?: string): Promise<Order | null> {
    const result = await this.pool.query<OrderRow>(`SELECT ${orderColumns} FROM orders WHERE order_id=$1 AND ($2::uuid IS NULL OR owner_sub=$2::uuid)`, [id, owner ?? null]);
    return result.rows[0] ? order(result.rows[0]) : null;
  }
  async findCheckout(owner: string, key: string): Promise<{ order: Order; requestHash: string | null } | null> {
    const result = await this.pool.query<OrderRow & { request_hash: string | null }>(`SELECT ${orderColumns},request_hash FROM orders WHERE owner_sub=$1 AND checkout_key=$2`, [owner, key]);
    return result.rows[0] ? { order: order(result.rows[0]), requestHash: result.rows[0].request_hash } : null;
  }
  async createOrder(owner: string, key: string, hash: string, checkout: Checkout, lines: OrderLine[], total: number): Promise<{ order: Order; conflict: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const now = new Date(); const id = `order-${randomUUID()}`;
      const inserted = await client.query<OrderRow>(`INSERT INTO orders(order_id,owner_sub,region_id,status,created_at,completed_at,lines,total_copper,checkout_key,request_hash) VALUES ($1,$2,$3,'completed',$4,$4,$5,$6,$7,$8) ON CONFLICT (owner_sub,checkout_key) DO NOTHING RETURNING ${orderColumns}`, [id, owner, checkout.regionId, now, JSON.stringify(lines), total, key, hash]);
      if (inserted.rows[0]) {
        await client.query('UPDATE dataset_meta SET revision=revision+1 WHERE singleton=true');
        await client.query('COMMIT');
        return { order: order(inserted.rows[0]), conflict: false };
      }
      const existing = await client.query<OrderRow & { request_hash: string | null }>(`SELECT ${orderColumns},request_hash FROM orders WHERE owner_sub=$1 AND checkout_key=$2`, [owner, key]);
      await client.query('COMMIT');
      if (!existing.rows[0]) throw new Error('idempotency row disappeared');
      return { order: order(existing.rows[0]), conflict: existing.rows[0].request_hash !== hash };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async listOrders(owner: string | null, limit: number, after: string | null, filters: { region?: RegionId; from?: string; to?: string; status?: Order['status'] } = {}): Promise<Page<Order>> {
    const result = await this.pool.query<OrderRow>(`SELECT ${orderColumns} FROM orders WHERE ($1::uuid IS NULL OR owner_sub=$1::uuid) AND ($2::text IS NULL OR region_id=$2) AND ($3::timestamptz IS NULL OR created_at >= $3) AND ($4::timestamptz IS NULL OR created_at < $4) AND ($5::text IS NULL OR status=$5) AND ($6::text IS NULL OR (created_at,order_id) < (SELECT created_at,order_id FROM orders WHERE order_id=$6)) ORDER BY created_at DESC,order_id DESC LIMIT $7`, [owner, filters.region ?? null, filters.from ?? null, filters.to ?? null, filters.status ?? null, after, limit + 1]);
    const rows = result.rows.slice(0, limit); return { items: rows.map(order), nextCursor: result.rows.length > limit ? encodeCursor(rows[rows.length - 1]!.order_id) : null };
  }
  async listProfiles(limit: number, after: string | null, region?: RegionId): Promise<Page<Profile>> {
    const result = await this.pool.query<ProfileRow>('SELECT p.sub,p.display_name,p.region_id,p.location FROM profiles p WHERE ($1::uuid IS NULL OR p.sub>$1::uuid) AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM orders o WHERE o.owner_sub=p.sub AND o.region_id=$2)) ORDER BY p.sub LIMIT $3', [after, region ?? null, limit + 1]);
    const rows = result.rows.slice(0, limit); return { items: rows.map(profile), nextCursor: result.rows.length > limit ? encodeCursor(rows[rows.length - 1]!.sub) : null };
  }
  async reporting(limit: number, after: string | null, revision: string | null, filters: { region?: RegionId; from?: string; to?: string }): Promise<ReportingPage | 'conflict'> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const current = await client.query<{ revision: string }>('SELECT revision FROM dataset_meta WHERE singleton=true');
      const marker = `r${current.rows[0]?.revision ?? '0'}`;
      if (revision !== null && revision !== marker) { await client.query('ROLLBACK'); return 'conflict'; }
      const result = await client.query<OrderRow & { sub: string; display_name: string; profile_region: RegionId; location: [number, number] }>(`SELECT o.${orderColumns.replaceAll(',', ',o.')},p.sub,p.display_name,p.region_id AS profile_region,p.location FROM orders o JOIN profiles p ON p.sub=o.owner_sub WHERE ($1::text IS NULL OR o.order_id>$1) AND ($2::text IS NULL OR o.region_id=$2) AND ($3::timestamptz IS NULL OR o.completed_at >= $3) AND ($4::timestamptz IS NULL OR o.completed_at < $4) ORDER BY o.order_id LIMIT $5`, [after, filters.region ?? null, filters.from ?? null, filters.to ?? null, limit + 1]);
      const rows = result.rows.slice(0, limit);
      await client.query('COMMIT');
      return { revision: marker, items: rows.map(row => ({ order: order(row), customer: profile({ sub: row.sub, display_name: row.display_name, region_id: row.profile_region, location: row.location }) })), nextCursor: result.rows.length > limit ? encodeCursor(rows[rows.length - 1]!.order_id) : null };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}

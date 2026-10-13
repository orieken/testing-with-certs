import { createRequire } from 'node:module';
const pg = createRequire('/work/services/customer-api/package.json')('pg');
import { readFileSync } from 'node:fs';
const { Pool } = pg;
export const pool = new Pool({ host: 'postgres', port: 5432, database: 'customer_db', user: 'customer_app', password: readFileSync('/db-secret/service-password', 'utf8').trim(),
  ssl: { ca: readFileSync('/public/server-ca.pem', 'utf8'), rejectUnauthorized: true, servername: 'postgres' }, max: 1, connectionTimeoutMillis: 5000, query_timeout: 5000, statement_timeout: 5000 });
export async function snapshot(owner, key) {
  const result = await pool.query('SELECT (SELECT count(*)::int FROM orders) AS total, (SELECT count(*)::int FROM orders WHERE owner_sub=$1 AND checkout_key=$2) AS matching, (SELECT revision::text FROM dataset_meta WHERE singleton) AS revision, (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls', [owner, key]);
  return result.rows[0];
}
export async function savedOrder(owner, key) {
  const result = await pool.query('SELECT order_id, status, request_hash, total_copper::int, lines FROM orders WHERE owner_sub=$1 AND checkout_key=$2', [owner, key]);
  return result.rows;
}

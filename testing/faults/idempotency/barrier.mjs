import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
const { Pool } = createRequire('/work/services/customer-api/package.json')('pg');
export const observer = new Pool({ host: 'postgres', port: 5432, database: 'customer_db', user: 'customer_app',
  password: readFileSync('/db-secret/service-password', 'utf8').trim(),
  ssl: { ca: readFileSync('/public/server-ca.pem', 'utf8'), rejectUnauthorized: true, servername: 'postgres' },
  max: 2, application_name: 'idempotency-barrier', connectionTimeoutMillis: 5000, query_timeout: 5000, statement_timeout: 5000 });
export async function pendingInserts() {
  const { rows } = await observer.query(`SELECT count(*)::int AS waiting FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
    WHERE l.locktype='relation' AND l.relation='orders'::regclass AND l.database=(SELECT oid FROM pg_database WHERE datname=current_database())
    AND l.mode='RowExclusiveLock' AND NOT l.granted AND a.application_name='customer-api' AND a.query LIKE 'INSERT INTO orders%'`);
  return rows[0].waiting;
}
export async function race(actions) {
  const holder = await observer.connect(); let pending = [];
  try {
    await holder.query('BEGIN'); await holder.query('LOCK TABLE orders IN SHARE MODE');
    pending = actions.map(action => action());
    // Mark rejections handled immediately, even if the barrier itself fails.
    const settled = Promise.allSettled(pending);
    await expect.poll(pendingInserts, { timeout: 2500, intervals: [50, 100, 200], message: 'Every real insert must be blocked before release' }).toBe(actions.length);
    await holder.query('COMMIT');
    const results = await settled;
    return results.map(item => { if (item.status === 'rejected') throw item.reason; return item.value; });
  } finally {
    await holder.query('ROLLBACK'); holder.release(); await Promise.allSettled(pending);
  }
}

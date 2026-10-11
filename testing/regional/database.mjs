import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fixtures } from './fixtures.mjs';
import { validateHttpResponse } from '../api/contracts/validator.ts';
const { Pool }=createRequire('/work/services/customer-api/package.json')('pg');
export const pool=new Pool({host:'postgres',port:5432,database:'customer_db',user:'customer_app',password:readFileSync('/db-secret/service-password','utf8').trim(),ssl:{ca:readFileSync('/public/server-ca.pem','utf8'),servername:'postgres',rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,query_timeout:5000});
export async function provision(){
 assert.equal((await pool.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0].ssl,true);
 const client=await pool.connect();try{
  await client.query('BEGIN');
  for(const row of fixtures){validateHttpResponse('customer','getMyOrder',200,{status:200,headers:{'content-type':'application/json'},rawBody:Buffer.from(JSON.stringify(row))});await client.query('INSERT INTO orders(order_id,owner_sub,region_id,status,created_at,completed_at,lines,total_copper,checkout_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[row.orderId,row.ownerSub,row.regionId,row.status,row.createdAt,row.completedAt,JSON.stringify(row.lines),row.totalCopper,row.orderId]);}
  await client.query('UPDATE dataset_meta SET revision=revision+1 WHERE singleton');await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export async function snapshot(){return (await pool.query("SELECT order_id,owner_sub,region_id,status,completed_at,total_copper::int FROM orders WHERE order_id LIKE 'region10-%' ORDER BY order_id")).rows;}
export async function cleanup(){const client=await pool.connect();try{await client.query('BEGIN');await client.query("DELETE FROM orders WHERE order_id LIKE 'region10-%'");await client.query('UPDATE dataset_meta SET revision=revision+1 WHERE singleton');await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}

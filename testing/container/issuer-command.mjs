#!/usr/local/bin/node
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const [action, namespace, name] = process.argv.slice(2);
if (namespace !== 'lab' || !['customer-waterdeep', 'shop-admin'].includes(name)) throw new Error('Issuer identity not allowed');
if (!(await readFile(process.env.SATURDAY_OPERATOR_CAPABILITY_FILE, 'utf8')).trim()) throw new Error('Issuer capability missing');
const operation = { provision: 'init', renew: 'renew', revoke: 'revoke' }[action];
if (!operation) throw new Error('Issuer action not allowed');
const args = ['/work/infra/pki/issue.sh', operation, ...(operation === 'init' ? [] : [name])];
await promisify(execFile)('/bin/bash', args, { timeout: 110_000, maxBuffer: 16_384 });

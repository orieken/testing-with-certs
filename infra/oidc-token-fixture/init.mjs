import { chownSync, chmodSync, existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const path = '/state/client-secret';
if (existsSync(path)) throw new Error('Refusing an existing ID-token fixture secret');
writeFileSync(path, randomBytes(32).toString('base64url'), { mode: 0o600, flag: 'wx' });
chownSync(path, 1000, 1000); chownSync('/state', 1000, 1000); chmodSync('/state', 0o700);

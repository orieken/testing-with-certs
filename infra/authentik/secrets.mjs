import { existsSync, writeFileSync, chmodSync, chownSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
for (const name of ['secret-key', 'broker-secret']) {
 const path = `/ak-secrets/${name}`;
 if (!existsSync(path)) writeFileSync(path, randomBytes(48).toString('base64url'), {mode:0o600,flag:'wx'});
 chmodSync(path,0o644);
}
console.log('Disposable authentik secrets ready; values withheld.');

chownSync("/ak-fixture",1000,1000);

const database='/ak-db-secret/password';
if(!existsSync(database))writeFileSync(database,randomBytes(48).toString('base64url'),{mode:0o644,flag:'wx'});

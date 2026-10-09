import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.argv[2];
if (!root?.startsWith('/work/artifacts/')) throw new Error('Expected a mounted local artifact directory');
const forbiddenName = /(?:\.key|\.p12|\.pfx|\.pem|\.crt|\.crl|\.har|trace\.zip|storage[-_]?state|client[-_]?secret|viewer[-_]?password)$/i;
const forbiddenText = /-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----|"(?:access_token|refresh_token|id_token)"\s*:|Bearer\s+eyJ[A-Za-z0-9_-]{20,}|[?&]code=[A-Za-z0-9_-]{16,}/;
const textFile = /\.(?:json|jsonl|xml|html|txt|md)$/i;
let count = 0;
async function visit(path) {
  for (const name of await readdir(path)) {
    if (++count > 5_000) throw new Error('Artifact count exceeds scan bound');
    if (forbiddenName.test(name)) throw new Error(`Credential-like artifact filename: ${name}`);
    const file = join(path, name);
    const info = await lstat(file);
    if (info.isSymbolicLink()) throw new Error(`Artifact symlink is not allowed: ${name}`);
    if (info.isDirectory()) { await visit(file); continue; }
    if (!info.isFile()) throw new Error(`Unexpected artifact type: ${name}`);
    if (textFile.test(name)) {
      if (info.size > 20_000_000) throw new Error(`Text artifact exceeds scan bound: ${name}`);
      if (forbiddenText.test(await readFile(file, 'utf8'))) throw new Error(`Credential-like content in artifact: ${name}`);
    }
  }
}
await visit(root);
console.log(`Safe artifact scan passed (${count} entries)`);

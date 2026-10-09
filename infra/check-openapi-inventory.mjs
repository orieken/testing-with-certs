import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const design = readFileSync(new URL('docs/domain-contract-design.md', root), 'utf8');
const expected = new Map();
for (const line of design.split('\n')) {
  const match = /^\| (Go|Node|Python) \| `(GET|POST|PATCH|PUT|DELETE) ([^`]+)` \| `([^`]+)` \|/.exec(line);
  if (!match) continue;
  const [, owner, method, path, id] = match;
  if (expected.has(id)) throw new Error(`Duplicate design operationId ${id}`);
  expected.set(id, { owner: { Go: 'catalog', Node: 'customer', Python: 'insights' }[owner], method: method.toLowerCase(), path });
}
if (expected.size !== 23) throw new Error(`Expected 23 design operations, got ${expected.size}`);

const specs = ['catalog', 'customer', 'insights'];
const seen = new Map();
let privateCount = 0;
for (const name of specs) {
  const spec = read(`contracts/openapi/${name}.yaml`);
  if (spec.openapi !== '3.1.0' || spec.servers?.[0]?.url !== 'https://shop.magic.test:8443') throw new Error(`${name}: wrong version/public origin`);
  if (spec.components?.securitySchemes?.clientCertificate?.type !== 'mutualTLS') throw new Error(`${name}: mTLS scheme missing`);
  if (spec.components?.securitySchemes?.accessToken?.scheme !== 'bearer') throw new Error(`${name}: bearer scheme missing`);
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const id = op.operationId;
      if (!id || seen.has(id)) throw new Error(`${name}: absent/duplicate operationId ${id}`);
      seen.set(id, { name, method, path });
      const want = expected.get(id);
      if (!want || want.owner !== name || want.method !== method || want.path !== path) throw new Error(`${name}: inventory mismatch ${id}`);
      if (op.security?.length !== 1 || Object.keys(op.security[0]).sort().join(',') !== 'accessToken,clientCertificate') throw new Error(`${id}: mTLS and bearer must be required together`);
      if (!op['x-auth'] || op['x-auth'].audience !== `${name}-api` || !op['x-auth'].pairing) throw new Error(`${id}: authorization metadata incomplete`);
      if (op.responses?.default) throw new Error(`${id}: broad default response forbidden`);
      if (!op.responses?.['200'] && !op.responses?.['201'] && !op.responses?.['204']) throw new Error(`${id}: success response missing`);
      if (!op.responses?.['400'] || !op.responses?.['401'] || !op.responses?.['403']) throw new Error(`${id}: required failure responses missing`);
      if (method === 'post' || method === 'patch' || method === 'put') {
        if (!op.requestBody?.required || !op.requestBody.content?.['application/json']?.schema) throw new Error(`${id}: required JSON request body missing`);
      }
      if (path.startsWith('/internal/')) {
        privateCount++;
        if (op['x-visibility'] !== 'private' || op.servers?.[0]?.url !== `https://${name}-api:8443` || op['x-auth'].roles?.length || !op['x-auth'].scope || op['x-auth'].certificateCaller === 'human') throw new Error(`${id}: private routing/security mismatch`);
        const expectedCaller = name === 'catalog' ? 'customer-api' : 'insights-api';
        const expectedClient = name === 'catalog' ? 'customer-catalog' : 'insights-reporting';
        const expectedScope = name === 'catalog' ? 'catalog.quote' : 'reporting.read';
        if (op['x-auth'].certificateCaller !== expectedCaller || op['x-auth'].tokenClient !== expectedClient || op['x-auth'].scope !== expectedScope || op['x-network-timeout-ms'] !== 10000) throw new Error(`${id}: private caller/scope/timeout mismatch`);
      } else if (op['x-visibility'] !== 'public' || op.servers || !op['x-auth'].roles?.length || op['x-auth'].certificateCaller !== 'human') throw new Error(`${id}: public routing/security mismatch`);
    }
  }
}
if (seen.size !== expected.size || privateCount !== 2) throw new Error(`Coverage mismatch: ${seen.size}/${expected.size} operations, ${privateCount} private`);
console.log(`PASS: ${seen.size} unique operations across three OpenAPI 3.1 specs; two private mTLS-plus-bearer routes`);

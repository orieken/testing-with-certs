import { readFileSync } from 'node:fs';
const response = await fetch('http://127.0.0.1:9102/control', {
  headers: { authorization: `Bearer ${readFileSync('/state/client-secret', 'utf8')}` }, signal: AbortSignal.timeout(5000),
});
if (!response.ok || !(await response.json()).idle) throw new Error('ID-token fixture lease remains');
console.log('ID-token fixture has no armed mutations or retained transactions.');

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir = process.argv[2];
const root = resolve(import.meta.dirname, '..');
const names = ['catalog', 'customer', 'insights'];
const methods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);
const ignoredDocumentationFields = new Set(['description', 'summary', 'examples', 'example', 'externalDocs', 'tags']);

function read(path) {
  const raw = readFileSync(path, 'utf8');
  if (raw.length > 2_000_000) throw new Error(`${path}: OpenAPI bundle exceeds 2 MB`);
  const value = JSON.parse(raw);
  if (value?.openapi !== '3.1.0' || !value.paths || !value.components) throw new Error(`${path}: invalid OpenAPI 3.1 bundle`);
  return value;
}
function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !ignoredDocumentationFields.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalized(item)]));
  }
  return value;
}
function same(left, right) { return JSON.stringify(normalized(left)) === JSON.stringify(normalized(right)); }
function check(condition, message, failures) { if (!condition) failures.push(message); }

export function compare(base, next, service) {
  const failures = [];
  check(same(base.servers, next.servers), `${service}: server origins changed`, failures);
  for (const [name, oldScheme] of Object.entries(base.components?.securitySchemes ?? {})) {
    check(same(oldScheme, next.components?.securitySchemes?.[name]), `${service}: security scheme ${name} changed or removed`, failures);
  }
  for (const [name, oldSchema] of Object.entries(base.components?.schemas ?? {})) {
    check(same(oldSchema, next.components?.schemas?.[name]), `${service}: schema ${name} changed or removed`, failures);
  }
  for (const [path, oldPath] of Object.entries(base.paths)) {
    const newPath = next.paths?.[path];
    check(Boolean(newPath), `${service}: path ${path} removed`, failures);
    if (!newPath) continue;
    check(same(oldPath.parameters, newPath.parameters), `${service}: shared parameters changed at ${path}`, failures);
    for (const [method, oldOperation] of Object.entries(oldPath)) {
      if (!methods.has(method)) continue;
      const current = newPath[method];
      check(Boolean(current), `${service}: ${method.toUpperCase()} ${path} removed`, failures);
      if (!current) continue;
      for (const field of ['operationId', 'security', 'servers', 'parameters', 'requestBody', 'x-auth', 'x-visibility']) {
        check(same(oldOperation[field], current[field]), `${service}: ${method.toUpperCase()} ${path} ${field} changed`, failures);
      }
      for (const [status, oldResponse] of Object.entries(oldOperation.responses ?? {})) {
        check(same(oldResponse, current.responses?.[status]), `${service}: ${method.toUpperCase()} ${path} response ${status} changed or removed`, failures);
      }
    }
  }
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!baseDir || process.argv.length !== 3) throw new Error('Usage: node infra/check-openapi-breaking.mjs BASE_BUNDLED_DIRECTORY');
  const failures = [];
  for (const name of names) {
    const base = read(resolve(baseDir, `${name}.json`));
    const current = read(resolve(root, `contracts/bundled/${name}.json`));
    failures.push(...compare(base, current, name));
  }
  if (failures.length) throw new Error(`Potential breaking OpenAPI changes (${failures.length}):\n${failures.slice(0, 30).join('\n')}`);
  console.log('PASS: no removed or changed existing OpenAPI operations, schemas, security schemes or origins across three services');
}

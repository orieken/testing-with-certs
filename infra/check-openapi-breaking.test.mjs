import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compare } from './check-openapi-breaking.mjs';

const source = JSON.parse(readFileSync(new URL('../contracts/bundled/catalog.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(source);

test('unchanged contract and additive operation pass the base comparison', () => {
  assert.deepEqual(compare(source, clone(), 'catalog'), []);
  const additive = clone();
  additive.paths['/api/catalog/new-teaching-route'] = { get: structuredClone(source.paths['/api/catalog/items'].get) };
  assert.deepEqual(compare(source, additive, 'catalog'), []);
});

test('removed response, changed authentication, changed schema and origin are flagged', () => {
  const changed = clone();
  delete changed.paths['/api/catalog/items'].get.responses['401'];
  changed.paths['/api/catalog/items'].get.security = [];
  const schema = Object.keys(changed.components.schemas)[0];
  changed.components.schemas[schema].type = 'string';
  changed.servers[0].url = 'https://elsewhere.magic.test:8443';
  const failures = compare(source, changed, 'catalog').join('\n');
  assert.match(failures, /response 401/);
  assert.match(failures, /security changed/);
  assert.match(failures, /schema /);
  assert.match(failures, /server origins changed/);
});

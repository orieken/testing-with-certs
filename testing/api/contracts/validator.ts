import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import formatsModule from 'ajv-formats';
import type { APIResponse } from '@playwright/test';

export type Service = 'catalog' | 'customer' | 'insights';
type JsonSchema = Record<string, unknown>;
type Media = { schema: JsonSchema };
type ResponseDefinition = { content?: Record<string, Media>; headers?: Record<string, { required?: boolean; schema: JsonSchema }> };
type Operation = { operationId: string; requestBody?: { required?: boolean; content?: Record<string, Media> }; responses: Record<string, ResponseDefinition> };
type Bundle = { paths: Record<string, Record<string, Operation>>; components: { schemas: Record<string, JsonSchema> } };

const services: Service[] = ['catalog', 'customer', 'insights'];
const bundles = new Map<Service, Bundle>();
const compiled = new Map<string, ValidateFunction>();
const ajv = new Ajv2020({ strict: true, allErrors: true, coerceTypes: false, removeAdditional: false, useDefaults: false, validateFormats: true });
formatsModule.default(ajv);
ajv.addFormat('int64', { type: 'number', validate: Number.isSafeInteger });

function bundle(service: Service): Bundle {
  let result = bundles.get(service);
  if (result) return result;
  if (!services.includes(service)) throw new Error(`Unknown contract service ${service}`);
  const path = resolve(import.meta.dirname, '../../../contracts/bundled', `${service}.json`);
  result = JSON.parse(readFileSync(path, 'utf8')) as Bundle;
  if (!result.paths || !result.components?.schemas) throw new Error(`${service}: invalid expected bundle`);
  bundles.set(service, result);
  return result;
}

export function operationById(service: Service, operationId: string): Operation {
  const matches = Object.values(bundle(service).paths).flatMap((path) => Object.values(path)).filter((op) => op?.operationId === operationId);
  if (matches.length !== 1) throw new Error(`${service}: operationId ${operationId} matched ${matches.length} operations`);
  return matches[0];
}

function rewriteRefs(value: unknown, schemas: Record<string, JsonSchema>): unknown {
  if (Array.isArray(value)) return value.map((entry) => rewriteRefs(entry, schemas));
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === '$ref') {
      if (typeof entry !== 'string' || !entry.startsWith('#/components/schemas/')) throw new Error(`Unsupported schema reference ${String(entry)}`);
      const name = entry.slice('#/components/schemas/'.length);
      if (!Object.hasOwn(schemas, name)) throw new Error(`Unresolved schema reference ${name}`);
      out[key] = `#/$defs/${name}`;
    } else out[key] = rewriteRefs(entry, schemas);
  }
  return out;
}

function validator(service: Service, schema: JsonSchema): ValidateFunction {
  const doc = bundle(service);
  const key = `${service}:${JSON.stringify(schema)}`;
  const cached = compiled.get(key);
  if (cached) return cached;
  const defs = Object.fromEntries(Object.entries(doc.components.schemas).map(([name, definition]) => [name, rewriteRefs(definition, doc.components.schemas)]));
  const root: JsonSchema = { $schema: 'https://json-schema.org/draft/2020-12/schema', ...rewriteRefs(schema, doc.components.schemas) as JsonSchema, $defs: defs };
  const result = ajv.compile(root);
  compiled.set(key, result);
  return result;
}

function assertSchema(service: Service, schema: JsonSchema, value: unknown, label: string): void {
  const check = validator(service, schema);
  if (!check(value)) {
    const failures = (check.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? 'invalid'}`).join('; ');
    throw new Error(`${label} violates expected OpenAPI schema: ${failures}`);
  }
}

export function validateJsonRequest(service: Service, operationId: string, body: unknown): void {
  const request = operationById(service, operationId).requestBody;
  const schema = request?.content?.['application/json']?.schema;
  if (!schema) throw new Error(`${operationId}: no JSON request body in expected contract`);
  assertSchema(service, schema, body, `${operationId} request`);
}

export function validateHttpResponse(service: Service, operationId: string, expectedStatus: number, observed: { status: number; headers: Record<string, string>; rawBody: Uint8Array }): void {
  if (observed.status !== expectedStatus) throw new Error(`${operationId}: expected HTTP ${expectedStatus}, got ${observed.status}`);
  const definition = operationById(service, operationId).responses[String(expectedStatus)];
  if (!definition) throw new Error(`${operationId}: HTTP ${expectedStatus} is not documented`);
  const headers = Object.fromEntries(Object.entries(observed.headers).map(([name, value]) => [name.toLowerCase(), value]));
  for (const [name, header] of Object.entries(definition.headers ?? {})) {
    const value = headers[name.toLowerCase()];
    if (value === undefined) {
      if (header.required) throw new Error(`${operationId}: missing required ${name} response header`);
    } else assertSchema(service, header.schema, value, `${operationId} ${name} header`);
  }
  if (observed.rawBody.byteLength > 1_000_000) throw new Error(`${operationId}: response exceeds 1 MB contract-test limit`);
  const media = definition.content?.['application/json'];
  if (!media) {
    if (observed.rawBody.byteLength !== 0) throw new Error(`${operationId}: undocumented response body`);
    return;
  }
  const contentType = headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') throw new Error(`${operationId}: expected application/json, got ${contentType ?? 'no content type'}`);
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(observed.rawBody).toString('utf8')) as unknown; }
  catch { throw new Error(`${operationId}: invalid JSON response`); }
  assertSchema(service, media.schema, parsed, `${operationId} HTTP ${expectedStatus} response`);
}

export async function validatePlaywrightResponse(service: Service, operationId: string, expectedStatus: number, response: APIResponse): Promise<void> {
  const contentLength = Number(response.headers()['content-length'] ?? 0);
  if (contentLength > 1_000_000) throw new Error(`${operationId}: response exceeds 1 MB contract-test limit`);
  validateHttpResponse(service, operationId, expectedStatus, { status: response.status(), headers: response.headers(), rawBody: await response.body() });
}

import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { request, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { validatePlaywrightResponse, type Service } from './validator.js';

export interface ContractIdentity {
  origin: 'https://shop.magic.test:8443' | 'https://catalog-api:8443' | 'https://customer-api:8443';
  certificatePath: string;
  privateKeyPath: string;
  accessToken: string;
}

export function assertExpectedSpec(expected: Uint8Array, deployed: Uint8Array): void {
  const digest = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
  if (digest(expected) !== digest(deployed)) throw new Error('Deployed OpenAPI artifact differs from repository expectation');
}

// Trust is installed into the runner container's CA store by its entrypoint.
// Neither the host nor this fixture disables server-certificate verification.
export async function createContractContext(identity: ContractIdentity): Promise<APIRequestContext> {
  if (!identity.certificatePath.startsWith('/') || !identity.privateKeyPath.startsWith('/')) throw new Error('Contract certificate paths must be absolute container paths');
  if (!existsSync(identity.certificatePath) || !existsSync(identity.privateKeyPath)) throw new Error('Selected contract identity is not mounted');
  if (!identity.accessToken) throw new Error('Selected contract access token is missing');
  return request.newContext({
    baseURL: identity.origin,
    clientCertificates: [{ origin: identity.origin, certPath: identity.certificatePath, keyPath: identity.privateKeyPath }],
    extraHTTPHeaders: { Authorization: `Bearer ${identity.accessToken}` },
    ignoreHTTPSErrors: false,
    timeout: 10_000
  });
}

// The reporter records only passing tests. Call this after domain assertions;
// schema validation occurs before the coverage annotation is added.
export async function assertContractResponse(service: Service, operationId: string, expectedStatus: number, response: APIResponse): Promise<void> {
  await validatePlaywrightResponse(service, operationId, expectedStatus, response);
  test.info().annotations.push({ type: 'contract-status', description: `${service}:${operationId}:${expectedStatus}` });
}

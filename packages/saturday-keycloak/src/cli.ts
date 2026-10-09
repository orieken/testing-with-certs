#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { FileCertificateProvider, type IdentityFiles } from './files.js';
import { KeycloakAdminAdapter } from './keycloak.js';
import { PkiCommandAdapter } from './pki.js';
import { publicMetadata, type AuthenticationTarget, type BrowserChannel, type IdentityRef } from './core.js';
import { manualBrowserManifest } from './manual.js';

type Config = { root: string; identities: IdentityFiles; target: AuthenticationTarget; trustFiles: string[]; pki?: { executable: string; capabilityFile: string }; admin?: { issuer: string; operatorTokenFile: string; namespacePrefix: string } };
export async function runCli(argv: readonly string[]): Promise<string> {
  const [configPath, action, namespace, name, extra] = argv;
  if (!configPath?.startsWith('/') || !action || !namespace || !name) throw new Error('Usage: saturday-keycloak ABSOLUTE_CONFIG inspect|manifest|provision|renew|revoke|upsert|cleanup NAMESPACE NAME [ARG]');
  const source = await readFile(configPath, 'utf8');
  if (source.length > 1_048_576) throw new Error('Config too large');
  const config = JSON.parse(source) as Config;
  const ref: IdentityRef = { namespace, name };
  const provider = new FileCertificateProvider(config.root, config.identities);
  if (action === 'inspect') return JSON.stringify(publicMetadata(await provider.resolve(ref)));
  if (action === 'manifest') return JSON.stringify(manualBrowserManifest(extra as BrowserChannel, await provider.resolve(ref), config.target, config.trustFiles));
  if (action === 'provision' || action === 'renew' || action === 'revoke') {
    if (!config.pki) throw new Error('PKI operator capability not configured');
    await new PkiCommandAdapter(config.pki.executable, config.pki.capabilityFile).run(action, ref);
    return JSON.stringify({ action, namespace, name, status: 'ok' });
  }
  if (action === 'upsert') {
    if (!config.admin || !extra) throw new Error('Keycloak operator capability and certificate identity required');
    await new KeycloakAdminAdapter(config.admin).upsert(ref, extra);
    return JSON.stringify({ action, namespace, name, status: 'ok' });
  }
  if (action === 'cleanup') {
    if (!config.admin || name !== 'namespace') throw new Error('Explicit namespace cleanup capability required');
    const count = await new KeycloakAdminAdapter(config.admin).cleanupNamespace(namespace);
    return JSON.stringify({ action, namespace, deleted: count });
  }
  throw new Error('Unknown CLI action');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCli(process.argv.slice(2)).then(value => { process.stdout.write(`${value}\n`); }).catch(() => { process.stderr.write('Saturday Keycloak operation failed\n'); process.exitCode = 1; });
}

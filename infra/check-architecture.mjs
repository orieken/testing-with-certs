import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const chunks = [];
let bytes = 0;
for await (const chunk of process.stdin) {
  bytes += chunk.length;
  if (bytes > 2_000_000) throw new Error('Compose configuration exceeds 2 MB');
  chunks.push(chunk);
}
const config = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const services = config.services ?? {};
const expected = ['pki', 'postgres', 'keycloak', 'gateway', 'ui', 'catalog-api', 'customer-api', 'insights-api', 'runner-test', 'runner-contracts', 'runner-security', 'runner-manual'];
for (const name of expected) if (!services[name]) throw new Error(`Missing service: ${name}`);
const sources = (name) => (services[name].volumes ?? []).map((entry) => entry.source);
const requireMounts = (name, mounts) => {
  for (const mount of mounts) if (!sources(name).includes(mount)) throw new Error(`${name} lacks ${mount}`);
};
for (const [name, mounts] of Object.entries({
  'catalog-api': ['cert-catalog-api', 'db-secret-catalog', 'public-trust'],
  'customer-api': ['cert-customer-api', 'cert-customer-client', 'db-secret-customer', 'auth-secret-catalog', 'public-trust'],
  'insights-api': ['cert-insights-api', 'cert-insights-client', 'db-secret-insights', 'auth-secret-reporting', 'public-trust'],
  gateway: ['cert-shop', 'cert-gateway-client', 'public-trust'],
  'runner-test': ['selected-user', 'public-trust'],
  'runner-manual': ['selected-user', 'public-trust']
})) requireMounts(name, mounts);
for (const [name, service] of Object.entries(services)) {
  if (name !== 'pki' && sources(name).includes('ca-state')) throw new Error(`${name} mounts CA signing state`);
  if (service.privileged) throw new Error(`${name} is privileged`);
  if ((service.volumes ?? []).some((entry) => String(entry.source).includes('docker.sock'))) throw new Error(`${name} mounts Docker socket`);
  const ports = service.ports ?? [];
  if (name !== 'runner-manual' && ports.length) throw new Error(`${name} publishes a host port`);
  if (name === 'runner-manual' && (ports.length !== 1 || ports[0].host_ip !== '127.0.0.1' || ports[0].target !== 6080)) throw new Error('Manual viewer must publish only loopback 6080');
  if (name.startsWith('runner-') && service.platform !== 'linux/amd64') throw new Error(`${name} is not pinned to amd64`);
}
if (services.pki.network_mode !== 'none') throw new Error('PKI must have no network');
for (const name of ['backend', 'auth', 'database']) if (config.networks?.[name]?.internal !== true) throw new Error(`${name} network is not private`);
const hasNetwork = (service, network) => Object.hasOwn(services[service].networks ?? {}, network);
if (['runner-test', 'runner-manual'].some((name) => hasNetwork(name, 'backend') || hasNetwork(name, 'database'))) throw new Error('Browser runner bypasses gateway network');
for (const name of ['catalog-api', 'customer-api', 'insights-api']) {
  if (!hasNetwork(name, 'backend') || !hasNetwork(name, 'database')) throw new Error(`${name} lacks private backend/database networks`);
  if (hasNetwork(name, 'front')) throw new Error(`${name} is directly on browser front network`);
}

const root = resolve(import.meta.dirname, '..');
const wrapper = readFileSync(resolve(root, 'lab'), 'utf8');
if (/(?:^|\n)\s*(?:openssl|security|certutil|update-ca-certificates|node|python|go)\b/m.test(wrapper)) throw new Error('Host wrapper invokes a language or certificate tool');
const operatorBuild = readFileSync(resolve(root, 'operator/build.sh'), 'utf8');
if (!operatorBuild.includes('docker run --rm') || !/golang:1\.26\.0-bookworm@sha256:[a-f0-9]{64}/.test(operatorBuild)) throw new Error('Operator builder must use a pinned Go container');
if (/(?:^|\n)\s*(?:openssl|security|certutil|update-ca-certificates)\b/m.test(operatorBuild)) throw new Error('Operator builder invokes a host certificate tool');
const forbidden = /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*0|ignoreHTTPSErrors\s*:\s*true|--ignore-certificate-errors|--allow-insecure-localhost|rejectUnauthorized\s*:\s*false|verify\s*=\s*False/;
const textExtensions = /\.(?:ts|tsx|js|mjs|py|go|sh|yaml|yml)$/;
let inspected = 0;
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'artifacts', 'vendor'].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) inspect(path);
    else if (entry.isFile() && textExtensions.test(entry.name)) {
      if (path === fileURLToPath(import.meta.url)) continue;
      const size = statSync(path).size;
      if (size > 1_000_000) throw new Error(`Source file too large for architecture scan: ${path}`);
      if (forbidden.test(readFileSync(path, 'utf8'))) throw new Error(`TLS bypass in ${path}`);
      inspected++;
    }
  }
}
for (const directory of ['apps', 'services', 'testing', 'infra', 'packages', 'operator']) inspect(resolve(root, directory));
console.log(`PASS: three API ownership/mounts, isolated CA, private networks, loopback viewer, real-browser platform and no TLS bypass in ${inspected} source files`);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:https';
import { once } from 'node:events';
import { probe, certificateThumbprint, assertCertificateBinding } from './mtls.mjs';

test('verified mTLS probes distinguish HTTP, TLS denial and unavailable endpoint', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oidc-mtls-'));
  let server;
  const openssl = args => execFileSync('openssl', args, { cwd: dir, stdio: 'ignore' });
  const pem = name => readFileSync(join(dir, name));
  try {
    openssl(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '1', '-subj', '/CN=Disposable test CA']);
    for (const name of ['server', 'client']) {
      openssl(['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${name}.key`, '-out', `${name}.csr`, '-subj', `/CN=${name === 'server' ? 'localhost' : 'test-client'}`]);
      openssl(['x509', '-req', '-in', `${name}.csr`, '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', `${name}.pem`, '-days', '1']);
    }
    server = createServer({ key: pem('server.key'), cert: pem('server.pem'), ca: pem('ca.pem'), requestCert: true, rejectUnauthorized: true }, (_req, res) => { res.writeHead(204); res.end(); });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const options = { url: `https://localhost:${server.address().port}/ready`, ca: pem('ca.pem'), cert: pem('client.pem'), key: pem('client.key') };
    // Resolve localhost deterministically without relying on host IPv6 settings.
    options.url = `https://127.0.0.1:${server.address().port}/ready`;
    options.servername = 'localhost';
    assert.deepEqual(await probe(options), { kind: 'http', status: 204 });
    assert.deepEqual(await probe({ ...options, cert: undefined, key: undefined }), { kind: 'tls-error' });
    assert.deepEqual(await probe({ ...options, ca: pem('client.pem') }), { kind: 'tls-error' });
    assert.deepEqual(await probe({ ...options, servername: 'wrong.invalid' }), { kind: 'tls-error' });
    const thumbprint = certificateThumbprint(pem('client.pem'));
    const expected = execFileSync('openssl', ['x509', '-in', join(dir, 'client.pem'), '-outform', 'DER']);
    const { createHash } = await import('node:crypto');
    assert.equal(thumbprint, createHash('sha256').update(expected).digest('base64url'));
    assertCertificateBinding({ cnf: { 'x5t#S256': thumbprint } }, pem('client.pem'));
    assert.throws(() => assertCertificateBinding({ cnf: { 'x5t#S256': thumbprint } }, pem('server.pem')));
    assert.throws(() => assertCertificateBinding({}, pem('client.pem')));
    assert.deepEqual(await probe(options), { kind: 'http', status: 204 });
    await new Promise(resolve => server.close(resolve));
    assert.deepEqual(await probe(options), { kind: 'network-error' });
    assert.throws(() => probe({ ...options, url: `${options.url}?token=secret` }));
    assert.throws(() => probe({ ...options, key: undefined }));
  } finally {
    server?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

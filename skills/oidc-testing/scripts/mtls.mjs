import { request } from 'node:https';
import { createHash, X509Certificate } from 'node:crypto';

// Inspection only: the caller must independently verify JWT signature and claims.
export function certificateThumbprint(pem) {
  return createHash('sha256').update(new X509Certificate(pem).raw).digest('base64url');
}

export function assertCertificateBinding(verifiedClaims, pem) {
  if (verifiedClaims?.cnf?.['x5t#S256'] !== certificateThumbprint(pem)) {
    throw new Error('Certificate thumbprint binding mismatch');
  }
}

// Never redirects, pools connections, captures bodies, or returns raw error text.
// A network failure is not evidence that a certificate policy rejected a request.
export function probe({ url, ca, cert, key, servername, timeout = 5000 }) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash) {
    throw new Error('Use an HTTPS probe URL without credentials, query or fragment');
  }
  if (!ca || Boolean(cert) !== Boolean(key)) throw new Error('CA and a complete optional certificate/key pair required');
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 60000) throw new Error('Invalid probe timeout');
  return new Promise(resolve => {
    const req = request(target, { ca, cert, key, servername, rejectUnauthorized: true,
      agent: false, signal: AbortSignal.timeout(timeout) }, response => {
      response.resume();
      response.on('end', () => resolve({ kind: 'http', status: response.statusCode }));
      response.on('error', () => resolve({ kind: 'network-error' }));
    });
    req.on('error', error => {
      const code = String(error.code ?? '');
      const kind = /^(ERR_TLS_|ERR_SSL_|CERT_)|^(DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN|UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT_LOCALLY)$/.test(code)
        ? 'tls-error' : 'network-error';
      resolve({ kind });
    });
    req.end();
  });
}

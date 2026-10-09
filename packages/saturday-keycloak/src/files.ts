import { createPrivateKey, createPublicKey, X509Certificate } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { identityKey, type CertificateMaterial, type CertificatePaths, type CertificateProvider, type IdentityRef } from './core.js';

export type IdentityFiles = Readonly<Record<string, CertificatePaths>>;
export class FileCertificateProvider implements CertificateProvider {
  constructor(private readonly root: string, private readonly identities: IdentityFiles, private readonly now: () => number = Date.now) {
    if (!isAbsolute(root)) throw new Error('Certificate root must be absolute');
  }
  private async withinRoot(path: string): Promise<string> {
    if (isAbsolute(path) || path.split(/[\\/]/).includes('..') || path.includes('\0')) throw new Error('Unsafe certificate path');
    const root = await realpath(this.root);
    const absolute = await realpath(resolve(root, path));
    const rel = relative(root, absolute);
    if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('Certificate path escapes root');
    const file = await stat(absolute);
    if (!file.isFile() || file.size < 1 || file.size > 1_048_576) throw new Error('Certificate file invalid or too large');
    return absolute;
  }
  async resolve(ref: IdentityRef): Promise<CertificateMaterial> {
    const paths = this.identities[identityKey(ref)];
    if (!paths) throw new Error('Unknown identity');
    const cert = await this.withinRoot(paths.cert);
    const key = await this.withinRoot(paths.key);
    const pfx = paths.pfx ? await this.withinRoot(paths.pfx) : undefined;
    const passphrase = paths.passphrase ? await this.withinRoot(paths.passphrase) : undefined;
    let parsed: X509Certificate;
    try {
      parsed = new X509Certificate(await readFile(cert));
      const privateKey = createPrivateKey(await readFile(key));
      const publicKey = createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
      const certKey = parsed.publicKey.export({ format: 'der', type: 'spki' });
      if (!publicKey.equals(certKey)) throw new Error('Certificate and key do not match');
    } catch { throw new Error('Certificate and key do not match or cannot be parsed'); }
    const now = this.now();
    const from = Date.parse(parsed.validFrom), until = Date.parse(parsed.validTo);
    if (!Number.isFinite(from) || !Number.isFinite(until) || from > now || until <= now) throw new Error('Certificate is outside validity window');
    return { ref, cert, key, ...(pfx ? { pfx } : {}), ...(passphrase ? { passphrase } : {}), serial: parsed.serialNumber, fingerprint256: parsed.fingerprint256, subject: parsed.subject, issuer: parsed.issuer, expiresAt: new Date(until).toISOString() };
  }
}

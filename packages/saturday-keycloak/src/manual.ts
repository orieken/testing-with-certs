import { validateTarget, type AuthenticationTarget, type BrowserChannel, type CertificateMaterial } from './core.js';

export type ManualBrowserManifest = Readonly<{
  browser: BrowserChannel;
  origins: readonly string[];
  certPath: string;
  keyPath: string;
  pfxPath: string;
  passphraseFile: string;
  trustFiles: readonly string[];
  policy: { AutoSelectCertificateForUrls: readonly string[]; BrowserSignin: 0 };
}>;
export function manualBrowserManifest(browser: BrowserChannel, material: CertificateMaterial, target: AuthenticationTarget, trustFiles: readonly string[]): ManualBrowserManifest {
  validateTarget(target);
  if (browser !== 'chrome' && browser !== 'msedge') throw new Error('Real Chrome or Edge required');
  if (!material.pfx || !material.passphrase) throw new Error('Native certificate bundle and passphrase file required');
  if (!trustFiles.length || trustFiles.some(path => !path.startsWith('/'))) throw new Error('Container trust paths required');
  const cn = material.subject.match(/(?:^|\n)CN=([^\n]+)/)?.[1];
  const issuerCn = material.issuer.match(/(?:^|\n)CN=([^\n]+)/)?.[1];
  if (!cn || !issuerCn) throw new Error('Certificate subject and issuer CN required');
  return {
    browser, origins: [...target.origins], certPath: material.cert, keyPath: material.key,
    pfxPath: material.pfx, passphraseFile: material.passphrase, trustFiles: [...trustFiles],
    policy: { AutoSelectCertificateForUrls: target.origins.map(pattern => JSON.stringify({ pattern, filter: { ISSUER: { CN: issuerCn }, SUBJECT: { CN: cn } } })), BrowserSignin: 0 }
  };
}

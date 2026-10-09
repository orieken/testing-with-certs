export type IdentityRef = Readonly<{ namespace: string; name: string }>;
export type BrowserChannel = 'chrome' | 'msedge';
export type AuthenticationTarget = Readonly<{ origins: readonly string[]; issuer: string }>;
export type CertificatePaths = Readonly<{ cert: string; key: string; pfx?: string; passphrase?: string }>;
export type CertificateMaterial = Readonly<CertificatePaths & {
  ref: IdentityRef; serial: string; fingerprint256: string; subject: string; issuer: string; expiresAt: string;
}>;
export interface CertificateProvider { resolve(ref: IdentityRef): Promise<CertificateMaterial>; }

const slug = /^[a-z][a-z0-9-]{0,62}$/;
export function validateRef(ref: IdentityRef): IdentityRef {
  if (!slug.test(ref.namespace) || !slug.test(ref.name)) throw new Error('Invalid identity reference');
  return ref;
}
export function identityKey(ref: IdentityRef): string { validateRef(ref); return `${ref.namespace}/${ref.name}`; }
export function exactOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.origin !== value) {
    throw new Error('Expected an exact HTTPS origin');
  }
  return value;
}
export function validateTarget(target: AuthenticationTarget): AuthenticationTarget {
  if (!Array.isArray(target.origins) || target.origins.length < 1 || target.origins.length > 8) throw new Error('Expected 1–8 certificate origins');
  for (const origin of target.origins) exactOrigin(origin);
  if (new Set(target.origins).size !== target.origins.length) throw new Error('Duplicate certificate origin');
  if (!target.issuer.startsWith('https://')) throw new Error('HTTPS issuer required');
  const issuer = new URL(target.issuer);
  if (issuer.username || issuer.password || issuer.search || issuer.hash || !issuer.pathname.startsWith('/realms/')) throw new Error('Invalid Keycloak issuer');
  return target;
}
export function publicMetadata(material: CertificateMaterial): Readonly<Record<string, string>> {
  return { namespace: material.ref.namespace, name: material.ref.name, serial: material.serial, fingerprint256: material.fingerprint256, expiresAt: material.expiresAt };
}

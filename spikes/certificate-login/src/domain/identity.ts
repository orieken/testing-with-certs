export interface VerifiedUser { readonly certIdentity: string; readonly subject: string; readonly roles: readonly string[] }
export function authorizeIdentity(certificateIdentity: string | undefined, user: VerifiedUser) {
  if (!certificateIdentity || certificateIdentity !== user.certIdentity) throw new Error('identity_mismatch');
  return {subject: user.subject, roles: user.roles};
}

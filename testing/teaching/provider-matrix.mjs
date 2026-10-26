import { upstreamSessionCases } from './oidc-session-cases.mjs';
import { refreshCaseNames } from './oidc-refresh-cases.mjs';
import { upstreamIdTokenCases, jwksCaseNames } from '../../infra/oidc-token-fixture/cases.mjs';
import { oidcRecoveryKinds } from './oidc-recovery-cases.mjs';

export const authentikChecks=['login-group','no-group','wrong-password','disabled-user','callback-state','logout-isolation'];
export const authentikBaselineCaseNames=['oidc','saml'].flatMap(method=>authentikChecks.map(check=>`authentik-${method}:${check}`)).concat(...upstreamSessionCases.map(kind=>`authentik-oidc:${kind}`),...refreshCaseNames.map(kind=>`authentik-oidc:${kind}`),...jwksCaseNames.map(kind=>`authentik-oidc:${kind}`),...upstreamIdTokenCases.map(kind=>`authentik-oidc:${kind}`),...oidcRecoveryKinds.map(kind=>`authentik-oidc:${kind}`),'authentik-saml:invalid-signature','authentik-oidc:broker-state',
 ...['app','upstream'].flatMap(leg=>['wrong-verifier','missing-verifier','replay','redirect'].map(kind=>`authentik-oidc:${leg}-${kind}`)));

export const authentikLifecycleChecks=['access-expiry-clears-identity','refresh-preserves-identity','logout-invalidates-refresh','refresh-client-binding','session-expiry-rejects-refresh','group-withdrawal'];
export const authentikLifecycleCaseNames=['oidc','saml'].flatMap(method=>authentikLifecycleChecks.map(check=>`authentik-${method}:${check}`));
export const authentikCaseNames=[...authentikBaselineCaseNames,...authentikLifecycleCaseNames];
export const authentikPhase=name=>authentikLifecycleCaseNames.includes(name)?'lifecycle':'baseline';

export const authentikChecks=['login-group','no-group','wrong-password','disabled-user','callback-state','logout-isolation'];
export const authentikBaselineCaseNames=['oidc','saml'].flatMap(method=>authentikChecks.map(check=>`authentik-${method}:${check}`)).concat('authentik-saml:invalid-signature','authentik-oidc:broker-state');

export const authentikLifecycleChecks=['access-expiry-clears-identity','refresh-preserves-identity','logout-invalidates-refresh','refresh-client-binding','session-expiry-rejects-refresh','group-withdrawal'];
export const authentikLifecycleCaseNames=['oidc','saml'].flatMap(method=>authentikLifecycleChecks.map(check=>`authentik-${method}:${check}`));
export const authentikCaseNames=[...authentikBaselineCaseNames,...authentikLifecycleCaseNames];
export const authentikPhase=name=>authentikLifecycleCaseNames.includes(name)?'lifecycle':'baseline';

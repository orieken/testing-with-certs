export const authentikChecks=['login-group','no-group','wrong-password','disabled-user','callback-state','logout-isolation'];
export const authentikCaseNames=['oidc','saml'].flatMap(method=>authentikChecks.map(check=>`authentik-${method}:${check}`)).concat('authentik-saml:invalid-signature','authentik-oidc:broker-state');

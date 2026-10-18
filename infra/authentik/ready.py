from authentik.flows.models import Flow
from authentik.crypto.models import CertificateKeyPair
from authentik.providers.oauth2.models import ScopeMapping
from authentik.providers.saml.models import SAMLPropertyMapping
assert Flow.objects.filter(slug__in=['default-authentication-flow','default-provider-authorization-implicit-consent','default-provider-invalidation-flow']).count() == 3
assert CertificateKeyPair.objects.filter(name='authentik Self-signed Certificate').exists()
assert ScopeMapping.objects.filter(managed__in=['goauthentik.io/providers/oauth2/scope-openid','goauthentik.io/providers/oauth2/scope-profile','goauthentik.io/providers/oauth2/scope-email']).count() == 3
assert SAMLPropertyMapping.objects.filter(managed='goauthentik.io/providers/saml/username').exists()
print('Required authentik flow, mapping and signing blueprints verified.')

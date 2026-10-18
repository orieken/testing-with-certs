"""Disposable provider fixture. Never print secrets, user records, or assertions."""
import json
import os
import secrets
from pathlib import Path
from authentik.core.models import Application, Group, User
from authentik.flows.models import Flow
from authentik.crypto.models import CertificateKeyPair
from authentik.providers.oauth2.models import OAuth2Provider, ScopeMapping
from authentik.providers.saml.models import SAMLProvider, SAMLPropertyMapping

origin = 'https://shop.magic.test:9743'
broker = 'https://shop.magic.test:9643'
authentication = Flow.objects.get(slug='default-authentication-flow')
authorization = Flow.objects.get(slug='default-provider-authorization-implicit-consent')
invalidation = Flow.objects.get(slug='default-provider-invalidation-flow')
key = CertificateKeyPair.objects.filter(name='authentik Self-signed Certificate').first()
if key is None:
    raise RuntimeError('Default signing certificate not ready')
state = Path('/ak-fixture/users.json')
if state.exists():
    raise RuntimeError('Refusing to replace an existing owned fixture')
member, _ = Group.objects.get_or_create(name='lesson-member')
users = []
for method in ['oidc', 'saml']:
    for kind in ['member', 'no-group', 'disabled']:
        username = f'ak-{method}-{kind}'
        if User.objects.filter(username=username).exists():
            raise RuntimeError('Refusing to adopt a pre-existing account')
        password = secrets.token_urlsafe(32)
        user = User.objects.create(username=username, name='Lesson user', email=f'{username}@example.test', is_active=kind != 'disabled')
        user.set_password(password)
        user.save()
        if kind == 'member':
            user.ak_groups.add(member)
        users.append(dict(username=username, password=password, method=method, kind=kind))
admin = User.objects.filter(username='akadmin').first()
if admin:
    admin.set_password(secrets.token_urlsafe(48))
    admin.is_active = False
    admin.save()
common = dict(authentication_flow=authentication, authorization_flow=authorization, invalidation_flow=invalidation)
scope, _ = ScopeMapping.objects.get_or_create(name='Lesson groups', defaults=dict(scope_name='lesson', expression='return {"lesson_groups": [group.name for group in request.user.ak_groups.all()]}'))
oidc, _ = OAuth2Provider.objects.get_or_create(name='Lesson OIDC', defaults=dict(**common, client_id='authentik-oidc-broker', client_secret=Path('/ak-secrets/broker-secret').read_text().strip(), client_type='confidential', grant_types=['authorization_code','refresh_token'], signing_key=key, issuer_mode='per_provider', include_claims_in_id_token=True))
oidc._redirect_uris = [dict(matching_mode='strict', url=f'{broker}/realms/lesson-authentik-oidc/broker/authentik-oidc/endpoint'), dict(matching_mode='strict',url=f'{broker}/realms/lesson-authentik-oidc/broker/authentik-oidc/endpoint/logout_response',redirect_uri_type='logout')]
oidc.save()
oidc.property_mappings.set(list(ScopeMapping.objects.filter(managed__in=['goauthentik.io/providers/oauth2/scope-openid','goauthentik.io/providers/oauth2/scope-profile','goauthentik.io/providers/oauth2/scope-email']))+[scope])
Application.objects.get_or_create(slug='lesson-oidc', defaults=dict(name='Lesson OIDC',provider=oidc,policy_engine_mode='all'))
saml_group, _ = SAMLPropertyMapping.objects.get_or_create(name='Lesson SAML groups', defaults=dict(saml_name='lesson_groups', expression='return [group.name for group in request.user.ak_groups.all()]'))
username = SAMLPropertyMapping.objects.get(managed='goauthentik.io/providers/saml/username')
saml, _ = SAMLProvider.objects.get_or_create(name='Lesson SAML', defaults=dict(**common, acs_url=f'{broker}/realms/lesson-authentik-saml/broker/authentik-saml/endpoint', audience=f'{broker}/realms/lesson-authentik-saml', issuer_override=f'{origin}/application/saml/lesson-saml/metadata/', sp_binding='post', sls_url=f'{broker}/realms/lesson-authentik-saml/broker/authentik-saml/endpoint', signing_kp=key,name_id_mapping=username,sign_assertion=True,sign_response=True,logout_method='frontchannel_native',sls_binding='post',sign_logout_response=True,sign_logout_request=True))
saml.property_mappings.set([saml_group,username])
Application.objects.get_or_create(slug='lesson-saml', defaults=dict(name='Lesson SAML',provider=saml,policy_engine_mode='all'))
state.write_text(json.dumps(users))
os.chmod(state,0o600)
Path('/ak-fixture/public.json').write_text(json.dumps(dict(certificate=key.certificate_data)))
print('Owned authentik users, strict OIDC redirects, signed SAML and group mappings ready; values withheld.')

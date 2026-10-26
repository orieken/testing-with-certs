"""Revoke sessions only for two dedicated disposable OIDC test identities."""
import json
from pathlib import Path
from authentik.core.models import AuthenticatedSession, User
from authentik.providers.oauth2.models import OAuth2Provider

allowed = ['upstream-session-revoked', 'upstream-revocation-broker-boundary']

def revoke(kind):
    if kind not in allowed:
        raise RuntimeError('Unowned session fixture')
    username = f'ak-oidc-{kind}'
    owned = [value for value in json.loads(Path('/ak-fixture/users.json').read_text())
             if value['method'] == 'oidc' and value['kind'] == kind and value['username'] == username]
    if len(owned) != 1:
        raise RuntimeError('Owned session account missing or ambiguous')
    user = User.objects.get(username=username)
    if OAuth2Provider.objects.get(client_id='authentik-oidc-broker').logout_uri:
        raise RuntimeError('Unexpected upstream logout notification')
    sessions = AuthenticatedSession.objects.filter(user=user)
    before = sessions.count()
    if before == 0:
        raise RuntimeError('No owned provider session to revoke')
    # Native pre/post-delete signals revoke access grants and delete the Django
    # browser session; refresh tokens keep their native SET_DEFAULT semantics.
    for session in sessions:
        session.delete()
    if AuthenticatedSession.objects.filter(user=user).exists():
        raise RuntimeError('Owned provider sessions remain')
    return dict(revoked=True, sessionsBefore=before, sessionsAfter=0, logoutNotificationConfigured=False)

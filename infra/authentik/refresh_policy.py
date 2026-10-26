"""Owner-scoped always-rotate policy for only the disposable OAuth2 provider."""
import json
import os
from pathlib import Path
from uuid import UUID
from authentik.providers.oauth2.models import OAuth2Provider
from authentik.events.models import Event, EventAction
state_path = Path('/ak-fixture/refresh-policy.json')

def target():
    return OAuth2Provider.objects.get(client_id='authentik-oidc-broker')

def verify_idle():
    if state_path.exists():
        raise RuntimeError('Refresh policy journal remains')
    return dict(idle=True, restored=True)

def action(kind, owner):
    UUID(owner)
    provider = target()
    state = json.loads(state_path.read_text()) if state_path.exists() else None
    if kind == 'start':
        verify_idle()
        value = dict(owner=owner, provider=provider.pk, original=provider.refresh_token_threshold)
        temporary = state_path.with_suffix('.next')
        temporary.write_text(json.dumps(value))
        os.chmod(temporary, 0o600)
        temporary.replace(state_path)
        provider.refresh_token_threshold = 'seconds=0'
        provider.save(update_fields=['refresh_token_threshold'])
    elif not state or state['owner'] != owner or state['provider'] != provider.pk:
        raise RuntimeError('Refresh policy ownership mismatch')
    elif kind == 'restore':
        if provider.refresh_token_threshold not in ['seconds=0', state['original']]:
            raise RuntimeError('Refresh policy drift')
        provider.refresh_token_threshold = state['original']
        provider.save(update_fields=['refresh_token_threshold'])
        if target().refresh_token_threshold != state['original']:
            raise RuntimeError('Refresh policy restoration failed')
        state_path.unlink()
        return verify_idle()
    elif kind != 'status':
        raise RuntimeError('Unknown refresh policy action')
    if target().refresh_token_threshold != 'seconds=0':
        raise RuntimeError('Always-rotate policy not applied')
    events = Event.objects.filter(action=EventAction.SUSPICIOUS_REQUEST, context__message='Revoked refresh token was used').count()
    return dict(idle=False, rotation=True, reuseEvents=events)

def restore_owned():
    if state_path.exists():
        state = json.loads(state_path.read_text())
        action('restore', state['owner'])
    return verify_idle()

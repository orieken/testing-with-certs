"""Owner-scoped native signing-key rotation for the disposable OAuth2 provider."""
import json
import os
from pathlib import Path
from uuid import UUID
from authentik.crypto.builder import CertificateBuilder
from authentik.crypto.models import CertificateKeyPair
from authentik.providers.oauth2.models import OAuth2Provider

state_path = Path('/ak-fixture/oidc-key-state.json')
baseline_path = Path('/ak-fixture/oidc-key-baseline.json')
prefix = 'oidc-native-rotation-'

def save(value):
    temporary = state_path.with_suffix('.next')
    temporary.write_text(json.dumps(value))
    os.chmod(temporary, 0o600)
    temporary.replace(state_path)

def provider():
    return OAuth2Provider.objects.select_related('signing_key').get(client_id='authentik-oidc-broker')

def verify_idle():
    original = json.loads(baseline_path.read_text())['key']
    if state_path.exists() or str(provider().signing_key_id) != original or CertificateKeyPair.objects.filter(name__startswith=prefix).exists():
        raise RuntimeError('Owned authentik signing-key state remains')
    return dict(idle=True, restored=True)

def action(kind, owner):
    UUID(owner)
    target = provider()
    state = json.loads(state_path.read_text()) if state_path.exists() else None
    original = json.loads(baseline_path.read_text())['key']
    if kind == 'start':
        verify_idle()
        state = dict(owner=owner, original=original, created=owner, name=prefix + owner)
        save(state)
    elif not state or state['owner'] != owner:
        raise RuntimeError('Native key owner mismatch')
    if kind == 'rotate':
        if CertificateKeyPair.objects.filter(pk=owner).exists():
            raise RuntimeError('Owned key already rotated')
        builder = CertificateBuilder(state['name'])
        builder.cert.pk = UUID(owner)
        builder.build(validity_days=2)
        key = builder.save()
        target.signing_key = key
        target.save(update_fields=['signing_key'])
    if kind == 'restore':
        if str(target.signing_key_id) not in [state['original'], state['created']]:
            raise RuntimeError('Signing-key ownership drift')
        target.signing_key_id = state['original']
        target.save(update_fields=['signing_key'])
        key = CertificateKeyPair.objects.filter(pk=state['created']).first()
        if key:
            if key.name != state['name']:
                raise RuntimeError('Owned certificate identity drift')
            key.delete()
        state_path.unlink()
        return verify_idle()
    if kind not in ['start', 'rotate', 'status']:
        raise RuntimeError('Unknown native-key action')
    rotated = str(provider().signing_key_id) != original
    if kind == 'rotate' and not rotated:
        raise RuntimeError('Native signing key did not rotate')
    return dict(idle=False, rotated=rotated, originalPublished=not rotated, activePublished=True)

def restore_owned():
    if state_path.exists():
        state = json.loads(state_path.read_text())
        action('restore', state['owner'])
    return verify_idle()

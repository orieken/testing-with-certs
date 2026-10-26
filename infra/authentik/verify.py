"""Verify owned mutable lifecycle fixtures were restored before crediting a run."""
import json
from pathlib import Path
from authentik.core.models import User
from authentik.providers.oauth2.models import OAuth2Provider
credential = Path('/ak-fixture/oidc-client-secret')
assert credential.stat().st_mode & 0o777 == 0o600
assert credential.read_text() == OAuth2Provider.objects.get(client_id='authentik-oidc-broker').client_secret
users = [u for u in json.loads(Path('/ak-fixture/users.json').read_text()) if u['kind'] == 'group-withdrawal']
assert len(users) == 2
for user in users:
    assert User.objects.get(username=user['username']).ak_groups.filter(name='lesson-member').exists()

import sys
sys.path.insert(0, '/fixtures')
from oidc_keys import verify_idle
verify_idle()

from refresh_policy import verify_idle as verify_refresh
verify_refresh()

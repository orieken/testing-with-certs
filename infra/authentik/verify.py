"""Verify owned mutable lifecycle fixtures were restored before crediting a run."""
import json
from pathlib import Path
from authentik.core.models import User
users = [u for u in json.loads(Path('/ak-fixture/users.json').read_text()) if u['kind'] == 'group-withdrawal']
assert len(users) == 2
for user in users:
    assert User.objects.get(username=user['username']).ak_groups.filter(name='lesson-member').exists()

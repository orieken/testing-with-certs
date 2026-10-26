"""Restore only journaled signing-key fixture mutations before teardown."""
import sys
sys.path.insert(0, '/fixtures')
from oidc_keys import restore_owned
restore_owned()
print('Native authentik signing key restored; owned rotation keys absent.')

from refresh_policy import restore_owned as restore_refresh
restore_refresh()
print('Owned authentik refresh policy restored; journal absent.')

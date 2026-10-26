"""Private fixture control: only two owned group-withdrawal accounts, no admin API."""
import hmac
import json
import sys
sys.path.insert(0, '/fixtures')
from oidc_keys import action as key_action
from refresh_policy import action as refresh_action
from session_revocation import revoke as revoke_sessions
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from django.db import close_old_connections
from authentik.core.models import Group, User

secret = Path('/ak-fixture/control-secret').read_text()
owned = {u['method']: u['username'] for u in json.loads(Path('/ak-fixture/users.json').read_text()) if u['kind'] == 'group-withdrawal'}
if set(owned) != {'oidc', 'saml'}:
    raise RuntimeError('Owned lifecycle accounts missing')

class Control(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, value):
        data = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self.reply(200 if self.path == '/health' else 404, {'ready': self.path == '/health'})

    def do_POST(self):
        parts = self.path.split('/')
        if not hmac.compare_digest(self.headers.get('Authorization', ''), f'Bearer {secret}'):
            return self.reply(403, {'ok': False})
        if len(parts) == 3 and parts[1] == 'oidc-sessions':
            close_old_connections()
            try:
                return self.reply(200, revoke_sessions(parts[2]))
            except Exception:
                return self.reply(409, {'error': 'owned_session_revocation_failed'})
            finally:
                close_old_connections()
        if len(parts) == 3 and parts[1] in ['oidc-keys', 'oidc-refresh']:
            close_old_connections()
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if length < 1 or length > 4096 or parts[2] not in ['start', 'rotate', 'status', 'restore']:
                    return self.reply(400, {'ok': False})
                data = json.loads(self.rfile.read(length))
                operation = key_action if parts[1] == 'oidc-keys' else refresh_action
                return self.reply(200, operation(parts[2], data['owner']))
            except Exception:
                return self.reply(409, {'error': 'owned_native_key_action_failed'})
            finally:
                close_old_connections()
        if len(parts) != 3 or parts[1] not in owned or parts[2] not in ['withdraw', 'restore']:
            return self.reply(404, {'ok': False})
        close_old_connections()
        try:
            user = User.objects.get(username=owned[parts[1]])
            group = Group.objects.get(name='lesson-member')
            if parts[2] == 'withdraw':
                user.ak_groups.remove(group)
            else:
                user.ak_groups.add(group)
            present = user.ak_groups.filter(pk=group.pk).exists()
            self.reply(200, {'ok': True, 'member': present})
        except Exception:
            self.reply(500, {'ok': False})
        finally:
            close_old_connections()

HTTPServer(('0.0.0.0', 9100), Control).serve_forever()

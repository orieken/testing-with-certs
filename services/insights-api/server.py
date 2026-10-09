from __future__ import annotations

import hashlib
import http.client
import json
import re
import ssl
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlencode, urlsplit

import jwt
import psycopg
from psycopg.rows import dict_row

from domain import REGION_IDS, MAX_RECORDS, completed, customers, orders, sales, utc

ISSUER = 'https://auth.magic.test:9443/realms/magic-shop'
SUB = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
ID = re.compile(r'^[a-z0-9][a-z0-9-]{0,63}$')
SPEC = Path('/app/contracts/insights.json').read_bytes()
SPEC_HASH = hashlib.sha256(SPEC).hexdigest()
REGIONS = json.loads(Path('/app/regions.geojson').read_text())
_jwks: dict[str, Any] = {}
_jwks_until = 0.0


class ApiError(Exception):
    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status = status
        self.code = code


def request_json(host: str, port: int, path: str, method: str = 'GET', data: bytes | None = None,
                 headers: dict[str, str] | None = None, service_cert: bool = False) -> tuple[int, Any]:
    context = ssl.create_default_context(cafile='/trust/server-ca.pem')
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    if service_cert:
        context.load_cert_chain('/caller/cert.pem', '/caller/key.pem')
    connection = http.client.HTTPSConnection(host, port, context=context, timeout=5)
    try:
        connection.request(method, path, body=data, headers=headers or {})
        response = connection.getresponse()
        raw = response.read(1_048_577)
        if len(raw) > 1_048_576:
            raise ApiError(503, 'dependency_unavailable')
        return response.status, json.loads(raw)
    except (OSError, http.client.HTTPException, ValueError) as exc:
        raise ApiError(503, 'dependency_unavailable') from exc
    finally:
        connection.close()


def signing_keys() -> dict[str, Any]:
    global _jwks, _jwks_until
    if not _jwks or time.monotonic() >= _jwks_until:
        status, body = request_json('auth.magic.test', 9443, '/realms/magic-shop/protocol/openid-connect/certs')
        if status != 200 or not isinstance(body, dict) or not isinstance(body.get('keys'), list) or not 1 <= len(body['keys']) <= 20:
            raise ApiError(503, 'dependency_unavailable')
        _jwks = {key['kid']: key for key in body['keys'] if isinstance(key, dict) and key.get('alg') == 'RS256' and key.get('kty') == 'RSA' and isinstance(key.get('kid'), str)}
        _jwks_until = time.monotonic() + 300
    return _jwks


def authorize(token: str, identity: str) -> str:
    if not 20 <= len(token) <= 16384:
        raise ApiError(401, 'invalid_token')
    try:
        header = jwt.get_unverified_header(token)
        if header.get('alg') != 'RS256' or not isinstance(header.get('kid'), str) or len(header['kid']) > 128:
            raise ValueError('Unsupported token header')
        key = signing_keys().get(header['kid'])
        if key is None:
            global _jwks_until
            _jwks_until = 0
            key = signing_keys().get(header['kid'])
        if key is None:
            raise ValueError('Unknown signing key')
        public = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
        claims = jwt.decode(token, public, algorithms=['RS256'], issuer=ISSUER, audience='insights-api', options={'require': ['exp', 'iat', 'iss', 'aud', 'sub']})
    except ApiError:
        raise
    except (jwt.PyJWTError, ValueError, TypeError, KeyError) as exc:
        raise ApiError(401, 'invalid_token') from exc
    access = claims.get('realm_access')
    roles = access.get('roles', []) if isinstance(access, dict) else []
    if claims.get('typ') != 'Bearer' or claims.get('azp') != 'shop-spa' or claims.get('cert_identity') != identity or not SUB.fullmatch(str(claims.get('sub'))) or not isinstance(roles, list) or 'shop-admin' not in roles:
        raise ApiError(403, 'forbidden')
    return claims['sub']


def authorize_spec_service(token: str) -> None:
    try:
        header = jwt.get_unverified_header(token)
        if header.get('alg') != 'RS256' or not isinstance(header.get('kid'), str):
            raise ValueError('Unsupported token header')
        key = signing_keys().get(header['kid'])
        if key is None:
            raise ValueError('Unknown signing key')
        claims = jwt.decode(token, jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key)), algorithms=['RS256'],
                            issuer=ISSUER, audience='customer-api', options={'require': ['exp', 'iat', 'iss', 'aud']})
    except ApiError:
        raise
    except (jwt.PyJWTError, ValueError, TypeError, KeyError) as exc:
        raise ApiError(401, 'invalid_token') from exc
    if claims.get('typ') != 'Bearer' or claims.get('azp') != 'insights-reporting' or claims.get('cert_identity') is not None or 'reporting.read' not in str(claims.get('scope', '')).split():
        raise ApiError(403, 'forbidden')


def reporting_token() -> str:
    secret = Path('/service-secret/client-secret').read_text().strip()
    body = urlencode({'grant_type': 'client_credentials', 'client_id': 'insights-reporting', 'client_secret': secret, 'scope': 'reporting.read'}).encode()
    status, result = request_json('auth.magic.test', 9443, '/realms/magic-shop/protocol/openid-connect/token', 'POST', body, {'content-type': 'application/x-www-form-urlencoded'})
    if status != 200 or not isinstance(result, dict) or not isinstance(result.get('access_token'), str):
        raise ApiError(503, 'dependency_unavailable')
    return result['access_token']


def fetch_reporting(start: str, end: str, region: str | None) -> list[dict[str, Any]]:
    token = reporting_token()
    cursor: str | None = None
    revision: str | None = None
    result: list[dict[str, Any]] = []
    for _ in range(MAX_RECORDS // 100 + 1):
        params = {'limit': '100', 'from': start, 'to': end}
        if region:
            params['regionId'] = region
        if cursor:
            params['cursor'] = cursor
            params['revision'] = revision or ''
        status, page = request_json('customer-api', 8443, '/internal/reporting/orders?' + urlencode(params), headers={'authorization': 'Bearer ' + token}, service_cert=True)
        if status == 409:
            raise ApiError(409, 'conflict')
        if status != 200 or not isinstance(page, dict) or not isinstance(page.get('items'), list) or len(page['items']) > 100 or not isinstance(page.get('revision'), str):
            raise ApiError(503, 'dependency_unavailable')
        if revision and revision != page['revision']:
            raise ApiError(409, 'conflict')
        revision = page['revision']
        result.extend(page['items'])
        if len(result) > MAX_RECORDS:
            raise ApiError(503, 'dependency_unavailable')
        next_cursor = page.get('nextCursor')
        if next_cursor is None:
            return result
        if not isinstance(next_cursor, str) or next_cursor == cursor or len(next_cursor) > 512:
            raise ApiError(503, 'dependency_unavailable')
        cursor = next_cursor
    raise ApiError(503, 'dependency_unavailable')


def database() -> psycopg.Connection[Any]:
    password = Path('/db-secret/service-password').read_text().strip()
    return psycopg.connect(host='postgres', port=5432, dbname='insights_db', user='insights_app', password=password,
                           sslmode='verify-full', sslrootcert='/trust/server-ca.pem', connect_timeout=5,
                           options='-c statement_timeout=5000', row_factory=dict_row)


def initialize() -> None:
    with database() as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS follow_ups (
          follow_up_id text PRIMARY KEY, customer_sub uuid NOT NULL, region_id text NOT NULL,
          author_sub uuid NOT NULL, note text NOT NULL, status text NOT NULL CHECK (status IN ('open','done')),
          created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL)''')
        conn.execute('CREATE INDEX IF NOT EXISTS follow_ups_region_id_idx ON follow_ups (region_id, follow_up_id)')


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def follow_up(row: dict[str, Any]) -> dict[str, Any]:
    return {'followUpId': row['follow_up_id'], 'customerSub': str(row['customer_sub']), 'regionId': row['region_id'],
            'authorSub': str(row['author_sub']), 'note': row['note'], 'status': row['status'],
            'createdAt': iso(row['created_at']), 'updatedAt': iso(row['updated_at'])}


def page(items: list[Any], limit: int, cursor: str | None) -> dict[str, Any]:
    start = 0
    if cursor:
        start = next((index + 1 for index, item in enumerate(items) if (item.get('orderId') or item.get('sub') or item.get('followUpId') or item['properties']['regionId']) == cursor), -1)
        if start < 0:
            raise ApiError(400, 'invalid_request')
    selected = items[start:start + limit]
    next_cursor = None
    if start + limit < len(items):
        last = selected[-1]
        next_cursor = last.get('orderId') or last.get('sub') or last.get('followUpId') or last['properties']['regionId']
    return {'items': selected, 'nextCursor': next_cursor}


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'MagicInsights/1'

    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(10)

    def send_json(self, status: int, value: Any, extra: dict[str, str] | None = None) -> None:
        body = json.dumps(value, separators=(',', ':')).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        for key, val in (extra or {}).items():
            self.send_header(key, val)
        self.end_headers()
        self.wfile.write(body)

    def fail(self, error: ApiError) -> None:
        self.send_json(error.status, {'code': error.code, 'message': error.code})

    def body(self, allowed: set[str], required: set[str]) -> dict[str, Any]:
        if self.headers.get('content-type', '').split(';')[0].strip().lower() != 'application/json':
            raise ApiError(400, 'invalid_request')
        length = self.headers.get('content-length', '')
        if not length.isdigit() or not 1 <= int(length) <= 16384:
            raise ApiError(400, 'invalid_request')
        try:
            value = json.loads(self.rfile.read(int(length)))
        except (ValueError, UnicodeError) as exc:
            raise ApiError(400, 'invalid_request') from exc
        if not isinstance(value, dict) or not required <= value.keys() or not value.keys() <= allowed:
            raise ApiError(400, 'invalid_request')
        return value

    def handle_api(self) -> None:
        try:
            parsed = urlsplit(self.path)
            path = parsed.path
            if not path.startswith('/api/insights/') and path != '/internal/openapi.json':
                raise ApiError(404, 'not_found')
            peer = self.connection.getpeercert() if isinstance(self.connection, ssl.SSLSocket) else {}
            names = [value for part in peer.get('subject', ()) for key, value in part if key == 'commonName']
            if names != (['insights-api'] if path == '/internal/openapi.json' else ['gateway']):
                raise ApiError(403, 'forbidden')
            values = self.headers.get_all('authorization', [])
            if len(values) != 1 or not values[0].startswith('Bearer '):
                raise ApiError(401, 'invalid_token')
            identities = self.headers.get_all('x-cert-identity', [])
            if path == '/internal/openapi.json':
                authorize_spec_service(values[0][7:])
                author = ''
            else:
                author = authorize(values[0][7:], identities[0] if len(identities) == 1 else '')
            query = parse_qs(parsed.query, keep_blank_values=True)
            if any(len(values) != 1 for values in query.values()):
                raise ApiError(400, 'invalid_request')
            method = self.command
            if path == '/internal/openapi.json' and method == 'GET':
                if query:
                    raise ApiError(400, 'invalid_request')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(SPEC)))
                self.send_header('X-OpenAPI-SHA256', SPEC_HASH)
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(SPEC)
                return
            if path == '/api/insights/regions' and method == 'GET':
                limit, cursor = self.parse_page(query, {'limit', 'cursor'})
                features = REGIONS['features']
                subset = page(features, limit, cursor)
                self.send_json(200, {'type': 'FeatureCollection', 'features': subset['items']},
                               {'X-Next-Cursor': subset['nextCursor']} if subset['nextCursor'] else None)
                return
            if path in ('/api/insights/sales', '/api/insights/customers', '/api/insights/orders') and method == 'GET':
                allowed = {'from', 'to', 'regionId'} if path.endswith('/sales') else {'from', 'to', 'regionId', 'limit', 'cursor'}
                limit, cursor = self.parse_page(query, allowed)
                start, end = query.get('from', [None])[0], query.get('to', [None])[0]
                if start is None or end is None:
                    raise ApiError(400, 'invalid_request')
                try:
                    if utc(start) >= utc(end):
                        raise ValueError('range')
                except (ValueError, TypeError, OverflowError) as exc:
                    raise ApiError(400, 'invalid_request') from exc
                region = query.get('regionId', [None])[0]
                if region is not None and region not in REGION_IDS:
                    raise ApiError(400, 'invalid_request')
                rows = completed(fetch_reporting(start, end, region), start, end, region)
                if path.endswith('/sales'):
                    self.send_json(200, sales(rows, start, end, region))
                elif path.endswith('/customers'):
                    self.send_json(200, page(customers(rows), limit, cursor))
                else:
                    self.send_json(200, page(orders(rows), limit, cursor))
                return
            if path == '/api/insights/follow-ups':
                if method == 'GET':
                    limit, cursor = self.parse_page(query, {'limit', 'cursor', 'regionId', 'status'})
                    region, status = query.get('regionId', [None])[0], query.get('status', [None])[0]
                    if (region is not None and region not in REGION_IDS) or (status is not None and status not in ('open', 'done')):
                        raise ApiError(400, 'invalid_request')
                    with database() as conn:
                        rows = conn.execute('SELECT * FROM follow_ups WHERE (%s::text IS NULL OR region_id=%s) AND (%s::text IS NULL OR status=%s) ORDER BY follow_up_id LIMIT 10001', (region, region, status, status)).fetchall()
                    if len(rows) > MAX_RECORDS:
                        raise ApiError(503, 'dependency_unavailable')
                    self.send_json(200, page([follow_up(row) for row in rows], limit, cursor))
                    return
                if method == 'POST':
                    if query:
                        raise ApiError(400, 'invalid_request')
                    body = self.body({'customerSub', 'regionId', 'note'}, {'customerSub', 'regionId', 'note'})
                    if not isinstance(body['customerSub'], str) or not SUB.fullmatch(body['customerSub']) or body['regionId'] not in REGION_IDS or not isinstance(body['note'], str) or not 1 <= len(body['note']) <= 2000:
                        raise ApiError(400, 'invalid_request')
                    # A follow-up is tied to an observed order in its historical region.
                    rows = fetch_reporting('2000-01-01T00:00:00Z', '2100-01-01T00:00:00Z', body['regionId'])
                    if not any(row['order']['ownerSub'] == body['customerSub'] for row in rows):
                        raise ApiError(404, 'not_found')
                    now = datetime.now(timezone.utc)
                    key = 'follow-' + uuid.uuid4().hex
                    with database() as conn:
                        row = conn.execute('INSERT INTO follow_ups VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *', (key, body['customerSub'], body['regionId'], author, body['note'], 'open', now, now)).fetchone()
                    self.send_json(201, follow_up(row), {'Location': '/api/insights/follow-ups/' + key})
                    return
            if path.startswith('/api/insights/follow-ups/') and method == 'PATCH':
                if query:
                    raise ApiError(400, 'invalid_request')
                key = path.split('/')[-1]
                if not ID.fullmatch(key):
                    raise ApiError(400, 'invalid_request')
                body = self.body({'note', 'status'}, set())
                if not body or ('note' in body and (not isinstance(body['note'], str) or not 1 <= len(body['note']) <= 2000)) or ('status' in body and body['status'] not in ('open', 'done')):
                    raise ApiError(400, 'invalid_request')
                with database() as conn:
                    row = conn.execute('UPDATE follow_ups SET note=COALESCE(%s,note),status=COALESCE(%s,status),updated_at=%s WHERE follow_up_id=%s RETURNING *', (body.get('note'), body.get('status'), datetime.now(timezone.utc), key)).fetchone()
                if row is None:
                    raise ApiError(404, 'not_found')
                self.send_json(200, follow_up(row))
                return
            raise ApiError(404, 'not_found')
        except ApiError as error:
            self.fail(error)
        except (psycopg.Error, OSError, KeyError, TypeError) as error:
            print('insights dependency failure:', type(error).__name__, flush=True)
            self.fail(ApiError(503, 'dependency_unavailable'))

    def parse_page(self, query: dict[str, list[str]], allowed: set[str]) -> tuple[int, str | None]:
        if not query.keys() <= allowed:
            raise ApiError(400, 'invalid_request')
        raw = query.get('limit', ['20'])[0]
        if not raw.isdigit() or not 1 <= int(raw) <= 100:
            raise ApiError(400, 'invalid_request')
        cursor = query.get('cursor', [None])[0]
        if cursor is not None and (not cursor or len(cursor) > 512):
            raise ApiError(400, 'invalid_request')
        return int(raw), cursor

    do_GET = handle_api
    do_POST = handle_api
    do_PATCH = handle_api


class Health(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        try:
            with database() as conn:
                conn.execute('SELECT 1')
            status, body = 200, b'UP'
        except Exception:
            status, body = 503, b'Unavailable'
        self.send_response(status if self.path == '/health/ready' else 404)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    initialize()
    health = ThreadingHTTPServer(('127.0.0.1', 9000), Health)
    threading.Thread(target=health.serve_forever, daemon=True).start()
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain('/credentials/cert.pem', '/credentials/key.pem')
    context.load_verify_locations(cafile='/trust/service-trust-crl.pem')
    context.verify_flags |= ssl.VERIFY_CRL_CHECK_LEAF
    context.verify_mode = ssl.CERT_REQUIRED
    server = ThreadingHTTPServer(('0.0.0.0', 8443), Handler)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    server.serve_forever()


if __name__ == '__main__':
    main()

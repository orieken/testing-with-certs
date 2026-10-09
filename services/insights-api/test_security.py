import base64
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

import server


SUB = '30303030-3030-4030-8030-303030303030'


def public_jwk(private_key, kid):
    numbers = private_key.public_key().public_numbers()

    def encoded(value):
        raw = value.to_bytes((value.bit_length() + 7) // 8, 'big')
        return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()

    return {'kid': kid, 'kty': 'RSA', 'alg': 'RS256', 'use': 'sig', 'n': encoded(numbers.n), 'e': encoded(numbers.e)}


def signed(private_key, kid, **changes):
    now = datetime.now(timezone.utc)
    claims = {
        'iss': server.ISSUER, 'aud': 'insights-api', 'sub': SUB,
        'iat': now, 'exp': now + timedelta(minutes=2), 'typ': 'Bearer',
        'azp': 'shop-spa', 'cert_identity': SUB, 'realm_access': {'roles': ['shop-admin']},
    }
    claims.update(changes)
    return jwt.encode(claims, private_key, algorithm='RS256', headers={'kid': kid})


class SignedSecurityTests(unittest.TestCase):
    def setUp(self):
        self.first = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.keys = {'first': public_jwk(self.first, 'first')}
        self.patch = patch.object(server, 'signing_keys', side_effect=lambda: self.keys)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def assert_status(self, status, action):
        with self.assertRaises(server.ApiError) as caught:
            action()
        self.assertEqual(caught.exception.status, status)

    def test_signed_user_claim_boundaries(self):
        self.assertEqual(server.authorize(signed(self.first, 'first'), SUB), SUB)
        now = datetime.now(timezone.utc)
        variants = [
            {'iat': now - timedelta(minutes=4), 'exp': now - timedelta(minutes=2)},
            {'nbf': now + timedelta(minutes=2)},
            {'iss': 'https://wrong.magic.test/realms/magic-shop'},
            {'aud': 'customer-api'},
        ]
        for values in variants:
            with self.subTest(values=values):
                self.assert_status(401, lambda: server.authorize(signed(self.first, 'first', **values), SUB))
        self.assert_status(403, lambda: server.authorize(signed(self.first, 'first'), 'other-identity'))

    def test_unknown_key_fails_then_published_key_succeeds(self):
        second = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.assert_status(401, lambda: server.authorize(signed(second, 'second'), SUB))
        self.keys['second'] = public_jwk(second, 'second')
        self.assertEqual(server.authorize(signed(second, 'second'), SUB), SUB)

    def test_signed_service_scope_and_caller(self):
        base = {'aud': 'customer-api', 'azp': 'insights-reporting', 'cert_identity': None, 'scope': 'openid reporting.read'}
        server.authorize_spec_service(signed(self.first, 'first', **base))
        self.assert_status(403, lambda: server.authorize_spec_service(signed(self.first, 'first', **{**base, 'scope': 'openid'})))
        self.assert_status(403, lambda: server.authorize_spec_service(signed(self.first, 'first', **{**base, 'azp': 'customer-catalog'})))


if __name__ == '__main__':
    unittest.main()

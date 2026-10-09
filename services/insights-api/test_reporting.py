import unittest
from unittest.mock import patch

from server import ApiError, fetch_reporting


class ReportingBoundaryTests(unittest.TestCase):
    def test_changed_revision_never_returns_mixed_pages(self):
        responses = [(200, {'revision': 'r1', 'items': [{'order': {'orderId': 'a'}}], 'nextCursor': 'next'}),
                     (200, {'revision': 'r2', 'items': [], 'nextCursor': None})]
        with patch('server.reporting_token', return_value='fixture-token'), patch('server.request_json', side_effect=responses) as caller:
            with self.assertRaises(ApiError) as raised:
                fetch_reporting('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', None)
            self.assertEqual(raised.exception.status, 409)
            self.assertIn('revision=r1', caller.call_args_list[1].args[2])

    def test_upstream_revision_conflict_is_retriable(self):
        with patch('server.reporting_token', return_value='fixture-token'), patch('server.request_json', return_value=(409, {'code': 'conflict'})):
            with self.assertRaises(ApiError) as raised:
                fetch_reporting('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', None)
            self.assertEqual(raised.exception.status, 409)

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

    def test_empty_intermediate_page_continues_without_losing_rows(self):
        a, b = {'order': {'orderId': 'a'}}, {'order': {'orderId': 'b'}}
        pages = [(200, {'revision': 'r1', 'items': [a], 'nextCursor': 'c1'}),
                 (200, {'revision': 'r1', 'items': [], 'nextCursor': 'c2'}),
                 (200, {'revision': 'r1', 'items': [b], 'nextCursor': None})]
        with patch('server.reporting_token', return_value='fixture-token'), patch('server.request_json', side_effect=pages) as caller:
            self.assertEqual(fetch_reporting('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', None), [a, b])
            self.assertEqual(caller.call_count, 3)

    def test_faults_terminate_without_returning_partial_rows(self):
        first = (200, {'revision': 'r1', 'items': [{'order': {'orderId': 'a'}}], 'nextCursor': 'c1'})
        faults = [(503, {'code': 'dependency_unavailable'}),
                  (200, {'revision': 'r1', 'items': [], 'nextCursor': 'c1'}),
                  (200, {'revision': 'r1', 'items': 'FAULT_INVALID_TYPE', 'nextCursor': None}),
                  (200, {'revision': 'r1', 'items': [{}] * 101, 'nextCursor': None})]
        for fault in faults:
            with self.subTest(fault=fault), patch('server.reporting_token', return_value='fixture-token'), patch('server.request_json', side_effect=[first, fault]) as caller:
                with self.assertRaises(ApiError) as raised:
                    fetch_reporting('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', None)
                self.assertEqual(raised.exception.status, 503)
                self.assertEqual(caller.call_count, 2)

    def test_page_and_record_caps_are_independent(self):
        cases = [[(200, {'revision': 'r1', 'items': [{}] * 100, 'nextCursor': 'c1'}),
                  (200, {'revision': 'r1', 'items': [{}], 'nextCursor': None})],
                 [(200, {'revision': 'r1', 'items': [], 'nextCursor': 'c1'}),
                  (200, {'revision': 'r1', 'items': [], 'nextCursor': 'c2'})]]
        for pages in cases:
            with self.subTest(pages=pages), patch('server.MAX_RECORDS', 100), patch('server.reporting_token', return_value='fixture-token'), patch('server.request_json', side_effect=pages) as caller:
                with self.assertRaises(ApiError) as raised:
                    fetch_reporting('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', None)
                self.assertEqual(raised.exception.status, 503)
                self.assertEqual(caller.call_count, 2)

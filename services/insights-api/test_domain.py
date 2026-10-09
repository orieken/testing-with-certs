import unittest
from domain import sales, customers, completed

A = {'order': {'status': 'completed', 'completedAt': '2026-09-01T00:00:00Z', 'regionId': 'waterdeep', 'ownerSub': 'a', 'totalCopper': 5}, 'customer': {'displayName': 'Moved', 'regionId': 'neverwinter'}}
B = {'order': {'status': 'cancelled', 'completedAt': None, 'regionId': 'waterdeep', 'ownerSub': 'a', 'totalCopper': 100}, 'customer': {'displayName': 'Moved', 'regionId': 'neverwinter'}}
C = {'order': {'status': 'completed', 'completedAt': '2026-09-02T00:00:00Z', 'regionId': 'waterdeep', 'ownerSub': 'a', 'totalCopper': 7}, 'customer': {'displayName': 'Moved', 'regionId': 'neverwinter'}}

class DomainTests(unittest.TestCase):
    def test_historical_region_dedup_cancelled_and_half_open_boundary(self):
        summary = sales([A, B, C], '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z')
        self.assertEqual((summary['salesCopper'], summary['orderCount'], summary['customerCount']), (5, 1, 1))
        self.assertEqual(summary['regions'][0]['regionId'], 'waterdeep')
        self.assertEqual(summary['regions'][2]['salesCopper'], 0)
        self.assertEqual(customers(completed([A, B, C], '2026-09-01T00:00:00Z', '2026-09-03T00:00:00Z'))[0]['orderCount'], 2)

    def test_bad_range(self):
        with self.assertRaises(ValueError):
            sales([], '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')

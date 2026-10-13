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

    def test_exact_millisecond_window_and_status_boundaries(self):
        rows = []
        for at, amount in [('2026-10-31T23:59:59.999Z', 400), ('2026-11-01T00:00:00Z', 100),
                           ('2026-11-30T23:59:59.999Z', 200), ('2026-12-01T00:00:00Z', 300)]:
            rows.append({'order': {'status': 'completed', 'completedAt': at, 'regionId': 'waterdeep', 'ownerSub': 'a', 'totalCopper': amount}})
        rows.append({'order': {'status': 'cancelled', 'completedAt': '2026-11-15T00:00:00Z', 'regionId': 'waterdeep', 'ownerSub': 'a', 'totalCopper': 90000}})
        summary = sales(rows, '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z')
        self.assertEqual((summary['orderCount'], summary['customerCount'], summary['salesCopper']), (2, 1, 300))

    def test_multiple_pages_and_current_location_do_not_reassign_sales(self):
        rows = [{'order': {'status': 'completed', 'completedAt': '2026-11-15T00:00:00Z', 'regionId': 'waterdeep',
                           'ownerSub': 'a' if index % 2 == 0 else 'b', 'totalCopper': 100},
                 'customer': {'displayName': 'Moved', 'regionId': 'neverwinter', 'location': [-121, 47.5]}} for index in range(110)]
        summary = sales(rows[:100] + rows[100:], '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z')
        self.assertEqual((summary['orderCount'], summary['customerCount'], summary['salesCopper']), (110, 2, 11000))
        self.assertEqual(summary['regions'][0]['salesCopper'], 11000)
        self.assertEqual(summary['regions'][2]['salesCopper'], 0)
        self.assertEqual([row['orderCount'] for row in customers(rows)], [55, 55])

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

REGION_IDS = ('waterdeep', 'baldurs-gate', 'neverwinter', 'empty-march')
MAX_RECORDS = 10000


def utc(value: str) -> datetime:
    if not isinstance(value, str) or not value.endswith('Z'):
        raise ValueError('UTC timestamp required')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.utcoffset().total_seconds() != 0:
        raise ValueError('UTC timestamp required')
    return parsed


def completed(records: list[dict[str, Any]], start: str, end: str, region: str | None = None) -> list[dict[str, Any]]:
    lower, upper = utc(start), utc(end)
    if lower >= upper:
        raise ValueError('Invalid date range')
    result = []
    for row in records:
        order = row['order']
        if order['status'] != 'completed' or order['completedAt'] is None:
            continue
        if region is not None and order['regionId'] != region:
            continue
        if lower <= utc(order['completedAt']) < upper:
            result.append(row)
    return result


def sales(records: list[dict[str, Any]], start: str, end: str, region: str | None = None) -> dict[str, Any]:
    rows = completed(records, start, end, region)
    by_region: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_region[row['order']['regionId']].append(row)
    region_ids = (region,) if region else REGION_IDS
    regions = [{'regionId': key, 'orderCount': len(by_region[key]),
                'customerCount': len({row['order']['ownerSub'] for row in by_region[key]}),
                'salesCopper': sum(row['order']['totalCopper'] for row in by_region[key])} for key in region_ids]
    return {'from': start, 'to': end, 'status': 'completed', 'orderCount': len(rows),
            'customerCount': len({row['order']['ownerSub'] for row in rows}),
            'salesCopper': sum(row['order']['totalCopper'] for row in rows), 'regions': regions}


def customers(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        order, profile = row['order'], row['customer']
        sub = order['ownerSub']
        item = result.setdefault(sub, {'sub': sub, 'displayName': profile['displayName'], 'orderCount': 0, 'salesCopper': 0})
        item['orderCount'] += 1
        item['salesCopper'] += order['totalCopper']
    return sorted(result.values(), key=lambda item: item['sub'])


def orders(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(({'orderId': row['order']['orderId'], 'ownerSub': row['order']['ownerSub'],
                    'regionId': row['order']['regionId'], 'completedAt': row['order']['completedAt'],
                    'totalCopper': row['order']['totalCopper']} for row in rows), key=lambda item: item['orderId'])

import json
import unittest
from pathlib import Path


class ContractEquivalenceTests(unittest.TestCase):
    def test_operation_inventory_and_mutation_fields(self):
        contract = json.loads(Path('/app/contracts/insights.json').read_text())
        operations = {(method.upper(), path): value['operationId'] for path, methods in contract['paths'].items() for method, value in methods.items()}
        self.assertEqual(operations, {
            ('GET', '/api/insights/regions'): 'listRegions',
            ('GET', '/api/insights/sales'): 'getSalesSummary',
            ('GET', '/api/insights/customers'): 'listRegionalCustomers',
            ('GET', '/api/insights/orders'): 'listRegionalOrders',
            ('GET', '/api/insights/follow-ups'): 'listFollowUps',
            ('POST', '/api/insights/follow-ups'): 'createFollowUp',
            ('PATCH', '/api/insights/follow-ups/{followUpId}'): 'updateFollowUp',
        })
        for name, fields in {'FollowUpCreate': {'customerSub', 'regionId', 'note'}, 'FollowUpPatch': {'note', 'status'}}.items():
            self.assertEqual(set(contract['components']['schemas'][name]['properties']), fields)

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

test('customer adapter operations and validated request fields match canonical OpenAPI', () => {
  const doc = JSON.parse(readFileSync('/work/contracts/bundled/customer.json', 'utf8')) as {
    paths: Record<string, Record<string, { operationId: string }>>;
    components: { schemas: Record<string, { additionalProperties?: boolean; required?: string[]; properties: Record<string, unknown> }> };
  };
  const actual = Object.entries(doc.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, operation]) => `${method.toUpperCase()} ${path} ${operation.operationId}`)).sort();
  assert.deepEqual(actual, [
    'GET /api/customer/admin/orders listAdminOrders', 'GET /api/customer/admin/users listAdminUsers',
    'GET /api/customer/me getMyProfile', 'GET /api/customer/me/widgets getMyWidgets',
    'GET /api/customer/orders listMyOrders', 'GET /api/customer/orders/{orderId} getMyOrder',
    'GET /internal/reporting/orders listReportingOrders', 'PATCH /api/customer/me updateMyProfile',
    'POST /api/customer/orders createOrder', 'PUT /api/customer/me/widgets putMyWidgets'
  ].sort());
  for (const [name, fields, required] of [
    ['ProfilePatch', ['displayName', 'regionId', 'location'], []],
    ['CheckoutRequest', ['regionId', 'lines'], ['regionId', 'lines']],
    ['WidgetLayout', ['widgetIds'], ['widgetIds']]
  ] as const) {
    const schema = doc.components.schemas[name]; assert.ok(schema);
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(Object.keys(schema.properties).sort(), [...fields].sort());
    assert.deepEqual((schema.required ?? []).sort(), [...required].sort());
  }
});

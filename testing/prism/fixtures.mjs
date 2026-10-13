// Canonical-valid fixtures. Invalid FAULT_* payloads are separate and never named Prism examples.
import { item, profile, order } from '/work/spikes/mock-auth/browser/fixtures.mjs';
export { item, profile, order };
export const checkout = { regionId: 'waterdeep', lines: [{ itemId: item.id, quantity: 1 }] };
export const populated = { items: [item], nextCursor: null };
export const empty = { items: [], nextCursor: null };
export const regions = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { regionId: 'waterdeep', name: 'Waterdeep', center: [-120, 45] }, geometry: { type: 'Polygon', coordinates: [[[-121,44],[-119,44],[-119,46],[-121,46],[-121,44]]] } }] };
export const sales = { from: '2026-09-01T00:00:00Z', to: '2026-10-01T00:00:00Z', status: 'completed', orderCount: 1, customerCount: 1, salesCopper: 100, regions: [{ regionId: 'waterdeep', orderCount: 1, customerCount: 1, salesCopper: 100 }] };
export const errors = Object.fromEntries([[400,'invalid_request'],[401,'invalid_token'],[403,'forbidden'],[409,'conflict'],[422,'unprocessable'],[503,'dependency_unavailable']].map(([status,code]) => [status, { code, message: code }]));
export const fixtures = [
  ['catalog','listItems',200,'populated',populated], ['catalog','listItems',200,'empty',empty],
  ['catalog','getItem',200,'item',item], ['catalog','createItem',201,'created',item,{location:`/api/catalog/items/${item.id}`}],
  ['catalog','archiveItem',204,'deleted',undefined], ['catalog','listItems',400,'invalidRequest',errors[400]], ['catalog','listItems',403,'forbidden',errors[403]],
  ['customer','getMyProfile',200,'profile',profile], ['customer','getMyWidgets',200,'widgets',{widgetIds:['recent-orders']}],
  ['customer','listMyOrders',200,'orders',{items:[order],nextCursor:null}],
  ['customer','createOrder',201,'created',order,{location:`/api/customer/orders/${order.orderId}`}],
  ...[403,409,422,503].map(status => ['customer','createOrder',status,`error${status}`,errors[status]]),
  ['insights','listRegions',200,'regions',regions], ['insights','getSalesSummary',200,'sales',sales]
];
export const FAULT_wrong_type = { ...populated, items: [{ ...item, priceCopper: 'INTENTIONALLY_INVALID_TYPE' }] };
export const FAULT_tuple = structuredClone(regions); FAULT_tuple.features[0].properties.center.push(7);
export const FAULT_date = { ...sales, from: '2026-09-01T00:00:00-05:00' };
export const FAULT_json = '{ INTENTIONALLY_INVALID_JSON';
export const FAULT_oversized = JSON.stringify({ ...order, FAULT_padding: 'X'.repeat(1_048_577) }); // Deliberately exceeds the existing UI response bound.

export const FAULT_tuple_position = structuredClone(regions); FAULT_tuple_position.features[0].properties.center[1]=91;
export const FAULT_tuple_type = structuredClone(regions); FAULT_tuple_type.features[0].properties.center[0]='INTENTIONALLY_INVALID_TYPE';
export const FAULT_date_calendar = { ...sales, from: '2026-02-30T00:00:00Z' };

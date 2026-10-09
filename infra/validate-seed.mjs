import { readFileSync } from 'node:fs';

const read = (name) => JSON.parse(readFileSync(new URL(`../seed/${name}`, import.meta.url), 'utf8'));
const items = read('catalog-items.json');
const identities = read('identities.json');
const profiles = read('customer-profiles.json');
const geo = read('regions.geojson');
const orders = read('orders.json');
const oracle = read('reporting-oracle.json');

function check(condition, message) {
  if (!condition) throw new Error(message);
}
function unique(values, label) {
  check(new Set(values).size === values.length, `duplicate ${label}`);
}
function utc(value, label) {
  check(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value), `${label}: UTC timestamp required`);
  check(!Number.isNaN(Date.parse(value)) && new Date(value).toISOString().replace('.000Z', 'Z') === value, `${label}: invalid timestamp`);
}
function noCredentials(value, path = 'seed') {
  if (Array.isArray(value)) return value.forEach((entry, index) => noCredentials(entry, `${path}[${index}]`));
  if (value === null || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    check(!/password|private.?key|access.?token|refresh.?token|client.?secret|pem|pkcs12|certificate/i.test(key), `${path}.${key}: credential-like field`);
    noCredentials(entry, `${path}.${key}`);
  }
}
for (const [name, data] of Object.entries({ items, identities, profiles, geo, orders, oracle })) noCredentials(data, name);

const itemById = new Map(items.map((item) => [item.id, item]));
unique(items.map((item) => item.id), 'item ID');
const identityBySub = new Map(identities.map((identity) => [identity.sub, identity]));
unique(identities.map((identity) => identity.sub), 'subject');
unique(identities.map((identity) => identity.certIdentity), 'certificate identity');
unique(identities.map((identity) => identity.username), 'username');
for (const identity of identities) {
  check(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(identity.sub), `invalid subject ${identity.username}`);
  check(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(identity.certIdentity), `invalid cert identity ${identity.username}`);
  check(['customer', 'shopkeeper', 'shop-admin'].includes(identity.role), `invalid role ${identity.username}`);
  check(typeof identity.enabled === 'boolean', `enabled flag missing for ${identity.username}`);
}
check(identities.filter((identity) => identity.role === 'customer' && identity.enabled).length >= 2, 'need two enabled customers');
check(identities.some((identity) => identity.role === 'shopkeeper' && identity.enabled), 'need shopkeeper');
check(identities.some((identity) => identity.role === 'shop-admin' && identity.enabled), 'need shop-admin');
check(identities.some((identity) => !identity.enabled), 'need disabled user');

check(geo.type === 'FeatureCollection', 'regions must be a FeatureCollection');
const regionById = new Map(geo.features.map((feature) => [feature.properties.regionId, feature]));
unique([...regionById.keys()], 'region ID');
const bounds = [];
for (const feature of geo.features) {
  const id = feature.properties.regionId;
  const ring = feature.geometry.coordinates[0];
  check(feature.type === 'Feature' && feature.geometry.type === 'Polygon' && ring.length === 5, `${id}: rectangular polygon required`);
  check(JSON.stringify(ring[0]) === JSON.stringify(ring[4]), `${id}: ring not closed`);
  const xs = [...new Set(ring.map((point) => point[0]))];
  const ys = [...new Set(ring.map((point) => point[1]))];
  check(xs.length === 2 && ys.length === 2, `${id}: expected axis-aligned rectangle`);
  const [west, east] = xs.sort((a, b) => a - b);
  const [south, north] = ys.sort((a, b) => a - b);
  check(west >= -180 && east <= 180 && south >= -90 && north <= 90 && west < east && south < north, `${id}: invalid coordinates`);
  const [lon, lat] = feature.properties.center;
  check(lon >= west && lon < east && lat >= south && lat < north, `${id}: center outside region`);
  bounds.push({ id, west, east, south, north });
}
for (let a = 0; a < bounds.length; a++) for (let b = a + 1; b < bounds.length; b++) {
  const x = bounds[a], y = bounds[b];
  check(x.east <= y.west || y.east <= x.west || x.north <= y.south || y.north <= x.south, `${x.id}/${y.id}: overlapping regions`);
}
function regionAt([lon, lat]) {
  return bounds.find((r) => lon >= r.west && lon < r.east && lat >= r.south && lat < r.north)?.id;
}
unique(profiles.map((profile) => profile.sub), 'profile subject');
for (const profile of profiles) {
  check(identityBySub.has(profile.sub), `profile has unknown subject ${profile.sub}`);
  check(regionById.has(profile.regionId) && regionAt(profile.location) === profile.regionId, `profile region/location mismatch for ${profile.sub}`);
}
check(profiles.length === identities.length, 'every identity needs one profile');

unique(orders.map((order) => order.orderId), 'order ID');
unique(orders.map((order) => `${order.ownerSub}:${order.checkoutKey}`), 'owner checkout key');
for (const order of orders) {
  check(identityBySub.get(order.ownerSub)?.enabled, `${order.orderId}: owner must be enabled`);
  check(regionById.has(order.regionId), `${order.orderId}: unknown region`);
  check(['pending', 'completed', 'cancelled'].includes(order.status), `${order.orderId}: invalid status`);
  utc(order.createdAt, `${order.orderId}.createdAt`);
  if (order.status === 'completed') {
    utc(order.completedAt, `${order.orderId}.completedAt`);
    check(order.completedAt >= order.createdAt, `${order.orderId}: completion before creation`);
  } else check(order.completedAt === null, `${order.orderId}: noncompleted order has completion time`);
  check(order.lines.length > 0, `${order.orderId}: no lines`);
  let total = 0;
  for (const line of order.lines) {
    check(itemById.has(line.itemId), `${order.orderId}: unknown item ${line.itemId}`);
    check(line.name === itemById.get(line.itemId).name, `${order.orderId}: item name mismatch`);
    check(Number.isSafeInteger(line.unitPriceCopper) && line.unitPriceCopper >= 0, `${order.orderId}: invalid price`);
    check(Number.isSafeInteger(line.quantity) && line.quantity > 0 && line.quantity <= 100, `${order.orderId}: invalid quantity`);
    check(line.lineTotalCopper === line.unitPriceCopper * line.quantity, `${order.orderId}: invalid line total`);
    total += line.lineTotalCopper;
  }
  check(Number.isSafeInteger(total) && order.totalCopper === total, `${order.orderId}: invalid order total`);
}

function report(from, to, regionId) {
  utc(from, 'report.from'); utc(to, 'report.to');
  check(from < to, 'empty report interval');
  const matching = orders.filter((order) => order.status === 'completed' && order.completedAt >= from && order.completedAt < to && (!regionId || order.regionId === regionId));
  return {
    orderIds: matching.map((order) => order.orderId).sort(),
    customerSubs: [...new Set(matching.map((order) => order.ownerSub))].sort(),
    orderCount: matching.length,
    customerCount: new Set(matching.map((order) => order.ownerSub)).size,
    salesCopper: matching.reduce((sum, order) => sum + order.totalCopper, 0)
  };
}
const { from, to } = oracle.period;
check(oracle.period.status === 'completed' && oracle.period.dateField === 'completedAt' && oracle.period.bounds === 'from-inclusive-to-exclusive', 'reporting policy mismatch');
const overall = report(from, to);
for (const key of ['orderCount', 'customerCount', 'salesCopper']) check(overall[key] === oracle.overall[key], `overall ${key} differs from oracle`);
unique(oracle.regions.map((entry) => entry.regionId), 'oracle region');
check(oracle.regions.length === geo.features.length, 'oracle must cover every region');
for (const entry of oracle.regions) {
  check(regionById.has(entry.regionId), `oracle unknown region ${entry.regionId}`);
  const actual = report(from, to, entry.regionId);
  for (const key of ['orderIds', 'customerSubs', 'orderCount', 'customerCount', 'salesCopper']) check(JSON.stringify(actual[key]) === JSON.stringify(entry[key]), `${entry.regionId} ${key} differs from oracle`);
}
for (const entry of oracle.boundaryChecks) {
  const actual = report(entry.from, entry.to);
  check(JSON.stringify(actual.orderIds) === JSON.stringify(entry.orderIds) && actual.salesCopper === entry.salesCopper, `boundary check ${entry.from} differs`);
}
const snapshot = oracle.snapshotCheck;
const line = orders.find((order) => order.orderId === snapshot.orderId)?.lines.find((entry) => entry.itemId === snapshot.itemId);
check(line?.unitPriceCopper === snapshot.unitPriceCopper && itemById.get(snapshot.itemId)?.priceCopper === snapshot.currentCatalogPriceCopper && snapshot.unitPriceCopper !== snapshot.currentCatalogPriceCopper, 'historical price snapshot check differs');
check(regionAt([-120.5, 44.5]) === 'waterdeep' && regionAt([-119.5, 44.5]) === undefined, 'west/south inclusive, east/north exclusive boundary rule differs');

console.log(`PASS: ${identities.length} identities, ${geo.features.length} regions, ${orders.length} orders; September ${overall.orderCount} completed orders / ${overall.salesCopper} copper / ${overall.customerCount} customers`);

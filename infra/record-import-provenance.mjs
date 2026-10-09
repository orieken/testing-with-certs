import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sourceRoot = '/source';
const targetRoot = '/work';
const sourceShop = 'apps/ye-olde-magic-shop/';
const sourceMock = 'apps/mock-api/';
const files = [];
const add = (source, target) => files.push({ source, target });

for (const name of ['index.html', 'LICENSE', 'NOTICE', 'src/main.ts', 'src/App.vue',
  'src/styles.css', 'src/router/index.ts', 'src/views/ShopHome.vue',
  'src/views/ItemPage.vue', 'src/views/CartView.vue', 'src/views/LocationsView.vue',
  'src/components/ItemCard.vue', 'src/stores/cartStore.ts', 'public/favicon.svg',
  'public/logo.png']) {
  add(sourceShop + name, 'apps/magic-shop/' + name);
}
for (const name of ['HomePage.ts', 'ProductDetailsPage.ts', 'CartPage.ts']) {
  add(sourceShop + 'lib/site/' + name, 'testing/site/' + name);
}
for (const name of ['inventory-list.feature', 'item-details.feature', 'cart.feature']) {
  add(sourceShop + 'features/' + name, 'testing/cucumber/features/' + name);
}
for (const name of ['LICENSE', 'NOTICE']) {
  add(sourceShop + name, 'testing/' + name);
  add(sourceMock + name, 'apps/magic-shop/public/images/' + name);
}
add(sourceMock + 'data/items.json', 'seed/catalog-items.json');
for (const name of ['vorpal-sword', 'cloak-shadows', 'wand-embers', 'holy-avenger',
  'boots-speed', 'staff-power', 'potion-healing', 'ring-truth', 'amulet-health',
  'deck-many-things', 'eye-vecna', 'hand-vecna', 'sphere-annihilation',
  'bag-holding']) {
  add(sourceMock + 'public/images/' + name + '.png',
    'apps/magic-shop/public/images/' + name + '.png');
}

const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const records = files.map(({ source, target }) => ({
  source,
  sourceSha256: digest(join(sourceRoot, source)),
  target,
  targetSha256: digest(join(targetRoot, target)),
  modifiedAfterCopy: digest(join(sourceRoot, source)) !== digest(join(targetRoot, target))
}));
const result = {
  sourceRepository: 'saturday-monorepo',
  sourceHead: process.env.SATURDAY_SOURCE_HEAD,
  sourceWorkingTreeCaveat: 'HEAD does not assert every source file was committed or clean; hashes identify exact copied inputs.',
  copiedFiles: records
};
if (!result.sourceHead) throw new Error('SATURDAY_SOURCE_HEAD is required');
writeFileSync(join(targetRoot, 'docs/import-provenance.json'), JSON.stringify(result, null, 2) + '\n');

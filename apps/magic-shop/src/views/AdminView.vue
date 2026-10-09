<template>
  <section class="space-y-7">
    <header><h2 class="text-3xl">Shop administration</h2><p class="text-gray-400">Orders, customers, completed sales, and local follow-up notes.</p></header>
    <p v-if="auth.identity.value?.role !== 'shop-admin'" role="alert">Shop administrator access is required.</p>
    <template v-else>
      <div class="panel grid sm:grid-cols-3 gap-3">
        <label>Region<select v-model="regionId" class="field"><option value="">All regions</option><option v-for="region in regions?.features ?? []" :key="region.properties.regionId" :value="region.properties.regionId">{{ region.properties.name }}</option></select></label>
        <label>From (UTC)<input v-model="fromDate" type="date" class="field" /></label><label>To (exclusive, UTC)<input v-model="toDate" type="date" class="field" /></label>
        <button class="action" @click="load">Refresh report</button>
      </div>
      <p v-if="error" role="alert" class="text-red-300">{{ error }}</p><p v-if="loading" role="status">Loading administration data…</p>
      <section class="panel"><h3 class="text-xl">Completed sales</h3><p class="text-gray-400 text-sm">Orders are grouped by their saved order region, using completed orders and a half-open UTC date range.</p>
        <template v-if="sales"><p class="text-2xl mt-3">{{ goldDisplay(sales.salesCopper) }} gp · {{ sales.orderCount }} orders · {{ sales.customerCount }} customers</p>
          <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Region</th><th>Orders</th><th>Customers</th><th>Sales</th></tr></thead><tbody><tr v-for="row in sales.regions" :key="row.regionId"><td>{{ row.regionId }}</td><td>{{ row.orderCount }}</td><td>{{ row.customerCount }}</td><td>{{ goldDisplay(row.salesCopper) }} gp</td></tr></tbody></table></div></template>
        <p v-else-if="!loading">Sales service is unavailable.</p>
      </section>
      <section class="panel"><h3 class="text-xl">Regions</h3><RegionMap v-if="regions" :regions="regions" :sales="sales" :selected-region="regionId" @select="regionId = $event" /><p v-else>Region map is unavailable.</p><p class="text-sm text-gray-400">Select a region on the map or with the filter above. The table remains available without the map.</p></section>
      <section class="panel"><h3 class="text-xl">Customers</h3><p v-if="usersError" role="alert">{{ usersError }}</p><p v-else-if="!users.length">No customers in this view.</p>
        <div v-if="users.length" class="overflow-x-auto"><table class="data-table"><thead><tr><th>Name</th><th>Subject</th><th>Current region</th></tr></thead><tbody><tr v-for="user in users" :key="user.sub"><td>{{ user.displayName }}</td><td>{{ user.sub }}</td><td>{{ user.regionId }}</td></tr></tbody></table></div>
        <button v-if="usersCursor" class="action mt-3" @click="moreUsers">Load more customers</button>
      </section>
      <section class="panel"><h3 class="text-xl">Orders</h3><p v-if="ordersError" role="alert">{{ ordersError }}</p><p v-else-if="!orders.length">No orders in this view.</p><div v-if="orders.length" class="overflow-x-auto"><table class="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Region</th><th>Status</th><th>Total</th></tr></thead><tbody><tr v-for="order in orders" :key="order.orderId"><td>{{ order.orderId }}</td><td>{{ order.ownerSub }}</td><td>{{ order.regionId }}</td><td>{{ order.status }}</td><td>{{ goldDisplay(order.totalCopper) }} gp</td></tr></tbody></table></div><button v-if="ordersCursor" class="action mt-3" @click="moreOrders">Load more orders</button></section>
      <section v-if="regionId" class="panel"><h3 class="text-xl">Customers who ordered in {{ regionId }}</h3><p v-if="regionalError" role="alert">{{ regionalError }}</p><div class="overflow-x-auto" v-if="regionalCustomers.length"><table class="data-table"><thead><tr><th>Customer</th><th>Orders</th><th>Sales</th></tr></thead><tbody><tr v-for="row in regionalCustomers" :key="row.sub"><td>{{ row.displayName }}</td><td>{{ row.orderCount }}</td><td>{{ goldDisplay(row.salesCopper) }} gp</td></tr></tbody></table></div><p v-else-if="!regionalError">No regional customers.</p><h4 class="mt-5">Completed regional orders</h4><p v-if="!regionalOrders.length && !regionalError">No completed orders.</p><div v-if="regionalOrders.length" class="overflow-x-auto"><table class="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Completed</th><th>Total</th></tr></thead><tbody><tr v-for="row in regionalOrders" :key="row.orderId"><td>{{ row.orderId }}</td><td>{{ row.ownerSub }}</td><td>{{ row.completedAt }}</td><td>{{ goldDisplay(row.totalCopper) }} gp</td></tr></tbody></table></div></section>
      <section class="panel"><h3 class="text-xl">Follow-ups</h3><p class="text-gray-400 text-sm">Local notes only; no customer message is sent.</p><p v-if="followUpsError" role="alert">{{ followUpsError }}</p>
        <form class="grid sm:grid-cols-3 gap-3 my-3" @submit.prevent="addFollowUp"><label>Customer subject<input v-model.trim="newCustomerSub" required class="field" /></label><label>Region<input v-model.trim="newRegionId" required class="field" /></label><label>Note<textarea v-model.trim="newNote" required maxlength="2000" class="field" /></label><button class="action" :disabled="saving">Add note</button></form>
        <p v-if="!followUps.length && !followUpsError">No follow-ups.</p><div v-for="note in followUps" :key="note.followUpId" class="border-t border-gray-600 py-3"><strong>{{ note.customerSub }}</strong> · {{ note.regionId }} · {{ note.status }}<p>{{ note.note }}</p><button class="text-dnd-gold underline" :disabled="saving" @click="toggleFollowUp(note)">Mark {{ note.status === 'open' ? 'done' : 'open' }}</button></div><button v-if="followUpsCursor" class="action" @click="moreFollowUps">Load more follow-ups</button>
      </section>
    </template>
  </section>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';
import { auth } from '../auth/session';
import { getAdminUsers, getAdminOrders, type Profile, type Order } from '../api/customer';
import { getRegions, getSales, getRegionalCustomers, getRegionalOrders, getFollowUps, createFollowUp, updateFollowUp, type RegionCollection, type SalesSummary, type FollowUp } from '../api/insights';
import type { components as Insights } from '../../../../contracts/generated/insights';
import { goldDisplay } from '../format/money';
import RegionMap from '../components/RegionMap.vue';
const fromDate = ref('2025-01-01'), toDate = ref('2027-01-01'), regionId = ref('');
const regions = ref<RegionCollection | null>(null), sales = ref<SalesSummary | null>(null), users = ref<Profile[]>([]), orders = ref<Order[]>([]), followUps = ref<FollowUp[]>([]);
const regionalCustomers = ref<Insights['schemas']['RegionalCustomer'][]>([]), regionalOrders = ref<Insights['schemas']['RegionalOrder'][]>([]);
const usersCursor = ref<string | null>(null), ordersCursor = ref<string | null>(null), followUpsCursor = ref<string | null>(null);
const error = ref(''), usersError = ref(''), ordersError = ref(''), regionalError = ref(''), followUpsError = ref(''), loading = ref(false), saving = ref(false);
const newCustomerSub = ref(''), newRegionId = ref(''), newNote = ref(''); let generation = 0, regionalGeneration = 0;
watch(() => auth.identity.value?.subject, subject => { ++generation; regions.value = sales.value = null; users.value = []; orders.value = []; followUps.value = []; if (subject && auth.identity.value?.role === 'shop-admin') void load(); }, { immediate: true });
watch(regionId, () => { if (auth.identity.value?.role === 'shop-admin') void load(); });
async function load() {
  const current = ++generation; loading.value = true; error.value = usersError.value = ordersError.value = followUpsError.value = '';
  const from = `${fromDate.value}T00:00:00Z`, to = `${toDate.value}T00:00:00Z`;
  const results = await Promise.allSettled([getRegions(), getSales(from, to, regionId.value || undefined), getAdminUsers(regionId.value || undefined), getAdminOrders(regionId.value || undefined), getFollowUps(regionId.value || undefined)]);
  if (current !== generation) return;
  const [r, s, u, o, f] = results;
  if (r.status === 'fulfilled') regions.value = r.value; else error.value = 'Region service is unavailable.';
  if (s.status === 'fulfilled') sales.value = s.value; else { sales.value = null; error.value = 'Sales service is unavailable.'; }
  if (u.status === 'fulfilled') { users.value = u.value.items; usersCursor.value = u.value.nextCursor; } else usersError.value = 'Customer list is unavailable.';
  if (o.status === 'fulfilled') { orders.value = o.value.items; ordersCursor.value = o.value.nextCursor; } else ordersError.value = 'Admin orders are unavailable.';
  if (f.status === 'fulfilled') { followUps.value = f.value.items; followUpsCursor.value = f.value.nextCursor; } else followUpsError.value = 'Follow-ups are unavailable.';
  loading.value = false; if (regionId.value) void loadRegional();
}
async function loadRegional() { const current = ++regionalGeneration, id = regionId.value; regionalCustomers.value = []; regionalOrders.value = []; regionalError.value = ''; if (!id) return; const from = `${fromDate.value}T00:00:00Z`, to = `${toDate.value}T00:00:00Z`; const result = await Promise.allSettled([getRegionalCustomers(from, to, id), getRegionalOrders(from, to, id)]); if (current !== regionalGeneration || id !== regionId.value || from !== `${fromDate.value}T00:00:00Z` || to !== `${toDate.value}T00:00:00Z`) return; if (result[0].status === 'fulfilled') regionalCustomers.value = result[0].value.items; else regionalError.value = 'Regional customer report is unavailable.'; if (result[1].status === 'fulfilled') regionalOrders.value = result[1].value.items; else regionalError.value = 'Regional order report is unavailable.'; }
async function moreUsers() { if (!usersCursor.value) return; try { const page = await getAdminUsers(regionId.value || undefined, usersCursor.value); users.value.push(...page.items); usersCursor.value = page.nextCursor; } catch { usersError.value = 'Could not load more customers.'; } }
async function moreOrders() { if (!ordersCursor.value) return; try { const page = await getAdminOrders(regionId.value || undefined, ordersCursor.value); orders.value.push(...page.items); ordersCursor.value = page.nextCursor; } catch { ordersError.value = 'Could not load more orders.'; } }
async function moreFollowUps() { if (!followUpsCursor.value) return; try { const page = await getFollowUps(regionId.value || undefined, followUpsCursor.value); followUps.value.push(...page.items); followUpsCursor.value = page.nextCursor; } catch { followUpsError.value = 'Could not load more notes.'; } }
async function addFollowUp() { saving.value = true; try { const note = await createFollowUp({ customerSub: newCustomerSub.value, regionId: newRegionId.value, note: newNote.value }); followUps.value.unshift(note); newNote.value = ''; followUpsError.value = ''; } catch { followUpsError.value = 'Could not save follow-up.'; } finally { saving.value = false; } }
async function toggleFollowUp(note: FollowUp) { saving.value = true; try { const updated = await updateFollowUp(note.followUpId, { status: note.status === 'open' ? 'done' : 'open' }); followUps.value = followUps.value.map(row => row.followUpId === updated.followUpId ? updated : row); followUpsError.value = ''; } catch { followUpsError.value = 'Could not update follow-up.'; } finally { saving.value = false; } }
</script>

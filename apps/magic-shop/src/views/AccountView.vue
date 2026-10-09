<template>
  <section class="space-y-8">
    <header><h2 class="text-3xl font-magical text-dnd-parchment">Your account</h2><p class="text-gray-400">Profile, orders, and dashboard preferences for the certificate you selected.</p></header>
    <p v-if="!auth.identity.value" role="status">Sign in with your certificate to see your account.</p>
    <template v-else>
      <section class="panel"><h3 class="text-xl text-dnd-gold">Profile</h3>
        <p v-if="profileError" role="alert" class="text-red-300">{{ profileError }}</p>
        <p v-if="profileLoading" role="status">Loading profile…</p>
        <form v-if="profile" class="grid gap-3 max-w-lg mt-3" @submit.prevent="saveProfile">
          <label>Display name <input v-model.trim="displayName" required maxlength="80" class="field" /></label>
          <label>Region <input v-model.trim="regionId" required maxlength="80" class="field" /></label>
          <p class="text-sm text-gray-400">Location: {{ profile.location.join(', ') }} (longitude, latitude)</p>
          <button class="action" :disabled="saving">Save profile</button><p v-if="profileSaved" role="status">Profile saved.</p>
        </form>
      </section>
      <section class="panel"><h3 class="text-xl text-dnd-gold">Your orders</h3>
        <p v-if="ordersError" role="alert" class="text-red-300">{{ ordersError }}</p><p v-if="ordersLoading" role="status">Loading orders…</p>
        <p v-else-if="!orders.length && !ordersError">No orders yet.</p>
        <div v-else class="overflow-x-auto"><table class="data-table"><thead><tr><th>Order</th><th>Created</th><th>Region</th><th>Status</th><th>Total</th></tr></thead><tbody><tr v-for="order in orders" :key="order.orderId"><td>{{ order.orderId }}</td><td>{{ order.createdAt }}</td><td>{{ order.regionId }}</td><td>{{ order.status }}</td><td>{{ goldDisplay(order.totalCopper) }} gp</td></tr></tbody></table></div>
        <button v-if="nextCursor" class="action mt-3" @click="loadMore">Load more orders</button>
      </section>
      <section class="panel"><h3 class="text-xl text-dnd-gold">Dashboard widgets</h3>
        <p v-if="widgetsError" role="alert" class="text-red-300">{{ widgetsError }}</p><p v-if="widgetsLoading" role="status">Loading widgets…</p>
        <form v-if="widgets" class="mt-3" @submit.prevent="saveWidgets">
          <label v-for="id in allowedWidgets" :key="id" class="flex gap-2 items-center mb-2"><input v-model="selectedWidgets" type="checkbox" :value="id" />{{ widgetLabels[id] }}</label>
          <button class="action mt-2" :disabled="saving">Save widgets</button><p v-if="widgetsSaved" role="status">Widget layout saved.</p>
        </form>
      </section>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { auth } from '../auth/session';
import { getProfile, updateProfile, getOrders, getWidgets, putWidgets, type Profile, type Order, type WidgetLayout } from '../api/customer';
import { goldDisplay } from '../format/money';
const widgetLabels = { 'recent-orders': 'Recent orders', 'total-sales': 'Total sales', 'sales-by-region': 'Sales by region', 'recent-admin-orders': 'Recent admin orders', 'customer-list': 'Customer list' } as const;
type WidgetId = WidgetLayout['widgetIds'][number];
const allowedWidgets = computed<WidgetId[]>(() => auth.identity.value?.role === 'shop-admin' ? Object.keys(widgetLabels) as WidgetId[] : ['recent-orders']);
const profile = ref<Profile | null>(null), orders = ref<Order[]>([]), widgets = ref<WidgetLayout | null>(null);
const displayName = ref(''), regionId = ref(''), selectedWidgets = ref<WidgetId[]>([]), nextCursor = ref<string | null>(null);
const profileError = ref(''), ordersError = ref(''), widgetsError = ref('');
const profileLoading = ref(false), ordersLoading = ref(false), widgetsLoading = ref(false), saving = ref(false), profileSaved = ref(false), widgetsSaved = ref(false);
let generation = 0;
watch(() => auth.identity.value?.subject, async subject => {
  const current = ++generation; profile.value = null; orders.value = []; widgets.value = null; nextCursor.value = null;
  profileError.value = ordersError.value = widgetsError.value = ''; if (!subject) return;
  profileLoading.value = ordersLoading.value = widgetsLoading.value = true;
  const results = await Promise.allSettled([getProfile(), getOrders(), getWidgets()]); if (current !== generation) return;
  const [p, o, w] = results;
  if (p.status === 'fulfilled') { profile.value = p.value; displayName.value = p.value.displayName; regionId.value = p.value.regionId; } else profileError.value = 'Profile service is unavailable.';
  if (o.status === 'fulfilled') { orders.value = o.value.items; nextCursor.value = o.value.nextCursor; } else ordersError.value = 'Order service is unavailable.';
  if (w.status === 'fulfilled') { widgets.value = w.value; selectedWidgets.value = w.value.widgetIds.filter(id => allowedWidgets.value.includes(id)); } else widgetsError.value = 'Widget service is unavailable.';
  profileLoading.value = ordersLoading.value = widgetsLoading.value = false;
}, { immediate: true });
async function saveProfile() { if (!profile.value) return; saving.value = true; profileSaved.value = false; try { profile.value = await updateProfile({ displayName: displayName.value, regionId: regionId.value }); profileSaved.value = true; profileError.value = ''; } catch { profileError.value = 'Could not save profile.'; } finally { saving.value = false; } }
async function loadMore() { if (!nextCursor.value) return; ordersLoading.value = true; try { const page = await getOrders(nextCursor.value); orders.value.push(...page.items); nextCursor.value = page.nextCursor; } catch { ordersError.value = 'Could not load more orders.'; } finally { ordersLoading.value = false; } }
async function saveWidgets() { saving.value = true; widgetsSaved.value = false; try { widgets.value = await putWidgets({ widgetIds: selectedWidgets.value.filter(id => allowedWidgets.value.includes(id)) }); widgetsSaved.value = true; widgetsError.value = ''; } catch { widgetsError.value = 'Could not save widgets.'; } finally { saving.value = false; } }
</script>

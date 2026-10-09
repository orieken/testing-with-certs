<template>
  <div>
    <div class="mb-8 border-b border-dnd-slate pb-4">
      <h2 class="text-3xl font-magical text-dnd-parchment">Wares for Sale</h2>
      <p class="text-gray-400 mt-2">Browse our collection of legendary artifacts and magical trinkets.</p>
    </div>
    <p v-if="!auth.identity.value" class="mb-6 text-dnd-parchment">Sign in with your certificate to browse the shop.</p>
    <form v-else class="mb-5 flex flex-wrap gap-3" @submit.prevent="searchItems"><label class="sr-only" for="shop-search">Search items</label><input id="shop-search" v-model.trim="search" class="field max-w-sm" maxlength="100" placeholder="Search wares by name" /><button class="action">Search</button></form>
    <p v-if="error" role="alert" class="mb-6 text-red-300">{{ error }}</p>
    <p v-else-if="loading" role="status" class="mb-6 text-gray-400">Loading wares...</p>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <ItemCard v-for="it in items" :key="it.id" :item="it" />
    </div>
    <p v-if="auth.identity.value && !loading && !error && !items.length" role="status">No wares found.</p>
    <button v-if="nextCursor" class="action mt-6" :disabled="loading" @click="loadMore">Load more wares</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { fetchItemPage } from '../api/items';
import type { Item } from '../api/items';
import ItemCard from '../components/ItemCard.vue';
import { auth } from '../auth/session';

const items = ref<Item[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const search = ref(''); const nextCursor = ref<string | null>(null);

let requestGeneration = 0;
watch(() => auth.identity.value?.subject, async subject => {
  const generation = ++requestGeneration;
  items.value = [];
  search.value = ''; nextCursor.value = null;
  error.value = null;
  if (!subject) { loading.value = false; return; }
  loading.value = true;
  try {
    const result = await fetchItemPage();
    if (generation === requestGeneration) { items.value = result.items; nextCursor.value = result.nextCursor; }
  } catch {
    if (generation === requestGeneration) error.value = 'Catalog is unavailable.';
  } finally {
    if (generation === requestGeneration) loading.value = false;
  }
}, { immediate: true });
async function searchItems() { const generation = ++requestGeneration; items.value = []; nextCursor.value = null; error.value = null; loading.value = true; try { const page = await fetchItemPage(search.value); if (generation === requestGeneration) { items.value = page.items; nextCursor.value = page.nextCursor; } } catch { if (generation === requestGeneration) error.value = 'Catalog is unavailable.'; } finally { if (generation === requestGeneration) loading.value = false; } }
async function loadMore() { if (!nextCursor.value) return; const generation = requestGeneration; loading.value = true; try { const page = await fetchItemPage(search.value, nextCursor.value); if (generation === requestGeneration) { items.value.push(...page.items); nextCursor.value = page.nextCursor; } } catch { if (generation === requestGeneration) error.value = 'Could not load more wares.'; } finally { if (generation === requestGeneration) loading.value = false; } }
</script>

<template>
  <section class="space-y-7"><header><h2 class="text-3xl">Inventory</h2><p class="text-gray-400">Manage the public catalog. Archived items remain on historical orders.</p></header>
    <p v-if="!canManage" role="alert">Shopkeeper or shop administrator access is required.</p>
    <template v-else><p v-if="error" role="alert" class="text-red-300">{{ error }}</p><p v-if="message" role="status">{{ message }}</p>
      <form class="panel grid sm:grid-cols-2 gap-3" @submit.prevent="save"><h3 class="sm:col-span-2 text-xl">{{ editingId ? 'Edit item' : 'Add item' }}</h3>
        <label>Name<input v-model.trim="form.name" required maxlength="120" class="field" /></label>
        <label>Rarity<select v-model="form.rarity" class="field"><option v-for="rarity in rarities" :key="rarity">{{ rarity }}</option></select></label>
        <label class="sm:col-span-2">Description<textarea v-model.trim="form.description" required maxlength="2000" class="field" /></label>
        <label>Local image path<input v-model.trim="form.image" required pattern="/.*" class="field" /></label>
        <label>Price (copper)<input v-model.number="form.priceCopper" type="number" required min="0" step="1" class="field" /></label>
        <label>Category ID<input v-model.trim="form.categoryId" class="field" /></label><label>Display stock<input v-model.number="form.displayStock" type="number" min="0" step="1" class="field" /></label>
        <div class="flex gap-3"><button class="action" :disabled="saving">{{ editingId ? 'Save changes' : 'Create item' }}</button><button v-if="editingId" type="button" class="action" @click="reset">Cancel</button></div>
      </form>
      <div class="panel"><h3 class="text-xl">Active items</h3><p v-if="loading" role="status">Loading inventory…</p><p v-else-if="!items.length && !error">No active items.</p>
        <div v-for="item in items" :key="item.id" class="border-t border-gray-600 py-3 flex flex-wrap gap-3 justify-between"><div><strong>{{ item.name }}</strong> · {{ goldDisplay(item.priceCopper) }} gp</div><div class="flex gap-3"><button class="text-dnd-gold underline" @click="edit(item)">Edit</button><button class="text-red-300 underline" :disabled="saving" @click="archive(item)">Archive</button></div></div>
      </div>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { auth } from '../auth/session';
import { fetchItems, createItem, updateItem, archiveItem, type Item, type ItemCreate } from '../api/items';
import { goldDisplay } from '../format/money';
const rarities = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'] as const;
const canManage = computed(() => ['shopkeeper', 'shop-admin'].includes(auth.identity.value?.role ?? ''));
const items = ref<Item[]>([]), error = ref(''), message = ref(''), loading = ref(false), saving = ref(false), editingId = ref('');
const form = reactive<ItemCreate>({ name: '', description: '', rarity: 'Common', image: '/', priceCopper: 0, categoryId: '', displayStock: 0 });
let generation = 0;
watch(() => auth.identity.value?.subject, () => { ++generation; items.value = []; if (canManage.value) void load(); }, { immediate: true });
async function load() { const current = ++generation; loading.value = true; try { const result = await fetchItems(); if (current === generation) { items.value = result; error.value = ''; } } catch { if (current === generation) error.value = 'Catalog service is unavailable.'; } finally { if (current === generation) loading.value = false; } }
function reset() { editingId.value = ''; Object.assign(form, { name: '', description: '', rarity: 'Common', image: '/', priceCopper: 0, categoryId: '', displayStock: 0 }); }
function edit(item: Item) { editingId.value = item.id; Object.assign(form, { name: item.name, description: item.description ?? '', rarity: item.rarity ?? 'Common', image: item.image ?? '/', priceCopper: item.priceCopper, categoryId: item.categoryId ?? '', displayStock: item.displayStock ?? 0 }); }
async function save() { if (!Number.isSafeInteger(form.priceCopper) || form.priceCopper < 0) { error.value = 'Enter a valid price in copper.'; return; } saving.value = true; try { const body: ItemCreate = { ...form }; if (!body.categoryId) delete body.categoryId; if (editingId.value) await updateItem(editingId.value, body); else await createItem(body); message.value = editingId.value ? 'Item updated.' : 'Item created.'; error.value = ''; reset(); await load(); } catch { error.value = 'Could not save item.'; } finally { saving.value = false; } }
async function archive(item: Item) { if (!window.confirm(`Archive ${item.name}?`)) return; saving.value = true; try { await archiveItem(item.id); message.value = 'Item archived.'; error.value = ''; await load(); } catch { error.value = 'Could not archive item.'; } finally { saving.value = false; } }
</script>

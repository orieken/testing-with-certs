<template>
  <div v-if="item" class="max-w-4xl mx-auto">
    <router-link to="/" class="inline-flex items-center text-dnd-gold hover:text-dnd-parchment mb-6 transition-colors">
      <span class="mr-2">←</span> Back to Shop
    </router-link>
    
    <div class="bg-dnd-slate border border-gray-700 rounded-lg overflow-hidden shadow-2xl flex flex-col md:flex-row">
      <div class="md:w-1/2 bg-gray-900 p-8 flex items-center justify-center">
        <img v-if="item.image" :src="item.image" :alt="item.name" class="max-w-full max-h-[400px] object-contain drop-shadow-2xl" />
      </div>
      
      <div class="md:w-1/2 p-8 flex flex-col">
        <div class="flex justify-between items-start mb-4">
          <h2 class="text-4xl font-magical text-dnd-parchment">{{ item.name }}</h2>
          <span class="px-3 py-1 rounded text-sm font-bold border border-gray-600"
           :class="{
             'text-gray-400': item.rarity === 'Common',
             'text-green-400': item.rarity === 'Uncommon',
             'text-blue-400': item.rarity === 'Rare',
             'text-purple-400': item.rarity === 'Very Rare',
             'text-orange-400': item.rarity === 'Legendary',
             'text-dnd-gold': item.rarity === 'Artifact'
           }">
            {{ item.rarity }}
          </span>
        </div>
        
        <div class="text-2xl text-dnd-gold font-bold mb-6">{{ goldDisplay(item.priceCopper) }} gp</div>
        
        <div class="prose prose-invert mb-8">
          <h3 class="text-lg font-magical text-gray-300 mb-2">Description</h3>
          <p class="text-gray-400 leading-relaxed">{{ item.description }}</p>
        </div>
        
        <div class="mt-auto pt-6 border-t border-gray-700">
          <button 
            @click="add"
            class="w-full bg-dnd-crimson hover:bg-red-700 text-white py-3 rounded font-magical text-lg transition-colors shadow-lg active:transform active:scale-[0.98] cursor-pointer"
            data-testid="add-to-cart-btn"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="text-center py-20" role="status">
    <div class="text-2xl font-magical text-gray-500">{{ loading ? 'Summoning item details...' : error }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { fetchItemById, type Item } from '../api/items';
import { useCartStore } from '../stores/cartStore';
import { goldDisplay } from '../format/money';
import { auth } from '../auth/session';

const route = useRoute();
const id = computed(() => String(route.params.id ?? ''));
const item = ref<Item | null>(null);
const loading = ref(true);
const error = ref('Item unavailable.');
const qty = ref(1);
const cart = useCartStore();

let requestGeneration = 0;
watch([() => auth.identity.value?.subject, id], async ([subject, itemId]) => {
  const generation = ++requestGeneration;
  item.value = null;
  if (!subject) {
    loading.value = false;
    error.value = 'Sign in with your certificate to view item details.';
    return;
  }
  error.value = 'Item unavailable.';
  loading.value = true;
  try {
    const result = await fetchItemById(itemId);
    if (generation === requestGeneration) item.value = result;
  } catch {
    if (generation === requestGeneration) error.value = 'Catalog is unavailable in this preview.';
  } finally {
    if (generation === requestGeneration) loading.value = false;
  }
}, { immediate: true });
function add() { if (!item.value) return; cart.addItem(item.value, Math.max(1, qty.value)); alert('Added'); }
</script>

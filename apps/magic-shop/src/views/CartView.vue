<template>
  <div class="max-w-4xl mx-auto">
    <h2 class="text-3xl font-magical text-dnd-parchment mb-8 border-b border-dnd-slate pb-4">Your Loot Stash</h2>
    <p v-if="createdOrder" role="status" class="panel mb-6">Order {{ createdOrder.orderId }} created. Total: {{ goldDisplay(createdOrder.totalCopper) }} gp.</p>
    
    <div v-if="items.length" class="space-y-6">
      <div v-for="e in items" :key="e.id" class="bg-dnd-slate border border-gray-700 rounded-lg p-6 flex flex-col md:flex-row items-center justify-between shadow-lg" data-testid="cart-item">
        <div class="flex-1 mb-4 md:mb-0">
          <h3 class="text-xl font-magical text-dnd-gold mb-1" data-testid="cart-item-name">{{ e.name }}</h3>
          <div class="text-gray-400 text-sm" data-testid="cart-item-price">{{ goldDisplay(e.priceCopperSnapshot) }} gp each</div>
        </div>
        
        <div class="flex items-center gap-6">
          <div class="flex items-center bg-gray-900 rounded-lg border border-gray-700 p-1">
            <button 
              @click="cart.setQuantity(e.id, e.quantity - 1)"
              class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              data-testid="decrease-qty-btn"
            >
              -
            </button>
            <span class="w-12 text-center font-bold text-dnd-parchment" data-testid="cart-item-qty">{{ e.quantity }}</span>
            <button 
              @click="cart.setQuantity(e.id, e.quantity + 1)"
              class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              data-testid="increase-qty-btn"
            >
              +
            </button>
          </div>
          
          <div class="text-xl font-bold text-dnd-gold min-w-[100px] text-right" data-testid="cart-item-total">
            {{ goldDisplay(e.priceCopperSnapshot * e.quantity) }} gp
          </div>
          
          <button 
            @click="cart.removeItem(e.id)"
            class="text-gray-500 hover:text-dnd-crimson transition-colors p-2"
            title="Remove from cart"
            data-testid="remove-item-btn"
          >
            <span class="text-xl">×</span>
          </button>
        </div>
      </div>

      <div class="bg-dnd-dark border border-dnd-slate rounded-lg p-6 mt-8">
        <div class="flex justify-between items-center mb-6">
          <span class="text-xl text-gray-400">Total Value</span>
          <span class="text-3xl font-magical text-dnd-gold" data-testid="cart-total">{{ goldDisplay(totalPriceCopper) }} gp</span>
        </div>
        
        <form class="grid gap-3 max-w-md" @submit.prevent="checkout">
          <label>Order region<input v-model.trim="regionId" class="field" required maxlength="80" /></label>
          <p class="text-sm text-gray-400">This is a simulated order. The server sets current prices; no payment or stock reservation occurs.</p>
          <button class="action" :disabled="busy || !auth.identity.value">Place simulated order</button>
          <p v-if="checkoutError" role="alert" class="text-red-300">{{ checkoutError }}</p>
        </form>
      </div>
    </div>
    
    <div v-else class="text-center py-20 bg-dnd-slate/30 rounded-lg border border-dnd-slate border-dashed">
      <div class="text-6xl mb-4">🕸️</div>
      <h3 class="text-2xl font-magical text-gray-400 mb-2" data-testid="cart-empty">Your stash is empty</h3>
      <p class="text-gray-500 mb-8" data-testid="cart-empty-message">Go forth and acquire some magical artifacts!</p>
      <router-link
        to="/"
        class="inline-block bg-dnd-slate hover:bg-gray-700 text-dnd-parchment px-6 py-3 rounded border border-gray-600 transition-colors"
        data-testid="return-to-shop-btn"
      >
        Return to Shop
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useCartStore } from '../stores/cartStore';
import { goldDisplay } from '../format/money';
import { nextTick, ref, watch } from 'vue';
import { auth } from '../auth/session';
import { createOrder, getProfile, type Order } from '../api/customer';

const cart = useCartStore();
const { itemsArray, totalPriceCopper } = storeToRefs(cart);
const items = itemsArray;
const regionId = ref(''), busy = ref(false), checkoutError = ref(''), createdOrder = ref<Order | null>(null);
const attemptKey = ref<string | null>(null);
watch(() => auth.identity.value?.subject, async subject => { regionId.value = ''; createdOrder.value = null; checkoutError.value = ''; attemptKey.value = null; if (subject) { try { regionId.value = (await getProfile()).regionId; } catch { /* Customer can enter the region manually. */ } } }, { immediate: true });
watch(itemsArray, () => { attemptKey.value = null; createdOrder.value = null; }, { deep: true });
async function checkout() {
  if (!auth.identity.value || !items.value.length || !regionId.value) return;
  busy.value = true; checkoutError.value = '';
  const key = attemptKey.value ?? crypto.randomUUID(); attemptKey.value = key;
  try { const order = await createOrder({ regionId: regionId.value, lines: items.value.map(item => ({ itemId: item.id, quantity: item.quantity })) }, key); cart.clearCart(); await nextTick(); createdOrder.value = order; attemptKey.value = null; }
  catch { checkoutError.value = 'Order service is unavailable. Your cart is still here; retry when it is ready.'; }
  finally { busy.value = false; }
}
</script>

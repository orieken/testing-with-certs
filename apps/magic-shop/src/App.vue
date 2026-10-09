<template>
  <div class="app min-h-screen flex flex-col">
    <header class="bg-dnd-dark border-b border-dnd-slate shadow-lg sticky top-0 z-50">
      <div class="container mx-auto px-4 py-4 flex justify-between items-center">
        <router-link to="/" class="flex items-center gap-4 hover:opacity-90 transition-opacity">
          <img src="/logo.png" alt="Ye Olde Magic Shop Logo" class="w-12 h-12 object-contain drop-shadow-md" />
          <h1 class="text-2xl font-bold tracking-wider text-dnd-gold drop-shadow-md">Ye Olde Magic Shop</h1>
        </router-link>
        <nav aria-label="Shop" class="flex flex-wrap gap-4 text-dnd-parchment font-magical items-center">
          <router-link to="/" class="hover:text-dnd-gold transition-colors text-lg" data-testid="shop-link">Shop</router-link>
          <router-link to="/locations" class="hover:text-dnd-gold transition-colors text-lg" data-testid="locations-link">Locations</router-link>
          <router-link to="/cart" class="hover:text-dnd-gold transition-colors text-lg flex items-center gap-2" data-testid="cart-link">
            <span>Cart</span>
            <span v-if="totalItems > 0" class="bg-dnd-crimson text-white text-xs rounded-full px-2 py-0.5 font-sans" data-testid="cart-count">{{ totalItems }}</span>
          </router-link>
          <router-link v-if="auth.identity.value" to="/account" class="hover:text-dnd-gold">Account</router-link>
          <router-link v-if="auth.identity.value?.role === 'shopkeeper' || auth.identity.value?.role === 'shop-admin'" to="/inventory" class="hover:text-dnd-gold">Inventory</router-link>
          <router-link v-if="auth.identity.value?.role === 'shop-admin'" to="/admin" class="hover:text-dnd-gold">Admin</router-link>
          <span v-if="auth.identity.value" class="text-sm font-sans" data-testid="signed-in-user">
            {{ auth.identity.value.username }} · {{ roleLabel }}
          </span>
          <button v-if="auth.identity.value" type="button" class="text-dnd-gold hover:text-white font-sans" :disabled="auth.busy.value" @click="signOut">
            Sign out
          </button>
          <button v-else type="button" class="text-dnd-gold hover:text-white font-sans" :disabled="auth.busy.value" @click="signIn">
            {{ auth.busy.value ? 'Connecting…' : 'Sign in with certificate' }}
          </button>
        </nav>
      </div>
    </header>

    <main class="container mx-auto px-4 py-8 flex-1">
      <p v-if="auth.error.value" role="alert" class="mb-6 rounded border border-dnd-crimson bg-dnd-dark p-4 text-red-200">
        {{ auth.error.value }}
      </p>
      <router-view />
    </main>

    <footer class="bg-dnd-dark border-t border-dnd-slate py-6 mt-auto">
      <div class="container mx-auto px-4 text-center text-gray-500 text-sm">
        &copy; 2025 Dungeon Master Supplies Co.
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, watch } from 'vue';
import { useCartStore } from './stores/cartStore';
import { auth, signIn, signOut } from './auth/session';

const cart = useCartStore();
const { totalItems } = storeToRefs(cart);
const roleLabel = computed(() => ({ customer: 'Customer', shopkeeper: 'Shopkeeper', 'shop-admin': 'Shop admin' })[auth.identity.value?.role ?? 'customer']);

watch(() => auth.identity.value?.subject, subject => {
  if (subject) cart.hydrate(subject);
  else cart.items = {};
}, { immediate: true });
</script>

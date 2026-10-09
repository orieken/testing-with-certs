<template>
  <div class="card bg-dnd-slate border border-gray-700 rounded-lg overflow-hidden shadow-lg hover:shadow-xl hover:border-dnd-gold transition-all duration-300 group flex flex-col h-full" data-testid="item-card">
    <div class="relative h-48 overflow-hidden bg-gray-900 group-hover:opacity-90 transition-opacity">
      <router-link :to="`/item/${item.id}`" class="block h-full w-full">
        <img v-if="item.image"
          :src="item.image" 
          :alt="item.name"
          class="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500" 
        />
      </router-link>
      <div class="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold border border-gray-600"
           :class="{
             'text-gray-400': item.rarity === 'Common',
             'text-green-400': item.rarity === 'Uncommon',
             'text-blue-400': item.rarity === 'Rare',
             'text-purple-400': item.rarity === 'Very Rare',
             'text-orange-400': item.rarity === 'Legendary',
             'text-dnd-gold': item.rarity === 'Artifact'
           }">
        {{ item.rarity || 'Common' }}
      </div>
    </div>
    
    <div class="p-4 flex flex-col flex-1">
      <div class="flex justify-between items-start mb-2">
        <router-link :to="`/item/${item.id}`" class="font-magical text-lg font-bold text-dnd-parchment group-hover:text-dnd-gold transition-colors line-clamp-1" data-testid="item-name">
          {{ item.name }}
        </router-link>
      </div>
      
      <p class="text-sm text-gray-400 mb-4 line-clamp-2 flex-1">{{ item.description }}</p>
      
      <div class="flex justify-between items-center mt-auto pt-4 border-t border-gray-700">
        <span class="text-dnd-gold font-bold text-lg" data-testid="item-price">{{ goldDisplay(item.priceCopper) }} gp</span>
        <button 
          @click.prevent="add"
          class="bg-dnd-crimson hover:bg-red-700 text-white px-4 py-2 rounded font-magical text-sm transition-colors shadow-md active:transform active:scale-95 cursor-pointer"
          data-testid="add-to-cart-btn"
        >
          Add to Cart
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Item } from '../api/items';
import { defineProps } from 'vue';
import { useCartStore } from '../stores/cartStore';
import { goldDisplay } from '../format/money';
const props = defineProps<{ item: Item }>();
const cart = useCartStore(); function add(){ cart.addItem(props.item,1); }
</script>

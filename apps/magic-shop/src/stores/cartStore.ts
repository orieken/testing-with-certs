import { defineStore } from 'pinia';
import type { Item } from '../api/items';
import { auth } from '../auth/session';

const storageKey = (subject: string): string => `dnd_cart_v3:${subject}`;

export type CartEntry = { id: string; name: string; priceCopperSnapshot: number; quantity: number };

export const useCartStore = defineStore('cart', {
  state: () => ({ items: {} as Record<string, CartEntry> }),
  getters: {
    itemsArray: (state): CartEntry[] => Object.values(state.items),
    totalItems: (state): number => Object.values(state.items).reduce((s, e) => s + e.quantity, 0),
    totalPriceCopper: (state): number => Object.values(state.items).reduce((s, e) => s + e.quantity * e.priceCopperSnapshot, 0)
  },
  actions: {
    hydrate(subject: string) {
      this.items = {};
      try {
        const raw = localStorage.getItem(storageKey(subject));
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length > 100) return;
        const valid = parsed.every((entry: unknown) => {
          if (typeof entry !== 'object' || entry === null) return false;
          const item = entry as Record<string, unknown>;
          return typeof item.id === 'string' && typeof item.name === 'string' &&
            typeof item.priceCopperSnapshot === 'number' && Number.isSafeInteger(item.priceCopperSnapshot) && item.priceCopperSnapshot >= 0 &&
            typeof item.quantity === 'number' && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 99;
        });
        if (!valid) return;
        this.items = (parsed as CartEntry[]).reduce((acc, entry) => { acc[entry.id] = entry; return acc; }, {} as Record<string, CartEntry>);
      } catch { this.items = {}; }
    },
    persist() {
      const subject = auth.identity.value?.subject;
      if (!subject) return;
      try { localStorage.setItem(storageKey(subject), JSON.stringify(Object.values(this.items))); } catch { /* Cart is best-effort until checkout exists. */ }
    },
    addItem(item: Item, qty = 1) {
      const existing = this.items[item.id];
      const quantity = Math.min(99, Math.max(1, Math.floor(qty)));
      if (existing) existing.quantity = Math.min(99, existing.quantity + quantity);
      else this.items[item.id] = { id: item.id, name: item.name, priceCopperSnapshot: item.priceCopper, quantity };
      this.persist();
    },
    removeItem(id: string) { delete this.items[id]; this.persist(); },
    setQuantity(id: string, q: number) { if (!this.items[id]) return; const n = Math.min(99, Math.max(0, Math.floor(q))); if (n<=0) delete this.items[id]; else this.items[id].quantity = n; this.persist(); },
    clearCart() { this.items = {}; this.persist(); }
  }
});

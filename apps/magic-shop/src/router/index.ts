import { createRouter, createWebHistory } from 'vue-router';
import ShopHome from '../views/ShopHome.vue';
import ItemPage from '../views/ItemPage.vue';
import CartView from '../views/CartView.vue';
import LocationsView from '../views/LocationsView.vue';
import AccountView from '../views/AccountView.vue';
import AdminView from '../views/AdminView.vue';
import InventoryView from '../views/InventoryView.vue';

const routes = [
  { path: '/', component: ShopHome },
  { path: '/item/:id', component: ItemPage, props: true },
  { path: '/cart', component: CartView },
  { path: '/locations', component: LocationsView },
  { path: '/account', component: AccountView },
  { path: '/inventory', component: InventoryView },
  { path: '/admin', component: AdminView }
];

export default createRouter({ history: createWebHistory(), routes });

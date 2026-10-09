import type { components } from '../../../../contracts/generated/customer';
import { apiJson, query } from './http';

export type Profile = components['schemas']['Profile'];
export type Order = components['schemas']['Order'];
export type WidgetLayout = components['schemas']['WidgetLayout'];
export const getProfile = () => apiJson<Profile>('/api/customer/me');
export const updateProfile = (patch: components['schemas']['ProfilePatch']) => apiJson<Profile>('/api/customer/me', { method: 'PATCH', body: patch });
export const getOrders = (cursor?: string) => apiJson<components['schemas']['OrderPage']>(query('/api/customer/orders', { limit: 25, cursor }));
export const createOrder = (request: components['schemas']['CheckoutRequest'], key: string) => apiJson<Order>('/api/customer/orders', { method: 'POST', body: request, idempotencyKey: key });
export const getWidgets = () => apiJson<WidgetLayout>('/api/customer/me/widgets');
export const putWidgets = (layout: WidgetLayout) => apiJson<WidgetLayout>('/api/customer/me/widgets', { method: 'PUT', body: layout });
export const getAdminUsers = (regionId?: string, cursor?: string) => apiJson<components['schemas']['ProfilePage']>(query('/api/customer/admin/users', { limit: 25, regionId, cursor }));
export const getAdminOrders = (regionId?: string, cursor?: string) => apiJson<components['schemas']['OrderPage']>(query('/api/customer/admin/orders', { limit: 25, regionId, cursor }));

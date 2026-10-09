import type { components } from '../../../../contracts/generated/insights';
import { apiJson, query } from './http';

export type RegionCollection = components['schemas']['RegionCollection'];
export type SalesSummary = components['schemas']['SalesSummary'];
export type FollowUp = components['schemas']['FollowUp'];
export const getRegions = () => apiJson<RegionCollection>('/api/insights/regions');
export const getSales = (from: string, to: string, regionId?: string) => apiJson<SalesSummary>(query('/api/insights/sales', { from, to, regionId }));
export const getRegionalCustomers = (from: string, to: string, regionId: string, cursor?: string) => apiJson<components['schemas']['RegionalCustomerPage']>(query('/api/insights/customers', { from, to, regionId, limit: 25, cursor }));
export const getRegionalOrders = (from: string, to: string, regionId: string, cursor?: string) => apiJson<components['schemas']['RegionalOrderPage']>(query('/api/insights/orders', { from, to, regionId, limit: 25, cursor }));
export const getFollowUps = (regionId?: string, cursor?: string) => apiJson<components['schemas']['FollowUpPage']>(query('/api/insights/follow-ups', { regionId, limit: 25, cursor }));
export const createFollowUp = (body: components['schemas']['FollowUpCreate']) => apiJson<FollowUp>('/api/insights/follow-ups', { method: 'POST', body });
export const updateFollowUp = (id: string, body: components['schemas']['FollowUpPatch']) => apiJson<FollowUp>(`/api/insights/follow-ups/${encodeURIComponent(id)}`, { method: 'PATCH', body });

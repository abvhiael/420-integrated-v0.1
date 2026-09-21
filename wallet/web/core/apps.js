import { GENESIS_APP_CATEGORIES, GENESIS_APP_SERVICES } from './genesis-app-catalog.js';

export const APP_SERVICES = GENESIS_APP_SERVICES;
export const APP_CATEGORIES = GENESIS_APP_CATEGORIES;

export function buildAppCatalog(services = []) {
  return services.map((service) => {
    const meta = APP_SERVICES.find((entry) => entry.serviceId === service.serviceId) || {};
    return {
      ...meta,
      ...service,
      category: meta.category || service.category || 'utility',
      description: meta.description || service.description || 'Verified 420 ecosystem application.',
      featured: meta.featured === true,
      verified: service.available === true,
    };
  });
}

export function filterAppCatalog(apps, { query = '', category = 'all' } = {}) {
  const normalizedQuery = String(query).trim().toLowerCase();
  const normalizedCategory = String(category || 'all').toLowerCase();
  return apps.filter((app) => {
    const categoryMatch = normalizedCategory === 'all' || app.category === normalizedCategory;
    if (!categoryMatch) return false;
    if (!normalizedQuery) return true;
    return `${app.name} ${app.description} ${app.category}`.toLowerCase().includes(normalizedQuery);
  });
}

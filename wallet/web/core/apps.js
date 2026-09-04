export const APP_SERVICES = Object.freeze([
  { id: 'swap', name: '420 Swap', serviceId: '420/service/swap/v1', category: 'defi', description: 'Native asset exchange for the 420 ecosystem.', featured: true },
  { id: 'explorer', name: '420 Explorer', serviceId: '420/service/explorer/v1', category: 'utility', description: 'Explore blocks, transactions, contracts and addresses.', featured: true },
  { id: 'ai', name: '420 AI', serviceId: '420/service/ai/v1', category: 'utility', description: 'Verified gateway to distributed 420 AI services.', featured: true },
  { id: 'registry', name: '420 Registry', serviceId: '420/service/registry/v1', category: 'identity', description: 'Canonical registry and ecosystem records.' },
  { id: 'names', name: '420 Names', serviceId: '420/service/names/v1', category: 'identity', description: 'Human-readable names for 420 accounts and services.' },
  { id: 'identity', name: '420 Identity', serviceId: '420/service/identity/v1', category: 'identity', description: 'Identity and account attestation tools.' },
  { id: 'search', name: '420 Search', serviceId: '420/service/search/v1', category: 'utility', description: 'Search verified 420 ecosystem resources.' },
  { id: 'appstore', name: '420 AppStore', serviceId: '420/service/appstore/v1', category: 'utility', description: 'Discover published applications in the 420 ecosystem.' },
  { id: 'token', name: '420 Token', serviceId: '420/service/token/v1', category: 'utility', description: 'Token creation and asset management tools.' },
  { id: 'bridge', name: '420 Bridge', serviceId: '420/service/bridge/v1', category: 'defi', description: 'Verified cross-chain asset and attestation gateway.' },
  { id: 'stake', name: '420 Stake', serviceId: '420/service/stake/v1', category: 'defi', description: 'Validator and staking access for the 420 network.' },
  { id: 'governance', name: '420 Governance', serviceId: '420/service/governance/v1', category: 'governance', description: 'View proposals and participate in network governance.' },
  { id: 'town', name: '420 Town', serviceId: '420/service/town/v1', category: 'social', description: 'Encrypted social and community access.' },
  { id: 'status', name: '420 Status', serviceId: '420/service/status/v1', category: 'utility', description: 'Network and ecosystem service health.' },
  { id: 'developers', name: 'Developer Hub', serviceId: '420/service/developers/v1', category: 'developer', description: 'Documentation, guides, contracts and developer resources.' },
]);

export const APP_CATEGORIES = Object.freeze(['all', 'defi', 'identity', 'social', 'utility', 'governance', 'developer']);

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

// Canonical Wallet-visible Genesis service catalogue.
// Every serviceId in this file must exist in contracts/src/libraries/ServiceIds420.sol.
// Availability and launch URLs still come exclusively from a verified ecosystem manifest.
export const GENESIS_APP_SERVICES = Object.freeze([
  { id: 'registry', name: '420 Registry', serviceId: '420/service/protocol-registry/v1', category: 'infrastructure', description: 'Canonical protocol and service discovery for the 420 ecosystem.', featured: true },
  { id: 'explorer', name: '420 Explorer', serviceId: '420/service/explorer/v1', category: 'utility', description: 'Explore blocks, transactions, contracts and canonical network state.', featured: true },
  { id: 'search', name: '420 Search', serviceId: '420/service/search/v1', category: 'utility', description: 'Search verified public chain, protocol and ecosystem resources.', featured: true },
  { id: 'analytics', name: '420 Analytics', serviceId: '420/service/analytics/v1', category: 'utility', description: 'Verified analytics and network/application metrics.' },
  { id: 'appstore', name: '420 AppStore', serviceId: '420/service/appstore/v1', category: 'utility', description: 'Discover registered applications in the 420 ecosystem.' },
  { id: 'verify', name: '420 Verify', serviceId: '420/service/verify/v1', category: 'infrastructure', description: 'Reproducible deployed-contract source verification.' },
  { id: 'notifications', name: '420 Notifications', serviceId: '420/service/notifications/v1', category: 'utility', description: 'Opt-in alerts for wallet, chain, protocol and application events.' },
  { id: 'names', name: '420 Names', serviceId: '420/service/names/v1', category: 'identity', description: 'Human-readable names for 420 accounts and services.' },
  { id: 'identity', name: '420 Identity', serviceId: '420/service/identity/v1', category: 'identity', description: 'Identity and account attestation tools.' },
  { id: 'arbitration', name: '420 Arbitration', serviceId: '420/service/arbitration/v1', category: 'governance', description: 'Dispute evidence, resolver and ruling coordination.' },
  { id: 'commons', name: '420 Commons', serviceId: '420/service/commons/v1', category: 'social', description: 'Shared community coordination and commons services.' },
  { id: 'pulse', name: '420 Pulse', serviceId: '420/service/pulse/v1', category: 'social', description: 'Canonical social graph and community activity routing.' },
  { id: 'messenger', name: '420 Messenger', serviceId: '420/service/messenger/v1', category: 'social', description: 'Verified messaging and communication services.' },
  { id: 'treasury', name: '420 Treasury', serviceId: '420/service/treasury/v1', category: 'finance', description: 'Treasury coordination and protocol fund routing.' },
  { id: 'grants', name: '420 Grants', serviceId: '420/service/grants/v1', category: 'finance', description: 'Grant discovery, funding and lifecycle coordination.' },
  { id: 'launchpad', name: '420 Launchpad', serviceId: '420/service/launchpad/v1', category: 'finance', description: 'Launch and community-funding coordination for ecosystem projects.' },
  { id: 'token', name: '420 Token', serviceId: '420/service/token/v1', category: 'finance', description: 'Token creation and asset management tools.' },
  { id: 'resource', name: '420 Resource Protocol', serviceId: '420/service/resource-protocol/v1', category: 'infrastructure', description: 'Resource discovery and provider-neutral protocol routing.' },
  { id: 'market', name: '420 Market', serviceId: '420/service/market/v1', category: 'finance', description: 'Canonical marketplace and commerce service discovery.' },
  { id: 'rights', name: '420 Rights', serviceId: '420/service/rights/v1', category: 'governance', description: 'Rights, licensing and entitlement coordination.' },
  { id: 'swap', name: '420 Swap', serviceId: '420/service/swap/v1', category: 'finance', description: 'Native asset exchange for the 420 ecosystem.', featured: true },
  { id: 'pay', name: '420 Pay', serviceId: '420/service/pay/v1', category: 'finance', description: 'Canonical payment initiation and settlement access.', featured: true },
  { id: 'bridge', name: '420 Bridge', serviceId: '420/service/bridge/v1', category: 'finance', description: 'Verified cross-chain asset and attestation gateway.' },
  { id: 'stake', name: '420 Stake', serviceId: '420/service/stake/v1', category: 'finance', description: 'Validator and staking access for the 420 network.' },
  { id: 'governance', name: '420 Governance', serviceId: '420/service/governance/v1', category: 'governance', description: 'View proposals and participate in network governance.' },
  { id: 'ai', name: '420 AI', serviceId: '420/service/ai/v1', category: 'compute', description: 'Verified gateway to distributed 420 AI services.', featured: true },
  { id: 'compute', name: '420 Compute', serviceId: '420/service/compute-market/v1', category: 'compute', description: 'Distributed compute market, provider discovery and job routing.' },
  { id: 'attention', name: '420 Attention', serviceId: '420/service/attention/v1', category: 'social', description: 'Opt-in sponsor-funded attention and reward coordination.' },
  { id: 'cannaseur', name: '420 Cannaseur', serviceId: '420/service/cannaseur/v1', category: 'social', description: 'Cannabis community discovery and attention-economy experiences.' },
  { id: 'status', name: '420 Status', serviceId: '420/service/status/v1', category: 'utility', description: 'Network and ecosystem service health.' },
]);

export const GENESIS_APP_CATEGORIES = Object.freeze([
  'all', 'finance', 'identity', 'social', 'compute', 'utility', 'governance', 'infrastructure',
]);

export const NON_CANONICAL_WALLET_ALIASES = Object.freeze([
  { id: 'town', serviceId: '420/service/town/v1', reason: 'not present in ServiceIds420.sol; canonical social surfaces are Pulse, Commons and Messenger' },
  { id: 'developers', serviceId: '420/service/developers/v1', reason: 'Developer Hub is documentation/navigation, not a canonical Genesis protocol service ID' },
  { id: 'registry-legacy', serviceId: '420/service/registry/v1', reason: 'canonical Registry service ID is 420/service/protocol-registry/v1' },
]);

export const MISSING_CANONICAL_SERVICE_IDS_FOR_NAMED_GENESIS_PRODUCTS = Object.freeze([
  { name: '420 Exchange', status: 'NO_DISTINCT_CANONICAL_SERVICE_ID', currentCanonicalCoverage: ['420/service/swap/v1', '420/service/bridge/v1'] },
  { name: '420 Commerce', status: 'NO_DISTINCT_CANONICAL_SERVICE_ID', currentCanonicalCoverage: ['420/service/market/v1', '420/service/pay/v1'] },
  { name: '420 Grow', status: 'NO_CANONICAL_SERVICE_ID' },
]);

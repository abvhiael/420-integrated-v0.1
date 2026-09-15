const SCHEMA_VERSION = '1.0.0';

export class DashboardModelError420 extends Error {
  constructor(message) { super(message); this.name = 'DashboardModelError420'; }
}

function assert420(condition, message) { if (!condition) throw new DashboardModelError420(message); }

export function createDashboardSnapshot420({ network, contracts, guides }) {
  assert420(network && typeof network === 'object', 'network is required');
  assert420(contracts && typeof contracts.list === 'function', 'contract catalogue is required');
  assert420(Array.isArray(guides), 'guides must be an array');
  assert420(typeof network.chainIdDecimal === 'string', 'network chainId is required');
  assert420(contracts.chainIdDecimal === network.chainIdDecimal, 'dashboard network/catalogue chain mismatch');

  const services = ['explorer','indexer','verify','status','faucet'].map((name) => {
    let url = null;
    try { url = network.service(name); } catch { url = null; }
    return Object.freeze({ name, url, configured: Boolean(url) });
  });

  const contractRows = contracts.list().map((entry) => Object.freeze({
    name: entry.name,
    protocol: entry.protocol,
    address: entry.address,
    version: entry.version,
    source: entry.source,
    verified: entry.verified === true
  }));

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    generatedFromCanonicalConfiguration: true,
    canonicalAuthority: false,
    network: Object.freeze({
      name: network.name,
      environment: network.environment,
      chainId: network.chainIdDecimal,
      nativeCurrency: network.nativeCurrency,
      rpc: Object.freeze([...network.rpc.http]),
      canRequestFaucet: network.canRequestFaucet,
      isProduction: network.isProduction
    }),
    services: Object.freeze(services),
    contracts: Object.freeze(contractRows),
    guides: Object.freeze(guides.map((guide) => Object.freeze({
      id: guide.id,
      title: guide.title,
      summary: guide.summary,
      document: guide.document
    }))),
    surfaces: Object.freeze({
      deployment: Object.freeze({ phase: 'DEVHUB-9', authority: 'external signer + canonical RPC', executableHere: false }),
      verification: Object.freeze({ phase: 'DEVHUB-10', authority: '420Verify', executableHere: false }),
      indexer: Object.freeze({ phase: 'DEVHUB-11', authority: '420Indexer projection', canonical: false }),
      publishing: Object.freeze({ phase: 'DEVHUB-13', authority: '420Registry governance + non-canonical AppStore', executableHere: false })
    }),
    securityRule: 'Dashboard is a read/orchestration surface only. It must not sign, grant capabilities, register applications, classify verification, or authorize protocol state transitions.'
  });
}

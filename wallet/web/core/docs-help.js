export function resolveWalletHelp(bundle, contextualId, environment, versionIntent = 'current') {
  if (!bundle || typeof bundle !== 'object') return { available: false, reason: 'invalid-bundle' };
  const id = String(contextualId || '');
  if (!id.startsWith('CTX-WALLET-')) return { available: false, reason: 'invalid-contextual-id' };
  if (versionIntent !== 'current') return { available: false, reason: 'unsupported-version-intent' };
  if (bundle.cross_environment_fallback !== false || bundle.cross_release_fallback !== false) return { available: false, reason: 'unsafe-fallback-policy' };
  if (!Array.isArray(bundle.published_environments) || !bundle.published_environments.includes(environment)) return { available: false, reason: 'environment-unpublished' };
  const target = bundle.records && bundle.records[id];
  if (typeof target !== 'string') return { available: false, reason: 'contextual-id-unavailable' };
  const base = String(bundle.canonical_base_url || '');
  if (!base.startsWith('https://') || !base.endsWith('/')) return { available: false, reason: 'invalid-production-target' };
  let route = target;
  if (route.endsWith('/index.md')) route = route.slice(0, -8);
  else if (route.endsWith('.md')) route = route.slice(0, -3) + '/';
  return { available: true, contextualId: id, environment, versionIntent, url: base + 'versions/' + environment + '/current/' + route, authority: 'documentation-navigation-only' };
}

export async function loadWalletHelpBundle(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl('./docs-context.json', { cache: 'no-store' });
  if (!response || !response.ok) return null;
  const bundle = await response.json();
  return bundle && typeof bundle === 'object' ? bundle : null;
}

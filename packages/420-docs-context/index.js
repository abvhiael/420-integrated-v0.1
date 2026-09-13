export function resolveGenesisDappHelp(bundle, surface, contextualId, environment, versionIntent = 'current') {
  if (!bundle || typeof bundle !== 'object') return { available: false, reason: 'invalid-bundle' };
  if (versionIntent !== 'current') return { available: false, reason: 'unsupported-version-intent' };
  if (bundle.cross_environment_fallback !== false || bundle.cross_release_fallback !== false) return { available: false, reason: 'unsafe-fallback-policy' };
  if (!Array.isArray(bundle.published_environments) || !bundle.published_environments.includes(environment)) return { available: false, reason: 'environment-unpublished' };
  const app = bundle.applications && bundle.applications[String(surface || '')];
  if (!app) return { available: false, reason: 'surface-unavailable' };
  if (!Array.isArray(app.environments) || !app.environments.includes(environment)) return { available: false, reason: 'surface-environment-unavailable' };
  const id = String(contextualId || '');
  const target = app.records && app.records[id];
  if (typeof target !== 'string') return { available: false, reason: 'contextual-id-unavailable' };
  const base = String(bundle.canonical_base_url || '');
  if (!base.startsWith('https://') || !base.endsWith('/')) return { available: false, reason: 'invalid-production-target' };
  return {
    available: true,
    surface,
    contextualId: id,
    environment,
    versionIntent,
    url: `${base}versions/${environment}/current/${target}`,
    authority: 'documentation-navigation-only'
  };
}

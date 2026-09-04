const SAFE_PROTOCOLS = new Set(['https:', 'http:']);

export function normalizeService(service) {
  if (!service || typeof service !== 'object') throw new TypeError('service required');
  if (!service.serviceId || !service.name) throw new Error('service identity required');
  if (!service.url) return { ...service, available: false, url: null };
  const parsed = new URL(service.url);
  if (!SAFE_PROTOCOLS.has(parsed.protocol)) throw new Error(`unsupported service protocol: ${parsed.protocol}`);
  if (parsed.username || parsed.password) throw new Error('service URL credentials are not permitted');
  return { ...service, available: true, url: parsed.toString() };
}

export function resolveServices(manifest, requiredServices) {
  if (!manifest || manifest.schema !== '420-ecosystem-manifest-v1') {
    throw new Error('unsupported or missing signed ecosystem manifest');
  }
  if (manifest.verified !== true) throw new Error('ecosystem manifest is not verified');

  const entries = new Map();
  for (const service of manifest.services || []) {
    const normalized = normalizeService(service);
    if (entries.has(normalized.serviceId)) throw new Error(`duplicate ecosystem service id: ${normalized.serviceId}`);
    entries.set(normalized.serviceId, normalized);
  }

  return requiredServices.map((required) => {
    const resolved = entries.get(required.serviceId);
    if (!resolved) return { ...required, available: false, url: null };
    // Preserve canonical wallet metadata. A verified manifest may publish availability and URL,
    // but it cannot rename or re-identify a required wallet service.
    return {
      ...resolved,
      ...required,
      available: resolved.available === true,
      url: resolved.url,
    };
  });
}

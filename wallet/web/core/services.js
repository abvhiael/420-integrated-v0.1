const SAFE_PROTOCOLS = new Set(['https:', 'http:']);

export function normalizeService(service) {
  if (!service || typeof service !== 'object') throw new TypeError('service required');
  if (!service.serviceId || !service.name) throw new Error('service identity required');
  if (!service.url) return { ...service, available: false, url: null };
  const parsed = new URL(service.url);
  if (!SAFE_PROTOCOLS.has(parsed.protocol)) throw new Error(`unsupported service protocol: ${parsed.protocol}`);
  return { ...service, available: true, url: parsed.toString() };
}

export function resolveServices(manifest, requiredServices) {
  if (!manifest || manifest.schema !== '420-ecosystem-manifest-v1') {
    throw new Error('unsupported or missing signed ecosystem manifest');
  }
  if (manifest.verified !== true) throw new Error('ecosystem manifest is not verified');

  const entries = new Map((manifest.services || []).map((service) => [service.serviceId, normalizeService(service)]));
  return requiredServices.map((required) => {
    const resolved = entries.get(required.serviceId);
    return resolved ? { ...required, ...resolved } : { ...required, available: false, url: null };
  });
}

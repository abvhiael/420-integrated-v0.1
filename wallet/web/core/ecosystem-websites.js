// Presentation-only shortcuts requested for the 420Integrated ecosystem.
// These are website destinations, NOT Registry-approved service identities or wallet permissions.
// Their deployment/availability is not inferred from this catalogue.
export const ECOSYSTEM_WEBSITES = Object.freeze([
  Object.freeze({ id: '420exchange', name: '420Exchange', category: 'finance', description: 'Exchange trading website', url: 'https://420exchange.420integrated.org/' }),
  Object.freeze({ id: 'bonggoggles', name: 'BongGoggles', category: 'social', description: 'BongGoggles community website', url: 'https://bonggoggles.420integrated.org/' }),
  Object.freeze({ id: '420travel', name: '420Travel', category: 'utility', description: 'Travel discovery website', url: 'https://420travel.420integrated.org/' }),
  Object.freeze({ id: '20mail', name: '20Mail', category: 'social', description: 'Mail website', url: 'https://20mail.420integrated.org/' }),
  Object.freeze({ id: '420townsquare', name: '420TownSquare', category: 'social', description: 'Community town square', url: 'https://420townsquare.420integrated.org/' }),
  Object.freeze({ id: '420media', name: '420Media', category: 'social', description: 'Media website', url: 'https://420media.420integrated.org/' }),
  Object.freeze({ id: 'puffbuddies', name: 'PuffBuddies', category: 'social', description: 'PuffBuddies community', url: 'https://puffbuddies.420integrated.org/' }),
  Object.freeze({ id: 'doobtube', name: 'DoobTube', category: 'social', description: 'Video sharing website', url: 'https://doobtube.420integrated.org/' }),
  Object.freeze({ id: '420hz', name: '420Hz', category: 'social', description: 'Music and audio website', url: 'https://420hz.420integrated.org/' }),
  Object.freeze({ id: '420grow', name: '420Grow', category: 'utility', description: 'Growing tools and resources', url: 'https://420grow.420integrated.org/' }),
  Object.freeze({ id: 'doobr', name: 'DOOBr', category: 'utility', description: 'DOOBr website', url: 'https://doobr.420integrated.org/' }),
  Object.freeze({ id: 'liftd', name: 'Liftd', category: 'utility', description: 'Liftd website', url: 'https://liftd.420integrated.org/' }),
  Object.freeze({ id: '420bnb', name: '420BnB', category: 'utility', description: 'Accommodation website', url: 'https://420bnb.420integrated.org/' }),
  Object.freeze({ id: '420bet', name: '420Bet', category: 'finance', description: 'Gaming and sports website', url: 'https://420bet.420integrated.org/' }),
]);

export function filterEcosystemWebsites(query = '') {
  const needle = String(query).trim().toLowerCase();
  return ECOSYSTEM_WEBSITES.filter(app => !needle || `${app.name} ${app.category} ${app.description}`.toLowerCase().includes(needle));
}

export function isApprovedEcosystemWebsite(app) {
  if (!ECOSYSTEM_WEBSITES.includes(app)) return false;
  try {
    const url = new URL(app.url);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      url.pathname === '/' && !url.search && !url.hash &&
      url.hostname === `${app.id}.420integrated.org`;
  } catch { return false; }
}

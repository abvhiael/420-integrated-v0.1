// GEN-SVC-2.17: dependency-free, presentation-only 420Location map/list kit.
// `view` must be produced by the trusted location/uikit.Build projection on the server.
// An injected renderer can be MapLibre or any compatible provider. No geolocation,
// tile URLs, access tokens, wallets, or provider requests are embedded in this kit.
export function mountLocationMap(root, view, { renderer = null, onSelect = () => {} } = {}) {
  if (!(root instanceof HTMLElement)) throw new TypeError('a root element is required');
  if (!view || !Array.isArray(view.items) || view.items.length > 500) throw new TypeError('invalid map view');
  if (typeof onSelect !== 'function') throw new TypeError('onSelect must be a function');
  const items = view.items.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name) throw new TypeError('invalid map item');
    if (item.kind !== 'pin' && item.kind !== 'area') throw new TypeError('invalid map precision');
    if (item.kind === 'area' && (item.latitude != null || item.longitude != null)) throw new TypeError('approximate location includes coordinates');
    if (item.kind === 'pin' && (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude) || Math.abs(item.latitude) > 90 || Math.abs(item.longitude) > 180)) throw new TypeError('invalid exact pin');
    return { ...item };
  });
  root.replaceChildren();
  const container = document.createElement('section');
  container.className = 'location-map-kit';
  container.setAttribute('aria-label', 'Places map and list');
  const heading = document.createElement('h2'); heading.textContent = 'Explore places'; container.append(heading);
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const list = document.createElement('ul'); list.className = 'location-map-list'; list.setAttribute('aria-label', 'Places');
  const pins = items.filter(item => item.kind === 'pin');
  const mapRegion = document.createElement('div'); mapRegion.className = 'location-map-canvas'; mapRegion.setAttribute('aria-label', 'Public place map');
  const buttons = new Map();
  let selected = null;
  for (const item of items) {
    const li = document.createElement('li');
    const button = document.createElement('button'); button.type = 'button'; button.textContent = item.name;
    button.setAttribute('aria-pressed', 'false');
    const subtitle = document.createElement('span'); subtitle.className = 'location-map-detail';
    subtitle.textContent = [item.category, item.city, item.region, item.country].filter(Boolean).join(' · ');
    if (item.kind === 'area') subtitle.textContent += ' · approximate area';
    button.addEventListener('click', () => select(item.id));
    li.append(button, subtitle); list.append(li); buttons.set(item.id, button);
  }
  function select(id) {
    const item = items.find(candidate => candidate.id === id);
    if (!item) return;
    selected = id;
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', key === id ? 'true' : 'false');
    status.textContent = `Selected ${item.name}`;
    onSelect({ ...item });
  }
  let disposeRenderer = () => {};
  if (renderer && typeof renderer.mount === 'function' && pins.length) {
    // Never pass approximate-area coordinates to a renderer.
    const result = renderer.mount(mapRegion, pins.map(item => ({ ...item })), { select });
    if (typeof result === 'function') disposeRenderer = result;
    container.append(mapRegion);
  } else {
    status.textContent = 'List view available; map renderer not configured.';
  }
  if (!items.length) status.textContent = 'No public places to display.';
  container.append(status, list); root.append(container);
  return { select, getSelected: () => selected, destroy: () => { disposeRenderer(); root.replaceChildren(); } };
}

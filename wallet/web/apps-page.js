import { APP_CATEGORIES, APP_SERVICES, buildAppCatalog, filterAppCatalog } from './core/apps.js';
import { resolveServices } from './core/services.js';

function installAppsStylesheet() {
  if (document.querySelector('link[data-wallet-apps-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './apps.css';
  link.dataset.walletAppsStyles = 'true';
  document.head.append(link);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function makeAppCard(app) {
  const card = el(app.available ? 'a' : 'article', `app-card${app.available ? '' : ' unavailable'}`);
  if (app.available) {
    card.href = app.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
  } else {
    card.ariaDisabled = 'true';
  }

  const top = el('div', 'app-card-top');
  const mark = el('span', 'app-mark', app.name.replace(/^420\s*/i, '').slice(0, 2).toUpperCase());
  const identity = el('div', 'app-identity');
  identity.append(el('strong', null, app.name), el('span', 'app-category', app.category));
  top.append(mark, identity);

  const description = el('p', 'app-description', app.description);
  const footer = el('div', 'app-card-footer');
  const verification = el('span', `verification-badge ${app.available ? 'verified' : 'unavailable'}`, app.available ? 'Verified' : 'Not published');
  const action = el('span', 'app-open-label', app.available ? 'Open ↗' : 'Unavailable');
  footer.append(verification, action);
  card.append(top, description, footer);
  return card;
}

function ensurePage(section) {
  if (section.dataset.appsPageInitialized === 'true') return;
  section.dataset.appsPageInitialized = 'true';
  section.replaceChildren();

  const heading = el('div', 'section-heading apps-heading');
  const copy = el('div');
  copy.append(el('p', 'eyebrow', 'Verified ecosystem gateway'), el('h2', null, '420 Apps'), el('p', 'muted', 'Launch only services resolved through the verified 420 ecosystem manifest.'));
  const trust = el('span', 'status-pill', 'Fail-closed discovery');
  trust.id = 'apps-trust-state';
  heading.append(copy, trust);

  const controls = el('div', 'apps-controls account-card');
  const search = document.createElement('input');
  search.id = 'apps-search';
  search.type = 'search';
  search.placeholder = 'Search verified apps…';
  search.autocomplete = 'off';
  search.setAttribute('aria-label', 'Search 420 Apps');
  const filters = el('div', 'apps-filters');
  for (const category of APP_CATEGORIES) {
    const button = el('button', `app-filter${category === 'all' ? ' active' : ''}`, category === 'all' ? 'All' : category[0].toUpperCase() + category.slice(1));
    button.type = 'button';
    button.dataset.category = category;
    filters.append(button);
  }
  controls.append(search, filters);

  const featuredHeading = el('div', 'section-heading compact-heading');
  featuredHeading.append(el('div', null), el('span', 'section-kicker', 'Featured verified services'));
  featuredHeading.firstChild.append(el('p', 'eyebrow', 'Featured'), el('h3', null, 'Quick launch'));
  const featured = el('div', 'featured-app-grid');
  featured.id = 'featured-apps';

  const allHeading = el('div', 'section-heading compact-heading');
  allHeading.append(el('div', null), el('span', 'section-kicker', 'Unavailable services remain disabled'));
  allHeading.firstChild.append(el('p', 'eyebrow', 'Catalog'), el('h3', null, 'All ecosystem apps'));
  const grid = el('div', 'app-grid');
  grid.id = 'services';
  grid.setAttribute('aria-live', 'polite');

  const note = el('div', 'apps-verification-note');
  note.innerHTML = '<strong>Verified service discovery</strong><span>Launch links are enabled only after the configured ecosystem manifest passes schema, verification and safe-protocol checks.</span>';

  section.append(heading, controls, featuredHeading, featured, allHeading, grid, note);
}

export async function loadVerifiedApps(fetchImpl = globalThis.fetch) {
  const runtimeResponse = await fetchImpl('./runtime-config.json', { cache: 'no-store' });
  if (!runtimeResponse.ok) throw new Error(`runtime config ${runtimeResponse.status}`);
  const config = await runtimeResponse.json();
  if (!config.manifest?.url) {
    return { apps: buildAppCatalog(APP_SERVICES.map((app) => ({ ...app, available: false, url: null }))), trust: 'Awaiting manifest' };
  }
  const manifestResponse = await fetchImpl(config.manifest.url, { cache: 'no-store' });
  if (!manifestResponse.ok) throw new Error(`ecosystem manifest ${manifestResponse.status}`);
  const resolved = resolveServices(await manifestResponse.json(), APP_SERVICES);
  return { apps: buildAppCatalog(resolved), trust: 'Verified manifest' };
}

export function renderApps(section, apps, { query = '', category = 'all', trust = 'Verified manifest' } = {}) {
  ensurePage(section);
  const featured = section.querySelector('#featured-apps');
  const grid = section.querySelector('#services');
  const trustState = section.querySelector('#apps-trust-state');
  trustState.textContent = trust;
  trustState.dataset.state = trust === 'Verified manifest' ? 'passed' : 'idle';

  const filtered = filterAppCatalog(apps, { query, category });
  featured.replaceChildren(...filtered.filter((app) => app.featured && app.available).slice(0, 3).map(makeAppCard));
  if (!featured.children.length) featured.append(el('p', 'muted', 'No featured verified services match this view.'));

  grid.replaceChildren(...filtered.map(makeAppCard));
  if (!grid.children.length) grid.append(el('p', 'muted', 'No ecosystem apps match this search or category.'));
}

export async function initAppsPage() {
  const section = document.querySelector('#services-section');
  if (!section) return;
  installAppsStylesheet();
  ensurePage(section);

  let apps;
  let trust;
  try {
    ({ apps, trust } = await loadVerifiedApps());
  } catch (error) {
    apps = buildAppCatalog(APP_SERVICES.map((app) => ({ ...app, available: false, url: null })));
    trust = `Discovery blocked: ${error.message}`;
  }

  let category = 'all';
  const search = section.querySelector('#apps-search');
  const refresh = () => renderApps(section, apps, { query: search.value, category, trust });
  search.addEventListener('input', refresh);
  for (const button of section.querySelectorAll('.app-filter')) {
    button.addEventListener('click', () => {
      category = button.dataset.category;
      for (const peer of section.querySelectorAll('.app-filter')) peer.classList.toggle('active', peer === button);
      refresh();
    });
  }
  refresh();

  // app.js may re-render the legacy service grid after connection-state updates.
  // Reassert this verified page without creating a second trust source.
  const observer = new MutationObserver(() => {
    if (!section.querySelector('#apps-search')) {
      observer.disconnect();
      initAppsPage();
    }
  });
  observer.observe(section, { childList: true, subtree: true });
}

if (typeof document !== 'undefined') initAppsPage();

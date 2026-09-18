import { availability, validateRuntimeConfig } from './core/config.js';
import { createStatusBadge } from './core/design-system.js';
import { ROUTES, routeFor } from './core/router.js';

const state = {
  config: null,
  route: routeFor(window.location.pathname),
  bootError: null,
};

const $ = (selector) => document.querySelector(selector);

function navLink(route) {
  const enabled = availability(state.config, route.feature);
  const link = document.createElement('a');
  link.className = `nav-item${state.route.id === route.id ? ' active' : ''}${enabled ? '' : ' unavailable'}`;
  link.href = route.path;
  link.dataset.route = route.path;
  link.textContent = route.label;
  link.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  return link;
}

function renderNavigation() {
  const nav = $('#nav');
  nav.replaceChildren(...ROUTES.map(navLink));
}

function renderRuntime() {
  $('#site-origin').textContent = state.config?.site?.productionOrigin ?? 'unavailable';
  $('#network-name').textContent = state.config?.network?.name ?? 'unavailable';
  $('#api-schema').textContent = state.config ? `v${state.config.api.schemaMajor}.${state.config.api.schemaMinor}` : 'unavailable';
  $('#data-mode').textContent = state.config?.api?.baseUrl ? 'Configured' : 'Read-only shell / endpoints unset';
}

function renderDesignGallery(fragment) {
  const gallery = fragment.querySelector('#status-gallery');
  for (const semanticState of ['canonical', 'finalized', 'stale', 'reorg', 'replacement', 'degraded']) {
    gallery.append(createStatusBadge(document, semanticState));
  }
  fragment.querySelector('#table-status').append(createStatusBadge(document, 'routeHealthy'));
  fragment.querySelector('#table-stale').append(createStatusBadge(document, 'stale', '42s'));
}

function renderView() {
  $('#page-title').textContent = state.route.label;
  const view = $('#app-view');
  view.replaceChildren();

  if (state.bootError) {
    $('#data-state').textContent = 'Degraded';
    $('#data-state').dataset.state = 'error';
    const card = document.createElement('div');
    card.className = 'error-state';
    card.innerHTML = '<strong>Exchange configuration unavailable.</strong><p>The app failed closed. No market or transaction state will be invented locally.</p>';
    view.append(card);
    return;
  }

  $('#data-state').textContent = state.config.api.baseUrl ? 'Configured' : 'Shell only';
  $('#data-state').dataset.state = state.config.api.baseUrl ? 'ready' : 'degraded';

  if (state.route.id === 'markets' && availability(state.config, 'markets')) {
    const fragment = $('#markets-template').content.cloneNode(true);
    renderDesignGallery(fragment);
    view.append(fragment);
    return;
  }

  const fragment = $('#gated-template').content.cloneNode(true);
  fragment.querySelector('#gated-title').textContent = `${state.route.label} is roadmap-gated`;
  fragment.querySelector('#gated-copy').textContent =
    'The route is reserved now so navigation and deep links remain stable, but feature logic stays disabled until its V14 phase qualifies.';
  view.append(fragment);
}

function render() {
  renderNavigation();
  renderRuntime();
  renderView();
}

function navigate(path) {
  state.route = routeFor(path);
  history.pushState({}, '', state.route.path);
  render();
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('[data-route]');
  if (!link) return;
  event.preventDefault();
  navigate(link.dataset.route);
});

window.addEventListener('popstate', () => {
  state.route = routeFor(window.location.pathname);
  render();
});

async function boot() {
  try {
    const response = await fetch('./runtime-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`runtime config ${response.status}`);
    state.config = validateRuntimeConfig(await response.json());
  } catch (error) {
    state.bootError = error;
    state.config = {
      site: { productionOrigin: 'https://exchange.420integrated.org' },
      network: { name: '420 Integrated' },
      api: { schemaMajor: 14, schemaMinor: 0, baseUrl: null },
      features: Object.fromEntries(ROUTES.map((route) => [route.feature, route.id === 'markets'])),
    };
  }
  render();
}

boot();

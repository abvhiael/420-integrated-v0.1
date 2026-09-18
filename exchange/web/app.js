import { availability, validateRuntimeConfig } from './core/config.js';
import { createStatusBadge } from './core/design-system.js';
import { ExchangeDataLayer } from './core/exchange-data.js';
import { Watchlist, filterMarkets, freshnessState, normalizeMarket, sortMarkets } from './core/markets.js';
import { ROUTES, routeFor } from './core/router.js';

const state = {
  config: null,
  route: routeFor(window.location.pathname),
  bootError: null,
  dataLayer: null,
  markets: [],
  marketSource: 'unavailable',
  marketQuery: '',
  marketSort: 'symbol:asc',
  watchOnly: false,
  watchlist: new Watchlist(globalThis.localStorage),
};

const $ = (selector) => document.querySelector(selector);
const formatNumber = (value, maximumFractionDigits = 6) =>
  value === null || value === undefined ? '—' : new Intl.NumberFormat('en-CA', { maximumFractionDigits }).format(value);
const formatChange = (value) => value === null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

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
  $('#nav').replaceChildren(...ROUTES.map(navLink));
}

function renderRuntime() {
  $('#site-origin').textContent = state.config?.site?.productionOrigin ?? 'unavailable';
  $('#network-name').textContent = state.config?.network?.name ?? 'unavailable';
  $('#api-schema').textContent = state.config ? `v${state.config.api.schemaMajor}.${state.config.api.schemaMinor}` : 'unavailable';
  $('#data-mode').textContent = state.marketSource === 'demo'
    ? 'Demo fixtures · clearly non-live'
    : state.config?.api?.baseUrl ? 'Configured V13 read API' : 'Read-only shell / endpoints unset';
}

function currentMarkets() {
  const watched = state.watchlist.values();
  let markets = filterMarkets(state.markets, state.marketQuery);
  if (state.watchOnly) markets = markets.filter((market) => watched.has(market.marketSubjectId));
  const [field, direction] = state.marketSort.split(':');
  return sortMarkets(markets, field, direction);
}

function marketRow(market) {
  const tr = document.createElement('tr');
  tr.dataset.marketSubjectId = market.marketSubjectId;
  const watched = state.watchlist.values().has(market.marketSubjectId);
  const fresh = state.marketSource === 'demo' ? 'degraded' : freshnessState(market, Math.floor(Date.now() / 1000));

  const watch = document.createElement('td');
  const watchButton = document.createElement('button');
  watchButton.type = 'button';
  watchButton.className = 'watch-button';
  watchButton.dataset.watchMarket = market.marketSubjectId;
  watchButton.setAttribute('aria-label', watched ? `Remove ${market.label} from watchlist` : `Add ${market.label} to watchlist`);
  watchButton.setAttribute('aria-pressed', String(watched));
  watchButton.textContent = watched ? '★' : '☆';
  watch.append(watchButton);

  const name = document.createElement('td');
  name.innerHTML = `<strong>${market.label}</strong><small class="market-id">${market.marketSubjectId}</small>`;

  const last = document.createElement('td');
  last.className = 'numeric';
  last.textContent = formatNumber(market.lastPrice, 8);

  const change = document.createElement('td');
  change.className = 'numeric';
  change.textContent = formatChange(market.changePct);
  change.dataset.direction = market.changePct === null ? 'flat' : market.changePct >= 0 ? 'up' : 'down';

  const spread = document.createElement('td');
  spread.className = 'numeric';
  spread.textContent = `${formatNumber(market.bestBid, 8)} / ${formatNumber(market.bestAsk, 8)}`;

  const volume = document.createElement('td');
  volume.className = 'numeric';
  volume.textContent = formatNumber(market.quoteVolume);

  const liquidity = document.createElement('td');
  liquidity.className = 'numeric';
  liquidity.textContent = formatNumber(market.liquidity);

  const route = document.createElement('td');
  route.append(createStatusBadge(document, market.routeHealthy ? 'routeHealthy' : 'routeUnhealthy'));

  const settlement = document.createElement('td');
  settlement.append(createStatusBadge(document, market.settlementHealthy ? 'settlementHealthy' : 'settlementUnhealthy'));

  const freshness = document.createElement('td');
  freshness.append(createStatusBadge(document, fresh === 'canonical' ? 'canonical' : fresh === 'stale' ? 'stale' : 'degraded'));

  tr.append(watch, name, last, change, spread, volume, liquidity, route, settlement, freshness);
  return tr;
}

function renderMarkets(fragment) {
  const rows = fragment.querySelector('#market-rows');
  const visible = currentMarkets();
  rows.replaceChildren(...visible.map(marketRow));
  fragment.querySelector('#market-empty').hidden = visible.length !== 0;
  fragment.querySelector('#market-search').value = state.marketQuery;
  fragment.querySelector('#market-sort').value = state.marketSort;
  fragment.querySelector('#watch-only').checked = state.watchOnly;
  fragment.querySelector('#market-source').textContent = state.marketSource === 'demo'
    ? 'DEMO DATA · not live market state'
    : state.marketSource === 'api'
      ? 'V13 snapshot data'
      : 'No market source configured';
  const watched = state.watchlist.values().size;
  fragment.querySelector('#market-summary').textContent = `${visible.length} market${visible.length === 1 ? '' : 's'} shown · ${watched} watched`;
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

  $('#data-state').textContent = state.marketSource === 'api' ? 'V13 data' : state.marketSource === 'demo' ? 'Demo' : 'Shell only';
  $('#data-state').dataset.state = state.marketSource === 'api' ? 'ready' : 'degraded';

  if (state.route.id === 'markets' && availability(state.config, 'markets')) {
    const fragment = $('#markets-template').content.cloneNode(true);
    renderMarkets(fragment);
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
  if (link) {
    event.preventDefault();
    navigate(link.dataset.route);
    return;
  }
  const watch = event.target.closest('[data-watch-market]');
  if (watch) {
    state.watchlist.toggle(watch.dataset.watchMarket);
    render();
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'market-search') {
    state.marketQuery = event.target.value;
    render();
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'market-sort') {
    state.marketSort = event.target.value;
    render();
  } else if (event.target.id === 'watch-only') {
    state.watchOnly = event.target.checked;
    render();
  }
});

window.addEventListener('popstate', () => {
  state.route = routeFor(window.location.pathname);
  render();
});

async function loadMarketSource() {
  if (state.config.api.baseUrl && Array.isArray(state.config.api.marketSubjects) && state.config.api.marketSubjects.length) {
    state.dataLayer = new ExchangeDataLayer({
      baseUrl: state.config.api.baseUrl,
      streamUrl: state.config.api.streamUrl,
      transport: state.config.api.transport,
    });
    const snapshots = await Promise.all(state.config.api.marketSubjects.map((subjectId) => state.dataLayer.loadSnapshot(subjectId)));
    state.markets = snapshots.map(normalizeMarket);
    state.marketSource = 'api';
    return;
  }

  const response = await fetch('./fixtures/markets.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`demo market fixtures ${response.status}`);
  state.markets = (await response.json()).map(normalizeMarket);
  state.marketSource = 'demo';
}

async function boot() {
  try {
    const response = await fetch('./runtime-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`runtime config ${response.status}`);
    state.config = validateRuntimeConfig(await response.json());
    await loadMarketSource();
  } catch (error) {
    state.bootError = error;
    state.config = state.config ?? {
      site: { productionOrigin: 'https://exchange.420integrated.org' },
      network: { name: '420 Integrated' },
      api: { schemaMajor: 14, schemaMinor: 0, baseUrl: null },
      features: Object.fromEntries(ROUTES.map((route) => [route.feature, route.id === 'markets'])),
    };
  }
  render();
}

boot();

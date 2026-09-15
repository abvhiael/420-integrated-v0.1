const route = document.querySelector('#route-content');
const form = document.querySelector('#global-search');
const input = document.querySelector('#search-input');
const statusPill = document.querySelector('#search-status');
const filters = [...document.querySelectorAll('[data-domain]')];
let activeDomain = '';
let nextCursor = null;
let lastQuery = '';

const esc = (v) => String(v ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const short = (value, left=14, right=10) => {
  const s = String(value ?? '');
  if (s.length <= left + right + 3) return s;
  return `${s.slice(0,left)}…${s.slice(-right)}`;
};

const domainPresentation = {
  block: {label:'Block', icon:'#', family:'chain'},
  transaction: {label:'Transaction', icon:'↔', family:'chain'},
  address: {label:'Address', icon:'@', family:'chain'},
  contract: {label:'Contract', icon:'{}', family:'chain'},
  service: {label:'Service', icon:'S', family:'protocol'},
  name: {label:'420 Name', icon:'.420', family:'identity'},
  public_identity: {label:'Public identity', icon:'ID', family:'identity'},
  asset: {label:'Asset', icon:'A', family:'protocol'},
  validator: {label:'Validator', icon:'V', family:'network'},
  market_listing: {label:'Market listing', icon:'M', family:'ecosystem'},
  rights_record: {label:'Rights record', icon:'R', family:'ecosystem'},
  public_commons: {label:'Public Commons', icon:'C', family:'ecosystem'},
  public_pulse: {label:'Public Pulse', icon:'P', family:'ecosystem'},
};

async function api(path) {
  const response = await fetch(path, {headers:{Accept:'application/json'}, cache:'no-store'});
  let body = null;
  try { body = await response.json(); } catch { body = {error:{message:`HTTP ${response.status}`}}; }
  if (!response.ok) throw new Error(body?.error?.message || `HTTP ${response.status}`);
  return body;
}

function queryText(raw) {
  const q = String(raw || '').trim();
  if (!activeDomain) return q;
  return `domain:${activeDomain} ${q}`;
}

function setNav(name) {
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
}

function renderError(err) {
  route.innerHTML = `<div class="panel error"><strong>Search unavailable</strong><p>${esc(err.message)}</p></div>`;
}

function presentationFor(result) {
  return domainPresentation[result?.domain] || {label:'Result', icon:'420', family:'other'};
}

function canonicalHref(result) {
  const href = String(result?.presentation?.canonicalUrl || '').trim();
  return href.startsWith('/') ? href : '#';
}

function metaValue(label, value, mono=false) {
  if (value === null || value === undefined || value === '') return '';
  return `<span class="meta-pair"><span class="meta-label">${esc(label)}</span><span${mono ? ' class="mono"' : ''}>${esc(value)}</span></span>`;
}

function resultCard(result, sponsored=false) {
  const p = presentationFor(result);
  const title = result?.presentation?.title || result?.sourceKey || result?.id || 'Search result';
  const subtitle = result?.presentation?.subtitle || '';
  const snippet = result?.presentation?.snippet || '';
  const category = result?.presentation?.category || '';
  const source = result?.provenance?.source || '';
  const sourceKey = result?.sourceKey || '';
  const href = canonicalHref(result);
  const campaign = result?._campaign || '';
  return `<article class="result result-${esc(p.family)}${sponsored ? ' result-sponsored' : ''}">
    <div class="result-icon" aria-hidden="true">${esc(p.icon)}</div>
    <div class="result-body">
      <div class="result-kicker"><span class="badge domain-badge">${esc(p.label)}</span>${sponsored ? '<span class="badge sponsored-badge">Sponsored</span>' : ''}</div>
      <div class="result-title"><a href="${esc(href)}">${esc(title)}</a></div>
      ${subtitle ? `<div class="result-subtitle">${esc(subtitle)}</div>` : ''}
      ${snippet ? `<div class="result-snippet">${esc(snippet)}</div>` : ''}
      <div class="result-meta">
        ${metaValue('Source', source)}
        ${metaValue('Key', short(sourceKey), true)}
        ${metaValue('Category', category)}
        ${sponsored && campaign ? metaValue('Campaign', campaign) : ''}
      </div>
      <div class="result-actions"><a class="result-link" href="${esc(href)}">Open canonical view <span aria-hidden="true">→</span></a></div>
    </div>
  </article>`;
}

function renderResults(payload, append=false) {
  const results = payload.results || [];
  const sponsored = payload.sponsored || [];
  const sponsoredHTML = sponsored.length ? `<section class="result-section sponsored-section" aria-label="Sponsored results"><div class="section-heading"><span>Sponsored</span><span class="muted">paid placement · organic ranking unchanged</span></div>${sponsored.map(x => resultCard({...x.result, _campaign:x.campaign}, true)).join('')}</section>` : '';
  const organicHTML = results.length ? `<section class="result-section organic-section" aria-label="Organic results"><div class="section-heading"><span>Results</span><span class="muted">${results.length} shown</span></div>${results.map(r => resultCard(r, false)).join('')}</section>` : '<div class="empty-state"><strong>No matching public results</strong><p>Try another term or remove a domain filter.</p></div>';
  const html = `${sponsoredHTML}${organicHTML}`;
  const pager = payload.nextCursor ? '<div class="pager"><button id="load-more" type="button">Load more</button></div>' : '';
  if (append) {
    const organic = route.querySelector('.organic-section');
    if (organic && results.length) {
      organic.querySelector('.section-heading')?.insertAdjacentHTML('afterend', results.map(r => resultCard(r, false)).join(''));
    }
    route.querySelector('.pager')?.remove();
    route.insertAdjacentHTML('beforeend', pager);
  } else {
    route.innerHTML = `<div class="panel results-panel">${html}</div>${pager}`;
  }
  nextCursor = payload.nextCursor || null;
  document.querySelector('#load-more')?.addEventListener('click', () => runSearch(lastQuery, true));
}

async function runSearch(raw, append=false) {
  const q = String(raw || '').trim();
  if (!q) {
    route.innerHTML = '<div class="panel"><div class="empty-state"><strong>Search public 420 Integrated data</strong><p>Enter a block, transaction, address, service, name, identity, asset, validator, listing, rights record, Commons space, or Pulse publication.</p></div></div>';
    return;
  }
  lastQuery = q;
  const params = new URLSearchParams();
  params.set('q', queryText(q));
  params.set('limit', '25');
  if (append && nextCursor) params.set('cursor', nextCursor);
  if (!append) route.innerHTML = '<div class="panel"><div class="loading-state" role="status"><span class="loading-dot"></span><span>Searching qualified public data…</span></div></div>';
  try {
    const payload = await api(`/v1/search?${params.toString()}`);
    renderResults(payload, append);
  } catch (err) { renderError(err); }
}

async function refreshStatus() {
  try {
    const status = await api('/v1/status');
    statusPill.dataset.state = status.ok ? 'ready' : 'warn';
    statusPill.textContent = status.ok ? `ready · ${status.indexedHeight || 'indexed'}` : (status.state || 'degraded');
  } catch {
    statusPill.dataset.state = 'bad';
    statusPill.textContent = 'search unavailable';
  }
}

async function capabilities() {
  setNav('capabilities');
  try {
    const c = await api('/v1/capabilities');
    route.innerHTML = `<div class="panel"><h2>Capabilities</h2><p class="muted">API ${esc(c.api)}</p><div class="capability-grid"><div><span>Maximum results</span><strong>${esc(c.maxSearchResults)}</strong></div><div><span>Maximum suggestions</span><strong>${esc(c.maxSuggestions)}</strong></div><div><span>Query schema</span><strong class="mono">${esc(c.querySchema || '—')}</strong></div><div><span>Cursor schema</span><strong class="mono">${esc(c.cursorSchema || '—')}</strong></div></div></div>`;
  } catch (err) { renderError(err); }
}

async function statusView() {
  setNav('status');
  try {
    const s = await api('/v1/status');
    route.innerHTML = `<div class="panel"><h2>Status</h2><div class="capability-grid"><div><span>State</span><strong>${esc(s.state)}</strong></div><div><span>Indexed height</span><strong>${esc(s.indexedHeight || '—')}</strong></div><div><span>Finalized height</span><strong>${esc(s.finalizedHeight || '—')}</strong></div><div><span>Availability</span><strong>${s.ok ? 'ready' : 'degraded'}</strong></div></div></div>`;
  } catch (err) { renderError(err); }
}

function routeHash() {
  const hash = location.hash || '#/search';
  if (hash === '#/capabilities') return capabilities();
  if (hash === '#/status') return statusView();
  if (hash === '#/filters') setNav('filters'); else setNav('search');
}

form.addEventListener('submit', (e) => { e.preventDefault(); location.hash = '#/search'; runSearch(input.value); });
filters.forEach(button => button.addEventListener('click', () => {
  activeDomain = button.dataset.domain || '';
  filters.forEach(b => b.classList.toggle('active', b === button));
  if (input.value.trim()) runSearch(input.value);
}));
window.addEventListener('hashchange', routeHash);
routeHash();
refreshStatus();

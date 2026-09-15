const route = document.querySelector('#route-content');
const form = document.querySelector('#global-search');
const input = document.querySelector('#search-input');
const statusPill = document.querySelector('#search-status');
const filters = [...document.querySelectorAll('[data-domain]')];
let activeDomain = '';
let nextCursor = null;
let lastQuery = '';

const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

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

function renderResults(payload, append=false) {
  const results = payload.results || [];
  const sponsored = payload.sponsored || [];
  const items = [...sponsored.map(x => ({...(x.result || {}), _sponsored:true})), ...results];
  const html = items.length ? items.map(r => `<article class="result"><div class="result-title"><a href="${esc(r.presentation?.canonicalUrl || '#')}">${esc(r.presentation?.title || r.sourceKey || r.id)}</a></div><div class="result-meta"><span class="badge">${esc(r.domain || 'result')}</span><span>${esc(r.provenance?.source || '')}</span>${r._sponsored ? '<span class="badge">sponsored</span>' : ''}</div><div class="result-snippet">${esc(r.presentation?.snippet || '')}</div></article>`).join('') : '<p class="muted">No matching public results.</p>';
  const pager = payload.nextCursor ? '<div class="pager"><button id="load-more" type="button">Load more</button></div>' : '';
  if (append) {
    const list = route.querySelector('.results-list');
    if (list && items.length) list.insertAdjacentHTML('beforeend', html);
    route.querySelector('.pager')?.remove();
    route.insertAdjacentHTML('beforeend', pager);
  } else {
    route.innerHTML = `<div class="panel"><div class="results-list">${html}</div>${pager}</div>`;
  }
  nextCursor = payload.nextCursor || null;
  document.querySelector('#load-more')?.addEventListener('click', () => runSearch(lastQuery, true));
}

async function runSearch(raw, append=false) {
  const q = String(raw || '').trim();
  if (!q) {
    route.innerHTML = '<div class="panel"><p class="muted">Enter a query to search qualified public 420 Integrated data.</p></div>';
    return;
  }
  lastQuery = q;
  const params = new URLSearchParams();
  params.set('q', queryText(q));
  params.set('limit', '25');
  if (append && nextCursor) params.set('cursor', nextCursor);
  route.innerHTML = append ? route.innerHTML : '<div class="panel"><p class="muted">Searching…</p></div>';
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
    route.innerHTML = `<div class="panel"><h2>Capabilities</h2><p class="muted">API ${esc(c.api)}</p><p>Maximum results: ${esc(c.maxSearchResults)}</p><p>Maximum suggestions: ${esc(c.maxSuggestions)}</p></div>`;
  } catch (err) { renderError(err); }
}

async function statusView() {
  setNav('status');
  try {
    const s = await api('/v1/status');
    route.innerHTML = `<div class="panel"><h2>Status</h2><p>State: ${esc(s.state)}</p><p>Indexed height: ${esc(s.indexedHeight || '—')}</p><p>Finalized height: ${esc(s.finalizedHeight || '—')}</p></div>`;
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

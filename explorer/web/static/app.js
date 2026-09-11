const app = document.querySelector('#route-content');
const networkPill = document.querySelector('#network-pill');
const searchForm = document.querySelector('#global-search');
const searchInput = document.querySelector('#search-input');

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const mono = (value) => `<span class="mono">${esc(value)}</span>`;
const link = (href, label) => `<a class="link mono" href="${href}">${esc(label)}</a>`;
const fmt = (value) => value === null || value === undefined || value === '' ? '—' : esc(value);

async function api(path) {
  const response = await fetch(path, {headers:{'Accept':'application/json'}, cache:'no-store'});
  let body = null;
  try { body = await response.json(); } catch { body = {error:`HTTP ${response.status}`}; }
  if (!response.ok) {
    const err = new Error(body?.issue?.message || body?.error || `HTTP ${response.status}`);
    err.status = response.status;
    err.body = body;
    throw err;
  }
  return body;
}

function panelError(err) {
  const issue = err.body?.issue;
  const action = issue?.action ? `<p class="muted">${esc(issue.action)}</p>` : '';
  return `<div class="panel error"><strong>${esc(issue?.code || 'UNAVAILABLE')}</strong><p>${esc(err.message)}</p>${action}</div>`;
}

function setNav(route) {
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === route));
}

function title(name, note='') {
  return `<div class="route-title"><div><p class="eyebrow">420Explorer</p><h2>${esc(name)}</h2></div>${note ? `<span class="muted">${esc(note)}</span>` : ''}</div>`;
}

function stats(items) {
  return `<div class="grid">${items.map(([label,value]) => `<div class="stat"><span class="label">${esc(label)}</span><span class="value">${fmt(value)}</span></div>`).join('')}</div>`;
}

async function refreshNetworkPill() {
  try {
    const status = await api('/v1/status');
    networkPill.dataset.state = status.ready ? 'ready' : 'warn';
    networkPill.textContent = status.ready ? `chain ${status.chainId} · head ${status.headHeight}` : `chain ${status.chainId} · attention`;
  } catch (err) {
    const status = err.body?.status;
    networkPill.dataset.state = 'bad';
    networkPill.textContent = status?.wrongChain ? 'wrong chain' : status?.stale ? 'indexer stale' : status?.degraded ? 'indexer degraded' : 'network unavailable';
  }
}

async function overview() {
  const [status, consensus, blocks] = await Promise.all([api('/v1/status'), api('/v1/consensus'), api('/v1/blocks?limit=6')]);
  app.innerHTML = title('Network overview', 'qualified read-only state') + stats([
    ['Head', status.headHeight], ['Safe', status.safeHeight], ['Finalized', status.finalizedHeight],
    ['Epoch', consensus.epoch], ['Rotation', consensus.rotation], ['Active validators', consensus.activeValidatorCount]
  ]) + `<div class="panel"><h3>Recent blocks</h3>${blockTable(blocks.blocks || [])}</div>`;
}

function blockTable(blocks) {
  if (!blocks.length) return '<p class="muted">No indexed blocks available.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Block</th><th>Hash</th><th>Finality</th><th>Transactions</th></tr></thead><tbody>${blocks.map(b => `<tr><td>${link(`#/blocks/${b.number}`, b.number)}</td><td>${mono(b.hash)}</td><td>${fmt(b.finality)}</td><td>${fmt(b.transactionCount ?? b.transactions?.length)}</td></tr>`).join('')}</tbody></table></div>`;
}

async function blocks() {
  const page = await api('/v1/blocks?limit=50');
  app.innerHTML = title('Blocks', `snapshot ${page.meta?.snapshotHeight ?? '—'}`) + `<div class="panel">${blockTable(page.blocks || [])}</div>`;
}

async function blockDetail(number) {
  const view = await api(`/v1/blocks/${encodeURIComponent(number)}`);
  const b = view.block || view;
  app.innerHTML = title(`Block ${number}`, b.finality || '') + stats([
    ['Number', b.number], ['Finality', b.finality], ['Transactions', b.transactionCount ?? view.transactionCount], ['Logs', view.logCount], ['Timestamp', b.timestamp]
  ]) + `<div class="panel"><p><span class="muted">Hash</span><br>${mono(b.hash)}</p><p><span class="muted">Parent</span><br>${mono(b.parentHash)}</p></div>`;
}

async function transactionDetail(hash) {
  const view = await api(`/v1/transactions/${encodeURIComponent(hash)}`);
  const tx = view.transaction || {};
  const receipt = view.receipt || {};
  app.innerHTML = title('Transaction', receipt.statusLabel || '') + stats([
    ['Block', tx.blockNumber], ['Index', tx.index], ['Status', receipt.statusLabel ?? receipt.status], ['Gas used', receipt.gasUsed], ['Finality', view.finality]
  ]) + `<div class="panel"><p><span class="muted">Hash</span><br>${mono(tx.hash || hash)}</p><p><span class="muted">From</span><br>${tx.from ? link(`#/addresses/${tx.from}`,tx.from) : '—'}</p><p><span class="muted">To</span><br>${tx.to ? link(`#/addresses/${tx.to}`,tx.to) : 'contract creation'}</p></div>`;
}

async function addressDetail(address) {
  const view = await api(`/v1/addresses/${encodeURIComponent(address)}?limit=50`);
  const txs = view.transactions || view.history || [];
  app.innerHTML = title('Address') + `<div class="panel"><p>${mono(view.address || address)}</p><p class="muted">${txs.length} indexed transaction record${txs.length===1?'':'s'} in this view.</p></div>` + (txs.length ? `<div class="table-wrap"><table><thead><tr><th>Hash</th><th>Block</th><th>From</th><th>To</th></tr></thead><tbody>${txs.map(tx => `<tr><td>${link(`#/transactions/${tx.hash}`,tx.hash)}</td><td>${fmt(tx.blockNumber)}</td><td>${mono(tx.from)}</td><td>${mono(tx.to)}</td></tr>`).join('')}</tbody></table></div>` : '');
}

async function contractDetail(address) {
  const view = await api(`/v1/contracts/${encodeURIComponent(address)}`);
  app.innerHTML = title('Contract') + stats([['Deployment block',view.deploymentBlockNumber],['Code hash',view.codeHash],['Runtime bytes',view.runtimeByteLength]]) + `<div class="panel"><p>${mono(view.address || address)}</p></div>`;
}

async function registry() {
  const view = await api('/v1/services');
  const services = view.services || view.data || [];
  app.innerHTML = title('Protocol registry', `${services.length} services`) + `<div class="panel">${services.length ? `<div class="table-wrap"><table><thead><tr><th>Service</th><th>Versions</th></tr></thead><tbody>${services.map(s => `<tr><td>${mono(s.serviceId || s.serviceID)}</td><td>${fmt(s.versions?.length ?? s.versionCount)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No registered services available.</p>'}</div>`;
}

async function assets() {
  const view = await api('/v1/assets/activity?limit=50');
  const transfers = view.transfers || [];
  app.innerHTML = title('Asset activity', `${transfers.length} recent transfers`) + `<div class="panel">${transfers.length ? `<div class="table-wrap"><table><thead><tr><th>Asset</th><th>Amount</th><th>From</th><th>To</th><th>Tx</th></tr></thead><tbody>${transfers.map(t => `<tr><td>${mono(t.assetKey)}</td><td>${fmt(t.amount)}</td><td>${mono(t.from)}</td><td>${mono(t.to)}</td><td>${link(`#/transactions/${t.transactionHash}`,t.transactionHash)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No indexed asset transfers available.</p>'}</div>`;
}

async function consensus() {
  const c = await api('/v1/consensus');
  app.innerHTML = title('Consensus', 'consensus-owned projection') + stats([
    ['Slot',c.slot],['Epoch',c.epoch],['Rotation',c.rotation],['Active validators',c.activeValidatorCount],['QC signers',c.latestQC?.signerCount],['QC participation',c.latestQC?.participationPercent != null ? `${c.latestQC.participationPercent}%` : '—']
  ]) + `<div class="panel"><h3>Scheduled proposer seats</h3><p>primary ${mono(c.proposer?.primarySeat)} · fallback 1 ${mono(c.proposer?.fallback1Seat)} · fallback 2 ${mono(c.proposer?.fallback2Seat)}</p></div>`;
}

async function statusPage() {
  try {
    const s = await api('/v1/status');
    app.innerHTML = title('Explorer status') + stats([['State',s.indexerState],['Chain',s.chainId],['Ingest age',`${s.ingestAgeSeconds}s`],['Head lag / safe',s.safeLag],['Head lag / finalized',s.finalizedLag],['Ready',s.ready ? 'yes':'no']]);
  } catch (err) {
    const s = err.body?.status || {};
    app.innerHTML = title('Explorer status') + panelError(err) + stats([['Chain',s.chainId],['State',s.indexerState],['Head',s.headHeight],['Safe',s.safeHeight],['Finalized',s.finalizedHeight],['Ingest age',s.ingestAgeSeconds != null ? `${s.ingestAgeSeconds}s` : '—']]);
  }
}

function transactionsLanding() {
  app.innerHTML = title('Transactions') + '<div class="panel"><p>Paste a transaction hash into global search to open its qualified receipt, logs & finality view.</p></div>';
}

async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const root = parts[0] || 'overview';
  setNav(root === 'block' ? 'blocks' : root);
  app.innerHTML = document.querySelector('#loading-template').innerHTML;
  try {
    if (root === 'overview') return await overview();
    if (root === 'blocks' && parts[1]) return await blockDetail(parts[1]);
    if (root === 'blocks') return await blocks();
    if (root === 'transactions' && parts[1]) return await transactionDetail(parts.slice(1).join('/'));
    if (root === 'transactions') return transactionsLanding();
    if (root === 'addresses' && parts[1]) return await addressDetail(parts[1]);
    if (root === 'contracts' && parts[1]) return await contractDetail(parts[1]);
    if (root === 'registry') return await registry();
    if (root === 'assets') return await assets();
    if (root === 'consensus') return await consensus();
    if (root === 'status') return await statusPage();
    app.innerHTML = title('Not found') + '<div class="panel"><p class="muted">Unknown Explorer route.</p></div>';
  } catch (err) {
    app.innerHTML = title('Explorer unavailable') + panelError(err);
  }
}

searchForm.addEventListener('submit', event => {
  event.preventDefault();
  const q = searchInput.value.trim();
  if (!q) return;
  if (/^\d+$/.test(q)) location.hash = `#/blocks/${q}`;
  else if (/^0x[0-9a-fA-F]{40}$/.test(q)) location.hash = `#/addresses/${q}`;
  else if (/^0x[0-9a-fA-F]{64}$/.test(q)) location.hash = `#/transactions/${q}`;
  else {
    app.innerHTML = title('Search') + '<div class="panel error"><strong>UNRECOGNIZED_QUERY</strong><p>Search accepts a decimal block number, 32-byte transaction hash, or 20-byte address.</p></div>';
  }
});

window.addEventListener('hashchange', route);
refreshNetworkPill();
route();
